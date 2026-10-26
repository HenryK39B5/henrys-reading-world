import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Snapshot } from '../src/domain/types.ts';
import { publicContentFingerprint, verifyPublicMapRelease } from '../scripts/publicMapRelease.ts';
const snapshot = JSON.parse(readFileSync('src/data/public-snapshot.json', 'utf8')) as Snapshot;
const terrain: unknown = JSON.parse(readFileSync('src/data/public-map-terrain.json', 'utf8'));
const manifest: unknown = JSON.parse(readFileSync('scripts/public-map-release.json', 'utf8'));
describe('public content and map release boundary', () => {
    it('pins the public-only map and matching terrain', () => { expect(verifyPublicMapRelease(snapshot, terrain, manifest).fitScope).toBe('approved-public-only'); });
    it('rejects altered originals even when counts and IDs stay the same', () => {
        const changed = structuredClone(snapshot); changed.highlights[0]!.text += ' ';
        expect(() => verifyPublicMapRelease(changed, terrain, manifest)).toThrow();
    });
    it('rejects shifted points and altered terrain', () => {
        const changed = structuredClone(snapshot); changed.map!.points[0]!.x++;
        expect(() => verifyPublicMapRelease(changed, terrain, manifest)).toThrow();
        expect(() => verifyPublicMapRelease(snapshot, {}, manifest)).toThrow();
    });
    it('rejects local scope, changed fitting parameters and added private fields', () => {
        for (const patch of [{ fitScope: 'local-only' }, { parameters: {} }, { vectors: [] }])
            expect(() => verifyPublicMapRelease(snapshot, terrain, { ...(manifest as object), ...patch })).toThrow();
    });
    it('separates content approval from map geometry', () => {
        const changed = structuredClone(snapshot); changed.map!.points[0]!.x++;
        expect(publicContentFingerprint(changed)).toBe(publicContentFingerprint(snapshot));
        changed.books[0]!.title += ' ';
        expect(publicContentFingerprint(changed)).not.toBe(publicContentFingerprint(snapshot));
    });
});
