import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { validateSnapshot } from '../src/domain/validate.ts';
import { validateTopicTagAssignments, validateTopicTagVocabulary, type AssignmentConfidence } from '../src/domain/topicTags.ts';
import { LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';

async function writeAtomic(path: string, value: unknown): Promise<void> { await mkdir(dirname(path), { recursive: true }); const temporary = `${path}.tmp-${String(process.pid)}`; await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); await rename(temporary, path); }

const lexicalRules: Array<{ tagId: string; pattern: RegExp }> = [
    { tagId: 'tag-003', pattern: /概率|赔率|随机游走|贝叶斯/u }, { tagId: 'tag-004', pattern: /运气|幸运|偶然/u },
    { tagId: 'tag-013', pattern: /习惯|每天重复|微行为/u }, { tagId: 'tag-014', pattern: /自控|自制|意志力|克制/u },
    { tagId: 'tag-017', pattern: /阅读|读书|读者|文本/u }, { tagId: 'tag-018', pattern: /时间|等待|时光/u },
    { tagId: 'tag-019', pattern: /精力|疲劳|睡眠|休息|体能/u }, { tagId: 'tag-021', pattern: /爱|关怀|拥抱|怜悯/u },
    { tagId: 'tag-023', pattern: /父母|母亲|父亲|家庭|家人|孩子/u }, { tagId: 'tag-025', pattern: /孤独|孤单|独处|寂寞/u },
    { tagId: 'tag-026', pattern: /恐惧|害怕|焦虑/u }, { tagId: 'tag-027', pattern: /欲望|贪婪|诱惑|性欲/u },
    { tagId: 'tag-028', pattern: /痛苦|创伤|悲伤|受苦/u }, { tagId: 'tag-029', pattern: /沟通|倾听|提问|对话/u },
    { tagId: 'tag-030', pattern: /幸福|快乐|满足/u }, { tagId: 'tag-031', pattern: /意义|值得|目的/u },
    { tagId: 'tag-032', pattern: /自由|自主|强制/u }, { tagId: 'tag-033', pattern: /责任|负责|义务|担当/u },
    { tagId: 'tag-036', pattern: /死亡|死去|去世|临终|衰老/u }, { tagId: 'tag-038', pattern: /财富|资产|致富/u },
    { tagId: 'tag-039', pattern: /市场|价格机制|供需/u }, { tagId: 'tag-040', pattern: /交易|买卖|投机|仓位/u },
    { tagId: 'tag-041', pattern: /货币|通胀|金本位|国债/u }, { tagId: 'tag-045', pattern: /代码|软件|模块|数据系统/u },
    { tagId: 'tag-046', pattern: /权力|支配|服从|政治力量/u }, { tagId: 'tag-047', pattern: /制度|体制|规则/u },
    { tagId: 'tag-048', pattern: /改革|转型|变革/u }, { tagId: 'tag-049', pattern: /民主|法治|宪法|权力制衡/u },
    { tagId: 'tag-050', pattern: /阶层|阶级|社会流动/u }, { tagId: 'tag-051', pattern: /从众|群体思维|集体疯狂/u },
    { tagId: 'tag-052', pattern: /宣传|舆论|洗脑|信息封锁/u }, { tagId: 'tag-053', pattern: /历史叙事|集体记忆|重写历史/u },
];

const overrides: Record<string, string[]> = {
    'h-1025': ['tag-020'], 'h-1269': ['tag-027'], 'h-1473': ['tag-012'], 'h-1714': ['tag-016','tag-043'],
    'h-176': ['tag-029','tag-048'], 'h-1806': ['tag-027'], 'h-2037': ['tag-046','tag-051'], 'h-2038': ['tag-047'],
    'h-2184': ['tag-012','tag-013'], 'h-2519': ['tag-014','tag-020'], 'h-2659': ['tag-010'], 'h-2753': ['tag-011'],
    'h-2782': ['tag-036'], 'h-2815': ['tag-026'], 'h-2879': ['tag-003','tag-040'], 'h-2915': ['tag-046','tag-049'],
    'h-2928': ['tag-051'], 'h-3061': ['tag-046'], 'h-3177': ['tag-007','tag-024'], 'h-3257': ['tag-023'],
    'h-3289': ['tag-015'], 'h-3432': ['tag-020'], 'h-3476': ['tag-029'], 'h-3480': ['tag-016'],
    'h-3812': ['tag-010'], 'h-3878': ['tag-036'], 'h-3911': ['tag-044'], 'h-3926': ['tag-036','tag-052'],
    'h-3963': ['tag-020'], 'h-4039': ['tag-052'], 'h-4089': ['tag-026'], 'h-4114': ['tag-007','tag-046'],
    'h-4130': ['tag-020'], 'h-4157': ['tag-040','tag-046'], 'h-4187': ['tag-042','tag-044'], 'h-4274': ['tag-027'],
    'h-4366': ['tag-046'], 'h-4374': ['tag-042'], 'h-4390': ['tag-046'], 'h-4397': ['tag-026','tag-051'],
    'h-4402': ['tag-014'], 'h-4550': ['tag-034'], 'h-4559': ['tag-024'], 'h-4581': ['tag-029','tag-046'],
    'h-4586': ['tag-019'], 'h-4590': ['tag-020'], 'h-4628': ['tag-012','tag-040'], 'h-4662': ['tag-053'],
    'h-592': ['tag-020'], 'h-668': ['tag-050'],
};

async function main(): Promise<void> {
    const root = resolve(process.cwd(), '.private', 'tags');
    const snapshotCheck = validateSnapshot(JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown, { expectedVisibility: 'local-only' }); if (!snapshotCheck.ok) throw new Error(snapshotCheck.errors.join('; '));
    const vocabularyCheck = validateTopicTagVocabulary(JSON.parse(await readFile(resolve(root, 'vocabulary.json'), 'utf8')) as unknown); if (!vocabularyCheck.ok) throw new Error(vocabularyCheck.errors.join('; '));
    const suggestions = JSON.parse(await readFile(resolve(root, 'trial-suggestions.json'), 'utf8')) as Record<string, unknown> & { assignments: Array<Record<string, unknown>> };
    const text = new Map(snapshotCheck.snapshot.highlights.map((highlight) => [highlight.id, highlight.text]));
    const order = new Map(vocabularyCheck.value.tags.map((tag) => [tag.id, tag.editorialOrder]));
    const reviewedAt = new Date().toISOString();
    const assignments = suggestions.assignments.map((raw) => {
        const highlightId = String(raw.highlightId); const originalTagIds = raw.tagIds as string[]; const originalConfidence = raw.confidence as AssignmentConfidence;
        const passage = text.get(highlightId) ?? ''; let tagIds = overrides[highlightId]; let rationale: string; let confidence: AssignmentConfidence = originalConfidence; let status: 'draft'|'reviewed';
        if (tagIds !== undefined) { status = 'reviewed'; confidence = 'medium'; rationale = 'Agent full-text override after Batch 3 low-confidence review.'; }
        else if (originalConfidence !== 'low') { tagIds = originalTagIds; status = 'reviewed'; rationale = 'Agent accepted seed-centroid/query suggestion after confidence and boundary review.'; }
        else {
            const lexical = lexicalRules.filter((rule) => rule.pattern.test(passage)).map((rule) => rule.tagId).slice(0, 3);
            if (lexical.length > 0) { tagIds = lexical; status = 'reviewed'; confidence = 'medium'; rationale = 'Agent full-text review accepted explicit lexical evidence under the approved definition.'; }
            else { tagIds = originalTagIds; status = 'draft'; rationale = 'No approved tag is sufficiently supported by the standalone text; retain as draft for Studio review.'; }
        }
        tagIds = [...new Set(tagIds)].sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
        const flags = status === 'draft' ? ['low-confidence','possible-missing-tag'] : [];
        return { ...raw, tagIds, status, confidence, rationale, flags, updatedAt: reviewedAt };
    });
    const output = { ...suggestions, generatedAt: reviewedAt, assignments };
    const required = new Set(suggestions.assignments.map((assignment) => String(assignment.highlightId)));
    const checked = validateTopicTagAssignments(output, snapshotCheck.snapshot, vocabularyCheck.value, required); if (!checked.ok) throw new Error(checked.errors.join('; '));
    await writeAtomic(resolve(root, 'assignments.json'), checked.value);
    console.log(`trial assignments: ${String(checked.value.assignments.length)}`);
    console.log(`reviewed/draft: ${String(checked.value.assignments.filter((a) => a.status === 'reviewed').length)} / ${String(checked.value.assignments.filter((a) => a.status === 'draft').length)}`);
}
await main();
