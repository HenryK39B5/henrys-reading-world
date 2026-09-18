import { describe, expect, it } from 'vitest';
import { parseReviewQueueNotes } from '../scripts/tag-review-import.ts';

describe('tag review queue import', () => {
    it('preserves filled answers without treating blank templates as decisions', () => {
        const markdown = [
            '### A1 · h-001 · 《第一本》',
            '- 你的决定：☐ 确认无法归类　☐ 改成 ______风险____　☐ 缺少新概念 ____________',
            '### A2 · h-002 · 《第二本》',
            '- 你的决定：☐ 确认无法归类　☐ 改成 ____________　☐ 缺少新概念 ____________',
            '### A3 · h-003 · 《第三本》',
            '- 你的决定：☐ 确认无法归类　☐ 改成 ___幸福/沉醉___　☐ 缺少新概念 ____________',
        ].join('\n');
        const result = parseReviewQueueNotes(markdown, new Map([['风险', 'tag-002'], ['幸福', 'tag-030']]));

        expect(result).toEqual([
            {
                tier: 'A1',
                highlightId: 'h-001',
                bookTitle: '第一本',
                rawDecision: '风险',
                matchedTagIds: ['tag-002'],
                unmatchedTerms: [],
            },
            {
                tier: 'A3',
                highlightId: 'h-003',
                bookTitle: '第三本',
                rawDecision: '幸福/沉醉',
                matchedTagIds: ['tag-030'],
                unmatchedTerms: ['沉醉'],
            },
        ]);
    });
});
