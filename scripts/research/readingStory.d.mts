export type TagComparison = { status: 'unknown' | 'shared' | 'disjoint'; shared: string[]; from: string[]; to: string[] };
export function compareTaggedPassages(tagIds: Record<string, string[]>, fromId: string, toId: string): TagComparison;
export function lensMembership(tagIds: Record<string, string[]>, bookIds: Record<string, string>, currentId: string): { status: 'unknown' | 'annotated'; ids: string[]; books: number; tags: string[] };
export function weaveEvidence(tagIds: Record<string, string[]>, trail: string[]): Array<TagComparison & { fromId: string; toId: string }>;
