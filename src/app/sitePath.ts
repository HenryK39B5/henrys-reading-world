/** Keep logical room paths separate from their static-hosting location. */
const staticRoom = /^\/(?:themes(?:\/[^/]+)?|paths(?:\/[^/]+)?|books(?:\/[^/]+)?|map|about|design(?:\/technical)?)\/?$/u;

export function sitePath(path: string, base = import.meta.env.BASE_URL): string {
    if (!path.startsWith('/')) throw new Error('room path must be root-relative');
    const prefix = base.replace(/\/$/u, '');
    if (prefix === '') return path;
    const question = path.indexOf('?');
    const pathname = question < 0 ? path : path.slice(0, question);
    const query = question < 0 ? '' : path.slice(question);
    // Each public room has dist/<room>/index.html; use its directory URL so it can return 200.
    const room = staticRoom.test(pathname) ? `${pathname.replace(/\/$/u, '')}/` : pathname;
    return `${prefix}${room}${query}`;
}

/** null means this address belongs to another site or another path on the same host. */
export function roomLocation(path: string, base = import.meta.env.BASE_URL): string | null {
    const prefix = base.replace(/\/$/u, '');
    if (prefix === '') return path;
    if (path === prefix) return '/';
    if (!path.startsWith(`${prefix}/`)) return null;
    const room = path.slice(prefix.length);
    return room.length > 1 ? room.replace(/\/$/u, '') : room;
}
