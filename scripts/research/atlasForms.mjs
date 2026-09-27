// Local chart grammar only: the book-island positions are an index, NOT semantic coordinates.
export function bookIslandLayout(points) {
    const books = new Map();
    for (const point of Object.values(points)) {
        if (!point || typeof point.id !== 'string' || typeof point.bookId !== 'string') throw new Error('invalid passage');
        if (!books.has(point.bookId)) books.set(point.bookId, []);
        books.get(point.bookId).push(point.id);
    }
    if (books.size > 108) throw new Error('island overview supports at most 108 approved books');
    const sorted = [...books].map(([id, ids]) => ({ id, ids: ids.sort(), count: ids.length }))
        .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
    const byPoint = {}; const islands = [];
    for (const [index, book] of sorted.entries()) {
        const column = index % 12; const row = Math.floor(index / 12);
        const x = (column + .5) * 10_000 / 12; const y = (row + .5) * 10_000 / 9;
        const radius = Math.min(345, 140 + Math.sqrt(book.count) * 13);
        islands.push({ id: book.id, x, y, radius, count: book.count });
        for (const [position, id] of book.ids.entries()) {
            const angle = position * Math.PI * (3 - Math.sqrt(5));
            const distance = book.count === 1 ? 0 : radius * (.06 + .82 * Math.sqrt((position + .5) / book.count));
            byPoint[id] = { x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance };
        }
    }
    return { islands, byPoint };
}

export function constellationEdges(data, fromId, trail, limit = 4) {
    if (!data.points[fromId] || !Array.isArray(data.neighbors[fromId])) throw new Error('invalid source');
    const seen = new Set(trail);
    return data.neighbors[fromId].slice(0, 16).map((neighbor, offset) => ({ id: neighbor.id, rank: offset + 1 }))
        .filter((neighbor) => data.points[neighbor.id] && !seen.has(neighbor.id) && data.points[neighbor.id].bookId !== data.points[fromId].bookId)
        .slice(0, limit);
}
