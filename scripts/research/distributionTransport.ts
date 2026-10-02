export interface TransportOptions {
  epsilon: number;
  rho?: number | null;
  maxIterations?: number;
  tolerance?: number;
  a?: Float64Array;
  b?: Float64Array;
}

export interface CouplingResult {
  plan: Float64Array;
  rows: Float64Array;
  columns: Float64Array;
  mass: number;
  costSum: number;
  averageCost: number;
  rowL1: number;
  columnL1: number;
  iterations: number;
  scalingDelta: number;
}

function at(values: ArrayLike<number>, index: number): number {
  const value = values[index];
  if (value === undefined) throw new Error('Out-of-range matrix access');
  return value;
}

// epsilon * KL(plan || a outer b), with optional rho * KL penalties
// on both marginals. This is a numerical candidate model, not a semantic label.
export function coupling(
  cost: readonly number[] | Float64Array,
  n: number,
  m: number,
  { epsilon, rho = null, maxIterations = 2000, tolerance = 1e-12, a, b }: TransportOptions,
): CouplingResult {
  if (cost.length !== n * m || !Number.isInteger(n) || !Number.isInteger(m) || n < 1 || m < 1 ||
      !(epsilon > 0) || !Number.isFinite(epsilon) || !Number.isInteger(maxIterations) || maxIterations < 1 ||
      !(tolerance > 0) || !Number.isFinite(tolerance) ||
      (rho !== null && (!(rho > 0) || !Number.isFinite(rho)))) {
    throw new Error('Invalid transport parameters');
  }
  a ??= Float64Array.from({ length: n }, () => 1 / n);
  b ??= Float64Array.from({ length: m }, () => 1 / m);
  if (a.length !== n || b.length !== m || [...a, ...b].some(v => !(v > 0) || !Number.isFinite(v))) {
    throw new Error('Invalid weights');
  }
  if ([...cost].some(v => !Number.isFinite(v) || v < 0)) throw new Error('Invalid cost');

  const K = new Float64Array(n * m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const kernel = at(a, i) * at(b, j) * Math.exp(-at(cost, i * m + j) / epsilon);
    if (!(kernel > 0)) throw new Error('Kernel underflow; use a log-domain solver for this regime');
    K[i * m + j] = kernel;
  }
  const u = new Float64Array(n).fill(1), v = new Float64Array(m).fill(1);
  const exponent = rho === null ? 1 : rho / (rho + epsilon);
  let iterations = 0, delta = Infinity;
  for (; iterations < maxIterations; iterations++) {
    delta = 0;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < m; j++) s += at(K, i * m + j) * at(v, j);
      const next = (at(a, i) / s) ** exponent, previous = at(u, i);
      if (!Number.isFinite(next) || !(next > 0)) throw new Error('Invalid source scaling');
      delta = Math.max(delta, Math.abs(next - previous) / Math.max(1, Math.abs(next), Math.abs(previous)));
      u[i] = next;
    }
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += at(K, i * m + j) * at(u, i);
      const next = (at(b, j) / s) ** exponent, previous = at(v, j);
      if (!Number.isFinite(next) || !(next > 0)) throw new Error('Invalid target scaling');
      delta = Math.max(delta, Math.abs(next - previous) / Math.max(1, Math.abs(next), Math.abs(previous)));
      v[j] = next;
    }
    if (delta <= tolerance) { iterations++; break; }
  }
  if (delta > tolerance) throw new Error(`Scaling did not converge (${delta})`);

  const plan = new Float64Array(n * m), rows = new Float64Array(n), columns = new Float64Array(m);
  let mass = 0, costSum = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const p = at(u, i) * at(K, i * m + j) * at(v, j);
    if (!Number.isFinite(p) || p < 0) throw new Error('Invalid coupling value');
    plan[i * m + j] = p;
    rows[i] = at(rows, i) + p;
    columns[j] = at(columns, j) + p;
    mass += p;
    costSum += p * at(cost, i * m + j);
  }
  if (!(mass > 0) || !Number.isFinite(mass) || !Number.isFinite(costSum)) throw new Error('Invalid coupling total');
  const rowL1 = rows.reduce((s, r, i) => s + Math.abs(r - at(a, i)), 0);
  const columnL1 = columns.reduce((s, r, j) => s + Math.abs(r - at(b, j)), 0);
  if (rho === null && Math.max(rowL1, columnL1) > 1e-9) throw new Error('Balanced marginal violation');
  return { plan, rows, columns, mass, costSum, averageCost: costSum / mass, rowL1, columnL1, iterations, scalingDelta: delta };
}

export function summarize(
  result: CouplingResult,
  cost: readonly number[] | Float64Array,
  n: number,
  m: number,
  targetIds: readonly string[],
) {
  if (n < 1 || m < 1 || cost.length !== n * m || result.plan.length !== n * m ||
      result.rows.length !== n || targetIds.length !== m ||
      [...targetIds].some(id => typeof id !== 'string' || !id)) throw new Error('Invalid summary dimensions');
  let changedRows = 0;
  const nnTargets = new Set<string>(), flowTargets = new Set<string>();
  const strongest = [];
  for (let i = 0; i < n; i++) {
    let nn = 0, flow = 0;
    for (let j = 1; j < m; j++) {
      const id = targetIds[j] ?? '';
      if (at(cost, i * m + j) < at(cost, i * m + nn) ||
          (at(cost, i * m + j) === at(cost, i * m + nn) && id < (targetIds[nn] ?? ''))) nn = j;
      if (at(result.plan, i * m + j) > at(result.plan, i * m + flow) ||
          (at(result.plan, i * m + j) === at(result.plan, i * m + flow) && id < (targetIds[flow] ?? ''))) flow = j;
    }
    const nearestId = targetIds[nn] ?? '', couplingArgmaxId = targetIds[flow] ?? '';
    nnTargets.add(nearestId);
    flowTargets.add(couplingArgmaxId);
    if (nn !== flow) changedRows++;
    strongest.push({ sourceRow: i, nearestId, couplingArgmaxId,
      couplingMass: at(result.plan, i * m + flow), sourceMarginal: at(result.rows, i), pairCost: at(cost, i * m + flow) });
  }
  return { mass: result.mass, averageCost: result.averageCost, rowL1: result.rowL1, columnL1: result.columnL1, iterations: result.iterations,
    changedRowsVsIndependentNearest: changedRows, independentNearestTargetCount: nnTargets.size, couplingArgmaxTargetCount: flowTargets.size, strongest };
}
