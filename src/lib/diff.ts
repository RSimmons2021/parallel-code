/**
 * Minimal line-level diff (LCS) for showing what changed between two versions of
 * a registry asset. O(n·m) — fine for prompt-sized text, and dependency-free.
 */

export type DiffOp = { type: 'same' | 'add' | 'del'; text: string };

export function lineDiff(a: string, b: string): DiffOp[] {
  const x = a.split('\n');
  const y = b.split('\n');
  const n = x.length;
  const m = y.length;

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  // Walk the table to emit ops in order.
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      ops.push({ type: 'same', text: x[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: 'del', text: x[i] });
      i++;
    } else {
      ops.push({ type: 'add', text: y[j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: 'del', text: x[i++] });
  while (j < m) ops.push({ type: 'add', text: y[j++] });
  return ops;
}

/** Summary counts of additions / deletions, for a compact "+3 −1" badge. */
export function diffStat(ops: DiffOp[]): { add: number; del: number } {
  let add = 0;
  let del = 0;
  for (const op of ops) {
    if (op.type === 'add') add++;
    else if (op.type === 'del') del++;
  }
  return { add, del };
}
