import { describe, expect, it } from 'vitest';
import { parseBookMetadataOverrides } from '../scripts/bookMetadataOverrides.ts';

describe('private book metadata overrides', () => {
    it('accepts project IDs and trims corrected visitor metadata', () => {
        const parsed = parseBookMetadataOverrides({
            schemaVersion: 1,
            books: {
                'b-025': {
                    title: ' 软件设计的哲学 ',
                    author: ' 约翰·奥斯特豪特 ',
                    note: ' verified privately ',
                },
            },
        });

        expect(parsed.get('b-025')).toEqual({
            title: '软件设计的哲学',
            author: '约翰·奥斯特豪特',
            note: 'verified privately',
        });
    });

    it.each([
        [{ schemaVersion: 2, books: {} }, 'schemaVersion'],
        [{ schemaVersion: 1, books: { sourceBookId: { title: 'wrong key' } } }, 'invalid project book id'],
        [{ schemaVersion: 1, books: { 'b-001': { note: 'no correction' } } }, 'expected title or author'],
        [{ schemaVersion: 1, books: { 'b-001': { title: 'ok', sourceBookId: 'secret' } } }, 'unsupported field'],
        [{ schemaVersion: 1, books: { 'b-001': { author: '   ' } } }, 'non-empty string'],
    ])('rejects an invalid or identity-bearing override: %s', (candidate, message) => {
        expect(() => parseBookMetadataOverrides(candidate)).toThrow(message);
    });
});
