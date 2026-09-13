import type { Highlight } from './types.ts';

/** Reason labels are for tests and diagnostics; they are never rendered to visitors. */
export type SelectionReason = 'all' | 'book' | 'fallback' | 'sequential';

export type SelectionResult =
    | {
          kind: 'selected';
          id: string;
          reason: SelectionReason;
          /** Set by the selector when the exposure cycle restarted; the reducer rebuilds the cycle set. */
          cycleReset?: boolean;
      }
    | { kind: 'empty' }
    | { kind: 'only-current' }
    | { kind: 'exhausted-book' };

export type SelectionScope = { kind: 'global' } | { kind: 'book'; bookId: string };

/**
 * Input contract shared by the deterministic reference ordering and the discovery selector.
 *
 * v2 dropped the editorial fields (quality, opening/surprise flags, per-passage topics): the stage no
 * longer curates an impression, so selection only needs the real material plus session history.
 */
export type SelectionInput = {
    highlights: Highlight[];
    currentId: string | null;
    /** Exposure order for this session; may repeat after a cycle reset. */
    historyIds: string[];
    /** Ids already shown in the current cycle. */
    seenInCycle: string[];
    scope: SelectionScope;
    /** Injected randomness: the same input and RNG always produce the same output. */
    rng: () => number;
};

export type Selector = (input: SelectionInput) => SelectionResult;

export function isSelected(result: SelectionResult): result is Extract<SelectionResult, { kind: 'selected' }> {
    return result.kind === 'selected';
}
