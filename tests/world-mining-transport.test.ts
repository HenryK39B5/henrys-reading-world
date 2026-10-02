import { describe, expect, it } from 'vitest';
import { coupling, summarize } from '../scripts/research/distributionTransport';

// Numeric solver fixtures only: these are not invented books or passages.
describe('reproducible distribution transport numerical controls', () => {
  it('respects balanced marginals and the constant-cost independent plan', () => {
    const r = coupling(new Float64Array(6).fill(0.7), 2, 3, { epsilon: 0.04 });
    expect(r.mass).toBeCloseTo(1, 11);
    expect(r.rowL1).toBeLessThan(1e-10);
    expect(r.columnL1).toBeLessThan(1e-10);
    for (const p of r.plan) expect(p).toBeCloseTo(1 / 6, 11);
  });

  it('agrees with the analytic KL-unbalanced constant-cost solution', () => {
    const epsilon = 0.04, rho = 0.3, cost = 0.7;
    const r = coupling(new Float64Array(6).fill(cost), 2, 3, { epsilon, rho });
    expect(r.mass).toBeCloseTo(Math.exp(-cost / (epsilon + 2 * rho)), 10);
  });

  it('does not shrink mass for zero cost under the product-measure reference', () => {
    const r = coupling(new Float64Array(6), 2, 3, { epsilon: 0.04, rho: 0.3 });
    expect(r.mass).toBeCloseTo(1, 11);
  });

  it('can change a row choice because of joint capacity, not a new similarity', () => {
    const cost = [0, 0.7, 0.2, 0.8];
    const r = coupling(cost, 2, 2, { epsilon: 0.02 });
    const s = summarize(r, cost, 2, 2, ['0', '1']);
    expect(s.independentNearestTargetCount).toBe(1);
    expect(s.couplingArgmaxTargetCount).toBe(2);
    expect(s.changedRowsVsIndependentNearest).toBe(1);
  });

  it('is equivariant under row and column permutations', () => {
    const cost = [0.1, 0.4, 0.6, 0.5, 0.2, 0.3];
    const reversed = [...cost].reverse();
    const a = coupling(cost, 2, 3, { epsilon: 0.04, rho: 0.3 });
    const b = coupling(reversed, 2, 3, { epsilon: 0.04, rho: 0.3 });
    for (let i = 0; i < a.plan.length; i++) expect(a.plan[i]).toBeCloseTo(b.plan[b.plan.length - 1 - i]!, 10);
  });

  it('preserves the measure when each numeric source row is split in two', () => {
    const cost = [0.1, 0.4, 0.6, 0.5, 0.2, 0.3];
    const split = [0.1, 0.4, 0.6, 0.1, 0.4, 0.6, 0.5, 0.2, 0.3, 0.5, 0.2, 0.3];
    const a = coupling(cost, 2, 3, { epsilon: 0.04, rho: 0.3 });
    const b = coupling(split, 4, 3, { epsilon: 0.04, rho: 0.3 });
    expect(a.mass).toBeCloseTo(b.mass, 10);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      expect(a.plan[i * 3 + j]).toBeCloseTo(b.plan[2 * i * 3 + j]! + b.plan[(2 * i + 1) * 3 + j]!, 10);
    }
  });

  it('rejects invalid numeric contracts', () => {
    expect(() => coupling([0], 1, 1, { epsilon: Infinity })).toThrow('Invalid transport parameters');
    expect(() => coupling([0], 1, 1, { epsilon: 0.04, rho: 0 })).toThrow('Invalid transport parameters');
    expect(() => coupling([NaN], 1, 1, { epsilon: 0.04 })).toThrow('Invalid cost');
    expect(() => coupling([0], 1, 1, { epsilon: 0.04, a: new Float64Array([0]) })).toThrow('Invalid weights');
  });

  it('fails explicitly on kernel underflow or non-convergence', () => {
    expect(() => coupling([0, 2, 2, 0], 2, 2, { epsilon: 0.0001 })).toThrow('Kernel underflow');
    expect(() => coupling([0, 0.7, 0.2, 0.8], 2, 2, { epsilon: 0.02, maxIterations: 1 })).toThrow('did not converge');
  });
});
