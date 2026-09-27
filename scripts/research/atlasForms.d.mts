export interface AtlasPoint { id: string; bookId: string; bookTitle?: string; text?: string }
export interface Position { x: number; y: number }
export function bookIslandLayout(points: Record<string, AtlasPoint>): { islands: Array<Position & { id: string; count: number; radius: number }>; byPoint: Record<string, Position> };
export function constellationEdges(data: { points: Record<string, AtlasPoint>; neighbors: Record<string, Array<{ id: string; score: number }>> }, fromId: string, trail: string[], limit?: number): Array<{ id: string; rank: number }>;
