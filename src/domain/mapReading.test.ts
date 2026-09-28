import { describe, expect, it } from 'vitest';
import publicSnapshot from '../data/public-snapshot.json';
import { indexSnapshot } from './snapshot.ts';
import { mapReadingWindow, MAP_READING_RADIUS } from './mapReading.ts';
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

    it('has an honest empty state for a map-free scope or canvas before sizing', () => {
        expect(mapReadingWindow(index, { centerX: 5000, centerY: 5000, zoom: 2.5 }, 1, 1)).toEqual({ entries: [], books: [] });
    });
});
