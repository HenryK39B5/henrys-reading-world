export type BrowseForm = 'single' | 'river' | 'tide';
export type BrowseContext = { form?: BrowseForm; worldTags?: string[]; playAnchorId?: string | null; browseBookId?: string | null };
export function readBrowseContext(params: URLSearchParams): BrowseContext {
    const form = params.get('view');
    return {
        ...(form === 'single' || form === 'river' || form === 'tide' ? { form } : {}),
        ...(params.has('world') ? { worldTags: [...new Set((params.get('world') ?? '').split(',').filter(id => /^tag-\d{3}$/u.test(id)))].slice(0, 3) } : {}),
        ...(params.has('anchor') ? { playAnchorId: params.get('anchor') || null } : {}),
        ...(params.has('book') ? { browseBookId: params.get('book') || null } : {}),
    };
}
export function browseAddress(context: BrowseContext & { highlightId: string | null }): string {
    const query = new URLSearchParams();
    if (context.form !== undefined) query.set('view', context.form);
    if (context.browseBookId) query.set('book', context.browseBookId);
    if (context.highlightId !== null) query.set('h', context.highlightId);
    if (context.worldTags?.length) query.set('world', context.worldTags.join(','));
    if (context.playAnchorId) query.set('anchor', context.playAnchorId);
    return query.size === 0 ? '/' : '/?' + query.toString();
}
