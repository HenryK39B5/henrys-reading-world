import type { Snapshot } from './types.ts';

export const TOPIC_TAG_VOCABULARY_SCHEMA_VERSION = 1;
export const TOPIC_TAG_ASSIGNMENTS_SCHEMA_VERSION = 1;
export const MAX_TOPIC_TAGS_PER_HIGHLIGHT = 3;

export type TopicTagStatus = 'draft' | 'reviewed' | 'publish';
export type AssignmentStatus = 'draft' | 'reviewed';
export type AssignmentConfidence = 'low' | 'medium' | 'high';
export type AssignmentFlag = 'low-confidence' | 'semantic-outlier' | 'near-boundary' | 'possible-missing-tag';

/**
 * How an assignment was produced, so a reviewer can triage instead of trusting prose.
 *
 * `ensemble`   the embedding proposal and the recorded tags agree;
 * `lexical`    editorial review accepted explicit wording over a low-confidence proposal;
 * `override`   editorial review replaced a proposal that the full text contradicted;
 * `unresolved` no approved tag is supported by the passage on its own — retained as an honest draft;
 * `human`      edited on the Studio screen, so the label is a person's decision, not a suggestion.
 */
export type AssignmentProvenance = 'ensemble' | 'lexical' | 'override' | 'unresolved' | 'human';

export type TopicTagFamily = {
    id: string;
    title: string;
    editorialOrder: number;
};

export type TopicTagDefinition = {
    id: string;
    title: string;
    definition: string;
    includes: string[];
    excludes: string[];
    aliases: string[];
    familyId?: string;
    editorialOrder: number;
    status: TopicTagStatus;
    note?: string;
};

export type TopicTagVocabulary = {
    schemaVersion: typeof TOPIC_TAG_VOCABULARY_SCHEMA_VERSION;
    approvedAt: string;
    families: TopicTagFamily[];
    tags: TopicTagDefinition[];
};

export type TagCandidateScore = {
    tagId: string;
    score: number;
};

export type HighlightTagAssignment = {
    highlightId: string;
    tagIds: string[];
    status: AssignmentStatus;
    provenance: AssignmentProvenance;
    confidence: AssignmentConfidence;
    rationale: string;
    candidates: TagCandidateScore[];
    flags: AssignmentFlag[];
    updatedAt: string;
};

export type TopicTagAssignments = {
    schemaVersion: typeof TOPIC_TAG_ASSIGNMENTS_SCHEMA_VERSION;
    snapshotHash: string;
    vocabularyHash: string;
    generatedAt: string;
    model: string;
    inputVersion: string;
    sampleVersion: string;
    assignments: HighlightTagAssignment[];
};

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extraFields(value: Record<string, unknown>, allowed: string[]): string[] {
    return Object.keys(value).filter((key) => !allowed.includes(key));
}

function nonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function parseStringArray(value: unknown, path: string, errors: string[], allowEmpty: boolean): string[] {
    if (!Array.isArray(value) || value.some((entry) => !nonEmptyString(entry))) {
        errors.push(`${path}: expected ${allowEmpty ? '' : 'non-empty '}string array`);
        return [];
    }
    if (!allowEmpty && value.length === 0) {
        errors.push(`${path}: expected non-empty string array`);
    }
    if (new Set(value).size !== value.length) {
        errors.push(`${path}: duplicate value`);
    }
    return value as string[];
}

export function validateTopicTagVocabulary(value: unknown): ValidationResult<TopicTagVocabulary> {
    const errors: string[] = [];
    if (!isRecord(value)) {
        return { ok: false, errors: ['vocabulary: expected object'] };
    }
    const extra = extraFields(value, ['schemaVersion', 'approvedAt', 'families', 'tags']);
    if (extra.length > 0) {
        errors.push(`vocabulary: unsupported field(s) ${extra.join(', ')}`);
    }
    if (value.schemaVersion !== TOPIC_TAG_VOCABULARY_SCHEMA_VERSION) {
        errors.push(`vocabulary.schemaVersion: expected ${String(TOPIC_TAG_VOCABULARY_SCHEMA_VERSION)}`);
    }
    if (!nonEmptyString(value.approvedAt)) {
        errors.push('vocabulary.approvedAt: expected non-empty string');
    }
    if (!Array.isArray(value.families)) {
        errors.push('vocabulary.families: expected array');
    }
    if (!Array.isArray(value.tags) || value.tags.length === 0) {
        errors.push('vocabulary.tags: expected non-empty array');
    }
    const families: TopicTagFamily[] = [];
    for (const [index, raw] of (Array.isArray(value.families) ? value.families : []).entries()) {
        if (!isRecord(raw)) {
            errors.push(`vocabulary.families[${String(index)}]: expected object`);
            continue;
        }
        const itemExtra = extraFields(raw, ['id', 'title', 'editorialOrder']);
        if (itemExtra.length > 0) {
            errors.push(`vocabulary.families[${String(index)}]: unsupported field(s) ${itemExtra.join(', ')}`);
        }
        if (!nonEmptyString(raw.id) || !/^family-\d{2}$/u.test(raw.id)) {
            errors.push(`vocabulary.families[${String(index)}].id: expected family-NN`);
        }
        if (!nonEmptyString(raw.title)) {
            errors.push(`vocabulary.families[${String(index)}].title: expected non-empty string`);
        }
        if (!Number.isInteger(raw.editorialOrder) || Number(raw.editorialOrder) <= 0) {
            errors.push(`vocabulary.families[${String(index)}].editorialOrder: expected positive integer`);
        }
        if (nonEmptyString(raw.id) && nonEmptyString(raw.title) && Number.isInteger(raw.editorialOrder)) {
            families.push({ id: raw.id, title: raw.title, editorialOrder: Number(raw.editorialOrder) });
        }
    }
    const familyIds = new Set(families.map((family) => family.id));
    if (familyIds.size !== families.length) {
        errors.push('vocabulary.families: duplicate id');
    }
    if (new Set(families.map((family) => family.editorialOrder)).size !== families.length) {
        errors.push('vocabulary.families: duplicate editorialOrder');
    }

    const tags: TopicTagDefinition[] = [];
    for (const [index, raw] of (Array.isArray(value.tags) ? value.tags : []).entries()) {
        const path = `vocabulary.tags[${String(index)}]`;
        if (!isRecord(raw)) {
            errors.push(`${path}: expected object`);
            continue;
        }
        const itemExtra = extraFields(raw, [
            'id', 'title', 'definition', 'includes', 'excludes', 'aliases', 'familyId', 'editorialOrder', 'status', 'note',
        ]);
        if (itemExtra.length > 0) {
            errors.push(`${path}: unsupported field(s) ${itemExtra.join(', ')}`);
        }
        if (!nonEmptyString(raw.id) || !/^tag-\d{3}$/u.test(raw.id)) {
            errors.push(`${path}.id: expected tag-NNN`);
        }
        if (!nonEmptyString(raw.title) || [...String(raw.title)].length < 2 || [...String(raw.title)].length > 4) {
            errors.push(`${path}.title: expected 2-4 characters`);
        }
        if (!nonEmptyString(raw.definition)) {
            errors.push(`${path}.definition: expected non-empty string`);
        }
        const includes = parseStringArray(raw.includes, `${path}.includes`, errors, false);
        const excludes = parseStringArray(raw.excludes, `${path}.excludes`, errors, false);
        const aliases = parseStringArray(raw.aliases, `${path}.aliases`, errors, true);
        if (raw.familyId !== undefined && (!nonEmptyString(raw.familyId) || !familyIds.has(raw.familyId))) {
            errors.push(`${path}.familyId: unknown family`);
        }
        if (!Number.isInteger(raw.editorialOrder) || Number(raw.editorialOrder) <= 0) {
            errors.push(`${path}.editorialOrder: expected positive integer`);
        }
        if (raw.status !== 'draft' && raw.status !== 'reviewed' && raw.status !== 'publish') {
            errors.push(`${path}.status: invalid status`);
        }
        if (raw.note !== undefined && !nonEmptyString(raw.note)) {
            errors.push(`${path}.note: expected non-empty string`);
        }
        if (
            nonEmptyString(raw.id) && nonEmptyString(raw.title) && nonEmptyString(raw.definition) &&
            Number.isInteger(raw.editorialOrder) &&
            (raw.status === 'draft' || raw.status === 'reviewed' || raw.status === 'publish')
        ) {
            tags.push({
                id: raw.id,
                title: raw.title,
                definition: raw.definition,
                includes,
                excludes,
                aliases,
                ...(nonEmptyString(raw.familyId) ? { familyId: raw.familyId } : {}),
                editorialOrder: Number(raw.editorialOrder),
                status: raw.status,
                ...(nonEmptyString(raw.note) ? { note: raw.note } : {}),
            });
        }
    }
    if (new Set(tags.map((tag) => tag.id)).size !== tags.length) {
        errors.push('vocabulary.tags: duplicate id');
    }
    if (new Set(tags.map((tag) => tag.title)).size !== tags.length) {
        errors.push('vocabulary.tags: duplicate title');
    }
    if (new Set(tags.map((tag) => tag.editorialOrder)).size !== tags.length) {
        errors.push('vocabulary.tags: duplicate editorialOrder');
    }
    return errors.length > 0
        ? { ok: false, errors }
        : {
              ok: true,
              value: {
                  schemaVersion: TOPIC_TAG_VOCABULARY_SCHEMA_VERSION,
                  approvedAt: String(value.approvedAt),
                  families: families.sort((left, right) => left.editorialOrder - right.editorialOrder),
                  tags: tags.sort((left, right) => left.editorialOrder - right.editorialOrder),
              },
          };
}

export function validateTopicTagAssignments(
    value: unknown,
    snapshot: Snapshot,
    vocabulary: TopicTagVocabulary,
    requiredHighlightIds?: ReadonlySet<string>,
): ValidationResult<TopicTagAssignments> {
    const errors: string[] = [];
    if (!isRecord(value)) {
        return { ok: false, errors: ['assignments: expected object'] };
    }
    const extra = extraFields(value, [
        'schemaVersion', 'snapshotHash', 'vocabularyHash', 'generatedAt', 'model', 'inputVersion', 'sampleVersion', 'assignments',
    ]);
    if (extra.length > 0) {
        errors.push(`assignments: unsupported field(s) ${extra.join(', ')}`);
    }
    if (value.schemaVersion !== TOPIC_TAG_ASSIGNMENTS_SCHEMA_VERSION) {
        errors.push(`assignments.schemaVersion: expected ${String(TOPIC_TAG_ASSIGNMENTS_SCHEMA_VERSION)}`);
    }
    for (const field of ['snapshotHash', 'vocabularyHash', 'generatedAt', 'model', 'inputVersion', 'sampleVersion'] as const) {
        if (!nonEmptyString(value[field])) {
            errors.push(`assignments.${field}: expected non-empty string`);
        }
    }
    if (!Array.isArray(value.assignments)) {
        errors.push('assignments.assignments: expected array');
    }
    const highlightIds = new Set(snapshot.highlights.map((highlight) => highlight.id));
    const tagById = new Map(vocabulary.tags.map((tag) => [tag.id, tag]));
    const assignments: HighlightTagAssignment[] = [];
    for (const [index, raw] of (Array.isArray(value.assignments) ? value.assignments : []).entries()) {
        const path = `assignments.assignments[${String(index)}]`;
        if (!isRecord(raw)) {
            errors.push(`${path}: expected object`);
            continue;
        }
        const itemExtra = extraFields(raw, ['highlightId', 'tagIds', 'status', 'provenance', 'confidence', 'rationale', 'candidates', 'flags', 'updatedAt']);
        if (itemExtra.length > 0) {
            errors.push(`${path}: unsupported field(s) ${itemExtra.join(', ')}`);
        }
        if (!nonEmptyString(raw.highlightId) || !highlightIds.has(raw.highlightId)) {
            errors.push(`${path}.highlightId: unknown highlight`);
        }
        const tagIds = parseStringArray(raw.tagIds, `${path}.tagIds`, errors, false);
        if (tagIds.length > MAX_TOPIC_TAGS_PER_HIGHLIGHT) {
            errors.push(`${path}.tagIds: at most ${String(MAX_TOPIC_TAGS_PER_HIGHLIGHT)} tags`);
        }
        for (const tagId of tagIds) {
            if (!tagById.has(tagId)) {
                errors.push(`${path}.tagIds: unknown tag ${tagId}`);
            }
        }
        const sortedTagIds = [...tagIds].sort(
            (left, right) => (tagById.get(left)?.editorialOrder ?? 0) - (tagById.get(right)?.editorialOrder ?? 0),
        );
        if (tagIds.join('\0') !== sortedTagIds.join('\0')) {
            errors.push(`${path}.tagIds: must follow vocabulary editorial order`);
        }
        if (raw.status !== 'draft' && raw.status !== 'reviewed') {
            errors.push(`${path}.status: invalid status`);
        }
        if (raw.confidence !== 'low' && raw.confidence !== 'medium' && raw.confidence !== 'high') {
            errors.push(`${path}.confidence: invalid confidence`);
        }
        if (!['ensemble', 'lexical', 'override', 'unresolved', 'human'].includes(String(raw.provenance))) {
            errors.push(`${path}.provenance: invalid provenance`);
        }
        if (!nonEmptyString(raw.rationale)) {
            errors.push(`${path}.rationale: expected non-empty string`);
        }
        if (!Array.isArray(raw.candidates) || raw.candidates.length === 0) {
            errors.push(`${path}.candidates: expected non-empty array`);
        }
        const candidates: TagCandidateScore[] = [];
        for (const [candidateIndex, candidate] of (Array.isArray(raw.candidates) ? raw.candidates : []).entries()) {
            if (!isRecord(candidate) || extraFields(candidate, ['tagId', 'score']).length > 0 || !nonEmptyString(candidate.tagId) || !tagById.has(candidate.tagId) || typeof candidate.score !== 'number' || !Number.isFinite(candidate.score)) {
                errors.push(`${path}.candidates[${String(candidateIndex)}]: invalid candidate`);
                continue;
            }
            candidates.push({ tagId: candidate.tagId, score: candidate.score });
        }
        const flags = parseStringArray(raw.flags, `${path}.flags`, errors, true) as AssignmentFlag[];
        if (flags.some((flag) => !['low-confidence', 'semantic-outlier', 'near-boundary', 'possible-missing-tag'].includes(flag))) {
            errors.push(`${path}.flags: invalid flag`);
        }
        if (!nonEmptyString(raw.updatedAt)) {
            errors.push(`${path}.updatedAt: expected non-empty string`);
        }
        if (
            nonEmptyString(raw.highlightId) && highlightIds.has(raw.highlightId) && tagIds.length >= 1 && tagIds.length <= 3 &&
            (raw.status === 'draft' || raw.status === 'reviewed') &&
            ['ensemble', 'lexical', 'override', 'unresolved', 'human'].includes(String(raw.provenance)) &&
            (raw.confidence === 'low' || raw.confidence === 'medium' || raw.confidence === 'high') &&
            nonEmptyString(raw.rationale) && nonEmptyString(raw.updatedAt)
        ) {
            assignments.push({
                highlightId: raw.highlightId,
                tagIds,
                status: raw.status,
                provenance: raw.provenance as AssignmentProvenance,
                confidence: raw.confidence,
                rationale: raw.rationale,
                candidates,
                flags,
                updatedAt: raw.updatedAt,
            });
        }
    }
    if (new Set(assignments.map((assignment) => assignment.highlightId)).size !== assignments.length) {
        errors.push('assignments.assignments: duplicate highlightId');
    }
    if (requiredHighlightIds !== undefined) {
        const assigned = new Set(assignments.map((assignment) => assignment.highlightId));
        for (const id of requiredHighlightIds) {
            if (!assigned.has(id)) {
                errors.push(`assignments.assignments: missing required highlight ${id}`);
            }
        }
        for (const id of assigned) {
            if (!requiredHighlightIds.has(id)) {
                errors.push(`assignments.assignments: unexpected highlight ${id}`);
            }
        }
    }
    return errors.length > 0
        ? { ok: false, errors }
        : {
              ok: true,
              value: {
                  schemaVersion: TOPIC_TAG_ASSIGNMENTS_SCHEMA_VERSION,
                  snapshotHash: String(value.snapshotHash),
                  vocabularyHash: String(value.vocabularyHash),
                  generatedAt: String(value.generatedAt),
                  model: String(value.model),
                  inputVersion: String(value.inputVersion),
                  sampleVersion: String(value.sampleVersion),
                  assignments: assignments.sort((left, right) => left.highlightId.localeCompare(right.highlightId)),
              },
          };
}

export function updateHighlightAssignment(
    collection: TopicTagAssignments,
    highlightId: string,
    change: Pick<HighlightTagAssignment, 'tagIds' | 'status' | 'confidence' | 'rationale' | 'flags'>,
    updatedAt: string,
): TopicTagAssignments {
    // Anything decided on the Studio screen is a person's decision from that moment on, so it can never be
    // mistaken for an embedding proposal again.
    return {
        ...collection,
        assignments: collection.assignments.map((assignment) =>
            assignment.highlightId === highlightId ? { ...assignment, ...change, provenance: 'human', updatedAt } : assignment,
        ),
    };
}

export function migrateMergedTag(
    vocabulary: TopicTagVocabulary,
    assignments: TopicTagAssignments,
    sourceTagId: string,
    targetTagId: string,
): { vocabulary: TopicTagVocabulary; assignments: TopicTagAssignments } {
    if (sourceTagId === targetTagId || !vocabulary.tags.some((tag) => tag.id === sourceTagId) || !vocabulary.tags.some((tag) => tag.id === targetTagId)) {
        throw new Error('tag merge requires two different existing tags');
    }
    const order = new Map(vocabulary.tags.map((tag) => [tag.id, tag.editorialOrder]));
    return {
        vocabulary: { ...vocabulary, tags: vocabulary.tags.filter((tag) => tag.id !== sourceTagId) },
        assignments: {
            ...assignments,
            assignments: assignments.assignments.map((assignment) => ({
                ...assignment,
                tagIds: [...new Set(assignment.tagIds.map((tagId) => (tagId === sourceTagId ? targetTagId : tagId)))]
                    .sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0)),
                candidates: assignment.candidates.filter((candidate) => candidate.tagId !== sourceTagId),
            })),
        },
    };
}
