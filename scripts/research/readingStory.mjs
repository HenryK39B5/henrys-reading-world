// Public reviewed tags are partial evidence, not a complete negative-label matrix.
export function compareTaggedPassages(tagIds, fromId, toId) {
    const left = tagIds[fromId]; const right = tagIds[toId];
    if (!left || !right) throw new Error('unknown highlight ID');
    if (!left.length || !right.length) return { status: 'unknown', shared: [], from: left, to: right };
    const shared = left.filter((id) => right.includes(id));
    return { status: shared.length ? 'shared' : 'disjoint', shared, from: left, to: right };
}

export function lensMembership(tagIds, bookIds, currentId) {
    const active = tagIds[currentId]; if (!active) throw new Error('unknown highlight ID');
    if (!active.length) return { status: 'unknown', ids: [], books: 0, tags: [] };
    const ids = Object.keys(tagIds).filter((id) => tagIds[id].some((tag) => active.includes(tag)));
    return { status: 'annotated', ids, books: new Set(ids.map((id) => bookIds[id])).size, tags: [...active] };
}

export function weaveEvidence(tagIds, trail) {
    if (!Array.isArray(trail) || !trail.length) throw new Error('empty trail');
    return trail.slice(1).map((id, index) => ({ fromId: trail[index], toId: id, ...compareTaggedPassages(tagIds, trail[index], id) }));
}
