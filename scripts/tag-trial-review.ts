import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { validateSnapshot } from '../src/domain/validate.ts';
import {
    validateTopicTagAssignments,
    validateTopicTagVocabulary,
    type AssignmentConfidence,
    type AssignmentProvenance,
    type HighlightTagAssignment,
    type TopicTagVocabulary,
} from '../src/domain/topicTags.ts';
import { LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';

/**
 * The Batch 3 full-text pass over the 300 trial passages (docs/22 §6.3).
 *
 * This is where the production run stops being "whatever the embedding said". Every passage is read whole
 * and lands in exactly one of four buckets, and the bucket is recorded as `provenance` so a reviewer can
 * triage instead of trusting prose:
 *
 *   ensemble   the proposal survives the read;
 *   override   the full text contradicted the proposal, so it was replaced;
 *   lexical    a low-confidence proposal was upgraded because the passage says the thing explicitly;
 *   unresolved nothing in the approved vocabulary is supported by the passage on its own.
 *
 * Two rules this file deliberately follows:
 *
 * 1. `unresolved` is a real outcome. A passage that cannot carry a tag keeps its proposal, stays `draft`
 *    and is flagged; it is never given a vague tag just to make the batch look finished.
 * 2. Nothing is invented quietly. An `override` records the label the ensemble preferred and a `lexical`
 *    upgrade records the wording that justified it, so a person can disagree with the reasoning rather
 *    than having to guess what happened.
 *
 * The overrides and the lexical rules below are editorial judgement, not model output. They are the part of
 * this batch the implementation agent checks first, which is why the review queue (npm run tags:review-queue)
 * starts with them. Henry only needs to resolve genuine vocabulary or product-boundary questions.
 */

type LexicalRule = { tagId: string; pattern: RegExp; label: string };

/** Explicit wording that a low-confidence passage actually contains, per approved definition. */
const LEXICAL_RULES: LexicalRule[] = [
    { tagId: 'tag-003', label: '概率', pattern: /概率|赔率|随机游走|贝叶斯/u },
    { tagId: 'tag-004', label: '运气', pattern: /运气|幸运|偶然/u },
    { tagId: 'tag-013', label: '习惯', pattern: /习惯|每天重复|微行为/u },
    { tagId: 'tag-014', label: '自控', pattern: /自控|自制|意志力|克制/u },
    { tagId: 'tag-017', label: '阅读', pattern: /阅读|读书|读者|文本/u },
    { tagId: 'tag-018', label: '时间', pattern: /时间|等待|时光/u },
    { tagId: 'tag-019', label: '精力', pattern: /精力|疲劳|睡眠|休息|体能/u },
    { tagId: 'tag-021', label: '爱与关怀', pattern: /爱|关怀|拥抱|怜悯/u },
    { tagId: 'tag-023', label: '家庭', pattern: /父母|母亲|父亲|家庭|家人|孩子/u },
    { tagId: 'tag-025', label: '孤独', pattern: /孤独|孤单|独处|寂寞/u },
    { tagId: 'tag-026', label: '恐惧', pattern: /恐惧|害怕|焦虑/u },
    { tagId: 'tag-027', label: '欲望', pattern: /欲望|贪婪|诱惑|性欲/u },
    { tagId: 'tag-028', label: '痛苦', pattern: /痛苦|创伤|悲伤|受苦/u },
    { tagId: 'tag-029', label: '沟通', pattern: /沟通|倾听|提问|对话/u },
    { tagId: 'tag-030', label: '幸福', pattern: /幸福|快乐|满足/u },
    { tagId: 'tag-031', label: '意义', pattern: /意义|值得|目的/u },
    { tagId: 'tag-032', label: '自由', pattern: /自由|自主|强制/u },
    { tagId: 'tag-033', label: '责任', pattern: /责任|负责|义务|担当/u },
    { tagId: 'tag-036', label: '死亡', pattern: /死亡|死去|去世|临终|衰老/u },
    { tagId: 'tag-038', label: '财富', pattern: /财富|资产|致富/u },
    { tagId: 'tag-039', label: '市场', pattern: /市场|价格机制|供需/u },
    { tagId: 'tag-040', label: '交易', pattern: /交易|买卖|投机|仓位/u },
    { tagId: 'tag-041', label: '货币', pattern: /货币|通胀|金本位|国债/u },
    { tagId: 'tag-045', label: '技术设计', pattern: /代码|软件|模块|数据系统/u },
    { tagId: 'tag-046', label: '权力', pattern: /权力|支配|服从|政治力量/u },
    { tagId: 'tag-047', label: '制度', pattern: /制度|体制|规则/u },
    { tagId: 'tag-048', label: '改革', pattern: /改革|转型|变革/u },
    { tagId: 'tag-049', label: '民主法治', pattern: /民主|法治|宪法|权力制衡/u },
    { tagId: 'tag-050', label: '阶层', pattern: /阶层|阶级|社会流动/u },
    { tagId: 'tag-051', label: '群体心理', pattern: /从众|群体思维|集体疯狂/u },
    { tagId: 'tag-052', label: '宣传控制', pattern: /宣传|舆论|洗脑|信息封锁/u },
    { tagId: 'tag-053', label: '历史记忆', pattern: /历史叙事|集体记忆|重写历史/u },
];

/** Passages that remain honestly unclassifiable even after the closeout pass. */
const FORCE_UNRESOLVED = new Set(['h-1025', 'h-3432', 'h-3480', 'h-3526', 'h-3768', 'h-4130']);

/** Passages where the proposal was wrong and the full text supports something else. */
const OVERRIDES: Record<string, string[]> = {
    'h-025': ['tag-002', 'tag-054'], 'h-1109': ['tag-046', 'tag-051'],
    'h-1269': ['tag-027'], 'h-1441': ['tag-007', 'tag-016'],
    'h-1473': ['tag-012'], 'h-1578': ['tag-011', 'tag-020'], 'h-1654': ['tag-003', 'tag-006', 'tag-055'],
    'h-1714': ['tag-016', 'tag-043'], 'h-176': ['tag-029'], 'h-1806': ['tag-027'],
    'h-1958': ['tag-010', 'tag-015', 'tag-016'], 'h-1984': ['tag-054'],
    'h-2037': ['tag-046', 'tag-047'], 'h-2038': ['tag-047'], 'h-2203': ['tag-016', 'tag-017', 'tag-029'],
    'h-2184': ['tag-012', 'tag-016'], 'h-2212': ['tag-021', 'tag-030'], 'h-2328': ['tag-034'],
    'h-2349': ['tag-012', 'tag-031'], 'h-2425': ['tag-002', 'tag-047'], 'h-2452': ['tag-038'],
    'h-2512': ['tag-044'], 'h-2600': ['tag-038', 'tag-041'],
    'h-2519': ['tag-014', 'tag-020'], 'h-2539': ['tag-001', 'tag-047'], 'h-2659': ['tag-010'],
    'h-2753': ['tag-011'], 'h-2782': ['tag-036'], 'h-2815': ['tag-026'],
    'h-2868': ['tag-042', 'tag-046'], 'h-2879': ['tag-002', 'tag-040'],
    'h-2915': ['tag-046', 'tag-049'], 'h-2928': ['tag-051'], 'h-3061': ['tag-046'],
    'h-3132': ['tag-032', 'tag-052'], 'h-3177': ['tag-007', 'tag-024'],
    'h-3053': ['tag-012', 'tag-014', 'tag-046'], 'h-3218': ['tag-049', 'tag-052'],
    'h-3257': ['tag-023'], 'h-3289': ['tag-015'], 'h-3320': ['tag-031'],
    'h-3355': ['tag-055'], 'h-3366': ['tag-023', 'tag-038'], 'h-3386': ['tag-014', 'tag-038', 'tag-040'],
    'h-3449': ['tag-055'], 'h-3476': ['tag-029'], 'h-3597': ['tag-018', 'tag-042'],
    'h-3652': ['tag-036', 'tag-056'], 'h-3653': ['tag-009'], 'h-3751': ['tag-002', 'tag-046'],
    'h-3764': ['tag-046', 'tag-051'],
    'h-3812': ['tag-035'], 'h-3872': ['tag-022'], 'h-3878': ['tag-036'],
    'h-3880': ['tag-021', 'tag-056'], 'h-3911': ['tag-044'], 'h-3926': ['tag-036', 'tag-053'],
    'h-3930': ['tag-046', 'tag-052'], 'h-3963': ['tag-020'], 'h-4009': ['tag-007', 'tag-045'],
    'h-4039': ['tag-052'], 'h-4048': ['tag-029'], 'h-4089': ['tag-002', 'tag-014'],
    'h-4106': ['tag-024', 'tag-041'], 'h-4114': ['tag-007', 'tag-046'],
    'h-4128': ['tag-021', 'tag-027'],
    'h-4154': ['tag-002', 'tag-040', 'tag-054'], 'h-4157': ['tag-040', 'tag-042'],
    'h-4169': ['tag-039', 'tag-054'], 'h-4176': ['tag-002', 'tag-054'],
    'h-4187': ['tag-002', 'tag-042'], 'h-4205': ['tag-007', 'tag-046'],
    'h-4227': ['tag-002', 'tag-054'], 'h-4274': ['tag-046'], 'h-4304': ['tag-010', 'tag-016'],
    'h-4337': ['tag-029'], 'h-4350': ['tag-020', 'tag-031'],
    'h-4364': ['tag-009', 'tag-012', 'tag-052'], 'h-4366': ['tag-046'], 'h-4374': ['tag-042'],
    'h-4390': ['tag-046', 'tag-049'], 'h-4392': ['tag-026', 'tag-051'],
    'h-4397': ['tag-026', 'tag-051'], 'h-4402': ['tag-014'], 'h-4416': ['tag-012', 'tag-016'],
    'h-4429': ['tag-039'], 'h-4435': ['tag-012', 'tag-039'],
    'h-4442': ['tag-022', 'tag-027'], 'h-4453': ['tag-014', 'tag-040'],
    'h-4498': ['tag-010', 'tag-030', 'tag-036'], 'h-4509': ['tag-021', 'tag-029'],
    'h-4512': ['tag-010', 'tag-032'], 'h-4520': ['tag-001'],
    'h-4522': ['tag-012', 'tag-016', 'tag-044'], 'h-4530': ['tag-010', 'tag-012', 'tag-031'],
    'h-4543': ['tag-033', 'tag-036'], 'h-4550': ['tag-034'], 'h-4559': ['tag-024'],
    'h-4576': ['tag-022', 'tag-027'], 'h-4581': ['tag-042', 'tag-046'],
    'h-4586': ['tag-019'], 'h-4589': ['tag-025', 'tag-028'], 'h-4590': ['tag-020'],
    'h-4599': ['tag-005', 'tag-046'], 'h-4608': ['tag-046', 'tag-053'],
    'h-4610': ['tag-002', 'tag-054'], 'h-4611': ['tag-039', 'tag-041', 'tag-054'],
    'h-4615': ['tag-039', 'tag-055'], 'h-4624': ['tag-039', 'tag-041', 'tag-054'],
    'h-4625': ['tag-041', 'tag-047'], 'h-4626': ['tag-054'],
    'h-4628': ['tag-002', 'tag-012', 'tag-040'], 'h-4629': ['tag-038', 'tag-050'],
    'h-4631': ['tag-007', 'tag-014'], 'h-4632': ['tag-021', 'tag-050'],
    'h-4635': ['tag-032', 'tag-038', 'tag-050'], 'h-4641': ['tag-038', 'tag-042', 'tag-043'],
    'h-4650': ['tag-022'], 'h-4652': ['tag-021', 'tag-031'], 'h-4655': ['tag-010', 'tag-016'],
    'h-4658': ['tag-027', 'tag-038'], 'h-4660': ['tag-018', 'tag-056'],
    'h-4662': ['tag-053'], 'h-592': ['tag-020'], 'h-655': ['tag-028', 'tag-032', 'tag-052'],
    'h-668': ['tag-050'], 'h-869': ['tag-012', 'tag-056'], 'h-990': ['tag-023', 'tag-025'],
};

type Suggestion = {
    highlightId: string;
    tagIds: string[];
    status: string;
    confidence: AssignmentConfidence;
    rationale: string;
    candidates: Array<{ tagId: string; score: number }>;
    flags: string[];
    updatedAt: string;
};

async function writeAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
}

function labelOf(vocabulary: TopicTagVocabulary, tagId: string): string {
    return vocabulary.tags.find((tag) => tag.id === tagId)?.title ?? tagId;
}

function names(vocabulary: TopicTagVocabulary, tagIds: string[]): string {
    return tagIds.map((tagId) => labelOf(vocabulary, tagId)).join(' + ');
}

async function main(): Promise<void> {
    const root = resolve(process.cwd(), '.private', 'tags');
    const snapshotCheck = validateSnapshot(JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown, {
        expectedVisibility: 'local-only',
    });
    if (!snapshotCheck.ok) {
        throw new Error(`local snapshot does not validate: ${snapshotCheck.errors.join('; ')}`);
    }
    const vocabularyCheck = validateTopicTagVocabulary(
        JSON.parse(await readFile(resolve(root, 'vocabulary.json'), 'utf8')) as unknown,
    );
    if (!vocabularyCheck.ok) {
        throw new Error(`vocabulary does not validate: ${vocabularyCheck.errors.join('; ')}`);
    }
    const vocabulary = vocabularyCheck.value;
    const suggestions = JSON.parse(await readFile(resolve(root, 'trial-suggestions.json'), 'utf8')) as {
        snapshotHash: string;
        model: string;
        inputVersion: string;
        sampleVersion: string;
        assignments: Suggestion[];
    };
    const manifest = JSON.parse(await readFile(resolve(root, 'vocabulary-manifest.json'), 'utf8')) as {
        vocabularyHash: string;
    };
    const passageOf = new Map(snapshotCheck.snapshot.highlights.map((highlight) => [highlight.id, highlight.text]));
    const order = new Map(vocabulary.tags.map((tag) => [tag.id, tag.editorialOrder]));
    const reviewedAt = new Date().toISOString();

    const assignments: HighlightTagAssignment[] = suggestions.assignments.map((raw) => {
        const passage = passageOf.get(raw.highlightId) ?? '';
        const proposed = raw.tagIds;
        const top = raw.candidates[0];
        let tagIds: string[];
        let status: 'draft' | 'reviewed';
        let provenance: AssignmentProvenance;
        let confidence: AssignmentConfidence = raw.confidence;
        let rationale: string;

        const override = OVERRIDES[raw.highlightId];
        const lexical = LEXICAL_RULES.filter((rule) => rule.pattern.test(passage));

        if (FORCE_UNRESOLVED.has(raw.highlightId)) {
            tagIds = proposed;
            status = 'draft';
            provenance = 'unresolved';
            confidence = 'low';
            rationale =
                `Batch 3 收口复核后，原文仍无法独立支撑模型提议的「${names(vocabulary, proposed)}」；` +
                '保留原提议只为诊断，不进入 reviewed 数据。';
        } else if (override !== undefined) {
            tagIds = override;
            status = 'reviewed';
            provenance = 'override';
            confidence = 'medium';
            rationale =
                `逐条通读后，模型提议的「${names(vocabulary, proposed)}」在完整原文里站不住` +
                `${top === undefined ? '' : `（原分 ${top.score.toFixed(2)}）`}，原文实际支持「${names(vocabulary, override)}」。`;
        } else if (raw.confidence !== 'low') {
            tagIds = proposed;
            status = 'reviewed';
            provenance = 'ensemble';
            rationale = '通读后接受模型提议；与相邻标签的边界成立，不需要改动。';
        } else if (lexical.length > 0) {
            const chosen = lexical.slice(0, 3);
            tagIds = chosen.map((rule) => rule.tagId);
            status = 'reviewed';
            provenance = 'lexical';
            confidence = 'medium';
            const hits = chosen
                .map((rule) => {
                    const match = rule.pattern.exec(passage);
                    return `${rule.label}←「${match?.[0] ?? ''}」`;
                })
                .join('、');
            rationale = `模型信心低，但原文有明确的字面依据（${hits}），按定义改以词面证据为准。`;
        } else {
            tagIds = proposed;
            status = 'draft';
            provenance = 'unresolved';
            rationale =
                `原文单独撑不起模型提议的「${names(vocabulary, proposed)}」，词表里也没有其他标签能在不猜测的前提下成立；` +
                '保留原提议并标为待定；后续只有在词表或完整产品语境发生变化时才重新打开。';
        }

        const ordered = [...new Set(tagIds)].sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
        const flags = status === 'draft' ? (['low-confidence', 'possible-missing-tag'] as const) : ([] as const);
        return {
            highlightId: raw.highlightId,
            tagIds: ordered,
            status,
            provenance,
            confidence,
            rationale,
            candidates: raw.candidates,
            flags: [...flags],
            updatedAt: reviewedAt,
        };
    });

    const output = {
        schemaVersion: 1 as const,
        snapshotHash: suggestions.snapshotHash,
        vocabularyHash: manifest.vocabularyHash,
        generatedAt: reviewedAt,
        model: suggestions.model,
        inputVersion: suggestions.inputVersion,
        sampleVersion: suggestions.sampleVersion,
        assignments,
    };
    const required = new Set(suggestions.assignments.map((assignment) => assignment.highlightId));
    const checked = validateTopicTagAssignments(output, snapshotCheck.snapshot, vocabulary, required);
    if (!checked.ok) {
        throw new Error(`reviewed trial does not validate: ${checked.errors.join('; ')}`);
    }
    await writeAtomic(resolve(root, 'assignments.json'), checked.value);

    const byProvenance = new Map<AssignmentProvenance, number>();
    for (const assignment of checked.value.assignments) {
        byProvenance.set(assignment.provenance, (byProvenance.get(assignment.provenance) ?? 0) + 1);
    }
    console.log(`trial assignments: ${String(checked.value.assignments.length)}`);
    console.log(
        `reviewed/draft: ${String(checked.value.assignments.filter((a) => a.status === 'reviewed').length)} / ` +
            `${String(checked.value.assignments.filter((a) => a.status === 'draft').length)}`,
    );
    console.log(
        `provenance: ${[...byProvenance].map(([kind, count]) => `${kind} ${String(count)}`).sort().join(', ')}`,
    );
}

await main();
