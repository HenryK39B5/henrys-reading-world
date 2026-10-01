import { describe, expect, it } from 'vitest';
import publicSnapshot from '../data/public-snapshot.json';
import { indexSnapshot } from './snapshot.ts';
import { compareWithBook, mapArrivalView, mapReadingWindow, otherBooksInWindow, sharedReviewedTags, MAP_READING_RADIUS } from './mapReading.ts';
import { mapToScreen } from './map.ts';
import type { Snapshot } from './types.ts';

const index = indexSnapshot(publicSnapshot as Snapshot);
const map = index.snapshot.map;

describe('reading a real map window', () => {
    it('opens a real untagged passage without treating missing tags as a negative', () => {
        const untagged = index.snapshot.highlights.find((entry) => entry.tagIds.length === 0);
        expect(untagged).toBeDefined();
        const point = map?.points.find((entry) => entry.highlightId === untagged?.id);
        expect(point).toBeDefined();
        if (point === undefined || untagged === undefined) return;
        const window = mapReadingWindow(index, { centerX: point.x, centerY: point.y, zoom: 5 }, 390, 520);
        const actual = window.entries.find((entry) => entry.highlight.id === untagged.id);
        expect(actual?.highlight.text).toBe(untagged.text);
        expect(actual?.book.id).toBe(untagged.bookId);
        expect(actual?.highlight.tagIds).toEqual([]);
        expect(window.books.reduce((total, group) => total + group.entries.length, 0)).toBe(window.entries.length);
    });

    it('shows only points within the visibly marked circle and orders books by their nearest true point', () => {
        const point = map?.points[0];
        expect(point).toBeDefined();
        if (point === undefined) return;
        const view = { centerX: point.x, centerY: point.y, zoom: 8 };
        const width = 720;
        const height = 520;
        const result = mapReadingWindow(index, view, width, height);
        expect(result.entries[0]?.point.highlightId).toBe(point.highlightId);
        const radius = Math.min(width, height) * MAP_READING_RADIUS;
        for (const entry of result.entries) {
            const screen = mapToScreen(entry.point, view, width, height);
            expect(Math.hypot(screen.x - width / 2, screen.y - height / 2)).toBeLessThanOrEqual(radius + 0.0001);
        }
        expect(new Set(result.books.map((group) => group.book.id)).size).toBe(result.books.length);
        expect(result.books[0]?.entries[0]?.point.highlightId).toBe(point.highlightId);
    });

    it('queries precisely the visible circle when the mobile viewport clips at a fixed scale', () => {
        const point = map?.points[0];
        if (point === undefined) throw Error('Missing approved point');
        const view = { centerX: point.x, centerY: point.y, zoom: 4, scaleBasis: 390 };
        for (const height of [534, 300, 190]) {
            const result = mapReadingWindow(index, view, 390, height);
            const expected = map?.points.filter((candidate) => {
                const screen = mapToScreen(candidate, view, 390, height);
                return Math.hypot(screen.x - 195, screen.y - height / 2) <= Math.min(390, height) * MAP_READING_RADIUS;
            }).map((candidate) => candidate.highlightId).sort();
            expect(result.entries.map((entry) => entry.highlight.id).sort()).toEqual(expected);
            expect(result.entries[0]?.highlight.id).toBe(point.highlightId);
        }
    });

    it('lets the reader choose an actual other book and pairs two real points without declaring them related', () => {
        const point = map?.points[0];
        expect(point).toBeDefined();
        if (point === undefined) return;
        const window = mapReadingWindow(index, { centerX: point.x, centerY: point.y, zoom: 4 }, 720, 520);
        const anchor = window.entries[0];
        expect(anchor).toBeDefined();
        if (anchor === undefined) return;
        const others = otherBooksInWindow(window, anchor);
        expect(others.length).toBeGreaterThan(0);
        expect(others.every((group) => group.book.id !== anchor.book.id)).toBe(true);
        const group = others[0];
        expect(group).toBeDefined();
        if (group === undefined) return;
        const selected = compareWithBook(window, anchor.highlight.id, group.book.id);
        expect(selected?.book.id).toBe(group.book.id);
        expect(selected?.highlight.text).toBe(index.highlightsById.get(selected?.highlight.id ?? '')?.text);
        if (selected !== null) {
            const square = (x: number, y: number) => (x - anchor.point.x) ** 2 + (y - anchor.point.y) ** 2;
            const nearestDistance = Math.min(...group.entries.map((entry) => square(entry.point.x, entry.point.y)));
            expect(square(selected.point.x, selected.point.y)).toBe(nearestDistance);
            expect(sharedReviewedTags(anchor, selected)).toEqual(anchor.highlight.tagIds.filter((id) => selected.highlight.tagIds.includes(id)));
        }
        expect(compareWithBook(window, anchor.highlight.id, anchor.book.id)).toBeNull();
        expect(compareWithBook(window, 'missing-id', group.book.id)).toBeNull();
        expect(compareWithBook(window, anchor.highlight.id, 'missing-book')).toBeNull();
    });

    it('brings a real incoming passage near the centre, but never moves an already visible return', () => {
        const point = map?.points.find((entry) => entry.x > 3500 && entry.x < 6500 && entry.y > 3500 && entry.y < 6500);
        expect(point).toBeDefined();
        if (point === undefined) return;
        const world = { centerX: 5000, centerY: 5000, zoom: 1 };
        expect(mapArrivalView(point, world, 1, 1)).toBeNull();
        const arrived = mapArrivalView(point, world, 720, 520);
        expect(arrived?.zoom).toBe(4);
        expect(arrived).not.toBeNull();
        if (arrived === null) return;
        expect(mapArrivalView(point, arrived, 720, 520)).toBeNull();
        const offscreen = map?.points.find((entry) => {
            const screen = mapToScreen(entry, arrived, 720, 520);
            return screen.x < 0 || screen.x > 720 || screen.y < 0 || screen.y > 520;
        });
        expect(offscreen).toBeDefined();
        if (offscreen === undefined) return;
        const moved = mapArrivalView(offscreen, arrived, 720, 520);
        expect(moved).not.toBeNull();
        if (moved !== null) {
            const onScreen = mapToScreen(offscreen, moved, 720, 520);
            expect(onScreen.x).toBeGreaterThanOrEqual(0);
            expect(onScreen.x).toBeLessThanOrEqual(720);
            expect(onScreen.y).toBeGreaterThanOrEqual(0);
            expect(onScreen.y).toBeLessThanOrEqual(520);
        }
    });

    it('can arrive at the actual outer public points and read them through a clipped mobile window', () => {
        for (const id of ['h-015', 'h-3944', 'h-2300', 'h-3085']) {
            const point = map?.points.find((entry) => entry.highlightId === id);
            if (point === undefined) throw Error('Missing actual outer point');
            const arrived = mapArrivalView(point, { centerX: 5000, centerY: 5000, zoom: 1, scaleBasis: 390 }, 390, 190);
            if (arrived === null) throw Error('Outer point did not arrive');
            expect(mapToScreen(point, arrived, 390, 190)).toEqual({ x: 195, y: 95 });
            expect(mapReadingWindow(index, arrived, 390, 190).entries.some((entry) => entry.highlight.id === id)).toBe(true);
        }
    });

    it('has an honest empty state for a map-free scope or canvas before sizing', () => {
        expect(mapReadingWindow(index, { centerX: 5000, centerY: 5000, zoom: 2.5 }, 1, 1)).toEqual({ entries: [], books: [] });
    });
});
