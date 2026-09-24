/** Keep logical room paths separate from their static-hosting location. */
export function sitePath(path: string, base = import.meta.env.BASE_URL): string {
    if (!path.startsWith('/')) throw new Error('room path must be root-relative');
    return `${base.replace(/\/$/u, '')}${path}`;
}

/** null means this address belongs to another site or another path on the same host. */
export function roomLocation(path: string, base = import.meta.env.BASE_URL): string | null {
    const prefix = base.replace(/\/$/u, '');
    if (prefix === '') return path;
    if (path === prefix) return '/';
    return path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : null;
}
