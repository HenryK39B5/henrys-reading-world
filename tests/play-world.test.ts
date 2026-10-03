import { describe, expect, it } from 'vitest';
import publicSnapshot from '../src/data/public-snapshot.json';
import type { Snapshot } from '../src/domain/types.ts';
import { PLAY_WORLD_VERSION, type PlayWorldData, parsePlayWorldData, playSnapshotIdentity, topicGates, topicMembers, playfulEncounter, playNeighbours, localPositions } from '../src/domain/playWorld.ts';

const snapshot = publicSnapshot as Snapshot;
const highlights = snapshot.highlights;
const data: PlayWorldData = {
    version: PLAY_WORLD_VERSION, snapshotHash: 'a'.repeat(64), ids: highlights.map(h => h.id),
    positions: highlights.map((_, i): [number, number, number] => [Math.sin(i), Math.cos(i), Math.sin(i * 0.2)]),
    neighbours: highlights.map((_, i) => [(i + 1) % highlights.length]),
}; // Numeric display fixtures only; all content/identities are genuine approved materials.

describe('play-world genuine-content and numeric contracts', () => {
    it('retains every original at the root, including unknown tags', () => {
        expect(topicMembers(highlights, [])).toEqual(highlights);
        expect(highlights.some(h => h.tagIds.length === 0)).toBe(true);
        expect(topicMembers(highlights, ['not-a-real-tag'])).toEqual([]);
    });
    it('intersections are order independent and require positive recorded membership', () => {
        for (const h of highlights.filter(h => h.tagIds.length >= 2).slice(0,20)) {
            expect(topicMembers(highlights, h.tagIds)).toEqual(topicMembers(highlights, [...h.tagIds].reverse()));
            expect(topicMembers(highlights, h.tagIds).includes(h)).toBe(true);
            expect(topicMembers(highlights, [...h.tagIds, h.tagIds[0] as string])).toEqual(topicMembers(highlights,h.tagIds));
        }
    });
    it('gates strictly reduce member sets, merge repeats and stop at sparse/repeated sets', () => {
        for (const scope of [[], ...snapshot.tags.map(tag => [tag.id])]) {
            const members = topicMembers(highlights, scope);
            const gates = topicGates(highlights, scope);
            expect(new Set(gates.map(gate=>gate.memberIds.join('|'))).size).toBe(gates.length);
            for (const gate of gates) {
                expect(gate.memberIds.length).toBeGreaterThanOrEqual(4);
                expect(gate.memberIds.length).toBeLessThan(members.length);
                for (const tag of gate.tagIds) expect(topicMembers(highlights,[...scope,tag]).map(h=>h.id).sort()).toEqual(gate.memberIds);
            }
        }
        expect(topicGates(highlights.slice(0,3),[])).toEqual([]);
    });
    it('rejects vectors, missing IDs, duplicate IDs, stale coverage and invalid numeric edges', () => {
        expect(parsePlayWorldData(data,snapshot)).toBe(data);
        for (const bad of [{...data,vectors:[]},{...data,ids:data.ids.slice(1)},
            {...data,ids:data.ids.map(()=>data.ids[0])},{...data,positions:[]},
            {...data,neighbours:data.neighbours.map((_,i)=>[i])},
            {...data,positions:data.positions.map(()=>[NaN,0,0])}]) expect(()=>parsePlayWorldData(bad,snapshot)).toThrow();
    });
    it('binds bytes to originals and tags, independent of array order', () => {
        expect(playSnapshotIdentity(snapshot)).toBe(playSnapshotIdentity({...snapshot,highlights:[...highlights].reverse(),tags:[...snapshot.tags].reverse()}));
        expect(playSnapshotIdentity({...snapshot,highlights:highlights.slice(1)})).not.toBe(playSnapshotIdentity(snapshot));
    });
    it('has injectable, book-first encounters with explicit exhaustion and full reachability', () => {
        const small=highlights.slice(0,35); const seen=new Set<string>();
        while(seen.size<small.length){const next=playfulEncounter(small,seen,()=>0);expect(next).not.toBeNull();seen.add(next as string);}
        expect(playfulEncounter(small,seen,()=>0.5)).toBeNull();
    });
    it('does not substitute screen proximity for stored candidates or invent local neighbours', () => {
        const current=highlights[0]; if(current===undefined)throw Error('No real data');
        expect(playNeighbours(data,current.id,highlights)).toEqual([highlights[1]]);
        expect(playNeighbours(data,current.id,[current])).toEqual([]);
        const points=localPositions(data,highlights.slice(0,10).map(h=>h.id));
        expect(points.size).toBe(10); expect([...points.values()].flat().every(Number.isFinite)).toBe(true);
    });
});
