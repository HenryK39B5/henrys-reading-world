import type { Highlight } from './types.ts';

/** Reason labels are for tests and diagnostics; they are never rendered to visitors. */
export type SelectionReason = 'opening' | 'contrast' | 'surprise' | 'explore' | 'book' | 'fallback' | 'sequential';

export type SelectionResult =
    | {
          kind: 'selected';
          id: string;
          reason: SelectionReason;
          /** Set by the engine when the exposure cycle restarted; the reducer rebuilds the cycle set. */
          cycleReset?: boolean;
      }
    | { kind: 'empty' }
    | { kind: 'only-current' }
    | { kind: 'exhausted-book' };

export type SelectionScope = { kind: 'global' } | { kind: 'book'; bookId: string };

/**
 * Input contract shared by the Slice 1 placeholder ordering and the Slice 2 serendipity engine
 * (docs/04). Keeping it stable means the reducer and the UI do not change when the engine lands.
 */
export type SelectionInput = {
    highlights: Highlight[];
    currentId: string | null;
    /** Exposure order for this session; may repeat after a cycle reset. */
    historyIds: string[];
    /** Ids already shown in the current cycle. */
    seenInCycle: string[];
    /** Committed global-stage draws; drives the opening/contrast/surprise roles. */
    globalDrawCount: number;
    scope: SelectionScope;
    /** Injected randomness: the same input and RNG always produce the same output. */
    rng: () => number;
    nowYear: number;
};

export type Selector = (input: SelectionInput) => SelectionResult;

export function isSelected(result: SelectionResult): result is Extract<SelectionResult, { kind: 'selected' }> {
    return result.kind === 'selected';
}
