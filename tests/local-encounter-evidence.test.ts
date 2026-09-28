import { describe, expect, it } from 'vitest';
import publicSnapshot from '../src/data/public-snapshot.json';
import { mapReadingWindow, otherBooksInWindow, compareWithBook } from '../src/domain/mapReading.ts';
import { indexSnapshot } from '../src/domain/snapshot.ts';
import type { Snapshot } from '../src/domain/types.ts';
import { compareLocalEncounters, median, stableUnit } from '../scripts/research/localEncounterEvidence.ts';

const index = indexSnapshot(publicSnapshot as Snapshot);

describe('local encounter diagnostic on approved public points', () => {
    const point = index.snapshot.map?.points.find((entry) => entry.highlightId === 'h-025');
    it('has the same real circle membership at three actual canvas aspect ratios', () => {
        expect(point).toBeDefined();
        if (point === undefined) return;
        const view = { centerX: point.x, centerY: point.y, zoom: 4 };
        const world = mapReadingWindow(index, view, 720, 520);
        for (const [width, height] of [[390, 520], [320, 500]]) {
            const resized = mapReadingWindow(index, view, width!, height!);
            expect(resized.entries.map((entry) => entry.highlight.id)).toEqual(world.entries.map((entry) => entry.highlight.id));
            expect(resized.books.map((group) => group.book.id)).toEqual(world.books.map((group) => group.book.id));
        }
    });

    it('keeps the chosen book/circle fixed while reporting actual, high-score and controlled passages separately', () => {
        expect(point).toBeDefined();
        if (point === undefined) return;
        const window = mapReadingWindow(index, { centerX: point.x, centerY: point.y, zoom: 4 }, 720, 520);
        const anchor = window.entries.find((entry) => entry.highlight.id === point.highlightId);
        expect(anchor).toBeDefined();
        if (anchor === undefined) return;
        const group = otherBooksInWindow(window, anchor).find((entry) => entry.entries.length > 2);
        expect(group).toBeDefined();
        if (group === undefined) return;
        // Only the scorer is controlled by this unit test; every ID, book and map point is published data.
        const scores = new Map(group.entries.map((entry, rank) => [entry.highlight.id, rank / group.entries.length]));
        const probe = compareLocalEncounters(window, anchor.highlight.id, group.book.id, (_from, to) => scores.get(to) ?? NaN, 0);
        expect(probe?.actual.id).toBe(compareWithBook(window, anchor.highlight.id, group.book.id)?.highlight.id);
        expect(probe?.model.id).toBe(group.entries.at(-1)?.highlight.id);
        expect(probe?.control.id).toBe(group.entries[0]?.highlight.id);
        expect(probe?.otherBookWindowCount).toBe(group.entries.length);
        expect(probe?.model.distance).toBeGreaterThanOrEqual(0);
        expect(compareLocalEncounters(window, anchor.highlight.id, anchor.book.id, () => 0, 0)).toBeNull();
        expect(() => compareLocalEncounters(window, anchor.highlight.id, group.book.id, () => 0, 1)).toThrow();
    });

    it('uses deterministic independent draws and a non-mutating median', () => {
        expect(stableUnit('2026-09-28|h-025|b-055')).toBe(stableUnit('2026-09-28|h-025|b-055'));
        expect(stableUnit('2026-09-28|h-025|b-055')).not.toBe(stableUnit('2026-09-28|h-025|b-054'));
        const source = [5, 1, 9, 3];
        expect(median(source)).toBe(4);
        expect(source).toEqual([5, 1, 9, 3]);
    });
});
