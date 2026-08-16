export type Op = "+" | "-" | "*" | "/" | null;

export type Difficulty = "easy" | "medium" | "hard";

export interface Clue {
  cells: [number, number][];
  op: Op;
  target: number;
}

export interface Puzzle {
  size: number;
  clues: Clue[];
  solution: number[][];
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function choice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedChoice<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function randomLatinSquare(n: number): number[][] {
  const base = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i + j) % n));
  const rows = shuffle([...Array(n).keys()]);
  const cols = shuffle([...Array(n).keys()]);
  const vals = shuffle([...Array(n).keys()]);
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => vals[base[rows[r]][cols[c]]] + 1)
  );
}

const DIRS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function neighbors(r: number, c: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [dr, dc] of DIRS) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < n && nc >= 0 && nc < n) out.push([nr, nc]);
  }
  return out;
}

function key(r: number, c: number, n: number): number {
  return r * n + c;
}

interface CageConfig {
  sizes: number[];
  weights: number[];
  singlesLeft: number;
}

const HARD_SIZE_WEIGHT: Record<number, number> = {
  2: 0.18,
  3: 0.24,
  4: 0.24,
  5: 0.16,
  6: 0.09,
  7: 0.05,
  8: 0.02,
};

function getCageConfig(n: number, difficulty: Difficulty): CageConfig {
  if (difficulty === "easy") {
    if (n <= 6) return { sizes: [1, 2, 3], weights: [0.22, 0.53, 0.25], singlesLeft: 3 };
    return { sizes: [1, 2, 3, 4], weights: [0.18, 0.5, 0.22, 0.1], singlesLeft: 4 };
  }
  if (difficulty === "hard") {
    const maxSize = Math.min(n, 8);
    const sizes = [1];
    const weights = [0.02];
    for (let s = 2; s <= maxSize; s++) {
      sizes.push(s);
      weights.push(HARD_SIZE_WEIGHT[s] ?? 0.02);
    }
    return { sizes, weights, singlesLeft: n <= 6 ? 1 : 2 };
  }
  if (n <= 6) return { sizes: [1, 2, 3, 4], weights: [0.08, 0.45, 0.32, 0.15], singlesLeft: 2 };
  return { sizes: [1, 2, 3, 4, 5], weights: [0.05, 0.4, 0.3, 0.17, 0.08], singlesLeft: 3 };
}

function generateCages(n: number, difficulty: Difficulty): [number, number][][] {
  const { sizes, weights, singlesLeft: initialSinglesLeft } = getCageConfig(n, difficulty);
  let singlesLeft = initialSinglesLeft;

  const unassigned = new Set<number>();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) unassigned.add(key(r, c, n));

  const cages: [number, number][][] = [];

  while (unassigned.size > 0) {
    const startKey = choice([...unassigned]);
    const start: [number, number] = [Math.floor(startKey / n), startKey % n];

    let pickSizes = sizes;
    let pickWeights = weights;
    if (singlesLeft <= 0) {
      pickSizes = sizes.filter((s) => s !== 1);
      pickWeights = weights.filter((_, i) => sizes[i] !== 1);
    }
    const targetSize = Math.min(weightedChoice(pickSizes, pickWeights), unassigned.size);

    const cage: [number, number][] = [start];
    unassigned.delete(startKey);
    const frontier = neighbors(start[0], start[1], n).filter((c2) => unassigned.has(key(c2[0], c2[1], n)));

    while (cage.length < targetSize && frontier.length > 0) {
      const idx = Math.floor(Math.random() * frontier.length);
      const nxt = frontier[idx];
      frontier.splice(idx, 1);
      const nk = key(nxt[0], nxt[1], n);
      if (!unassigned.has(nk)) continue;
      cage.push(nxt);
      unassigned.delete(nk);
      for (const nb of neighbors(nxt[0], nxt[1], n)) {
        const nbk = key(nb[0], nb[1], n);
        if (unassigned.has(nbk) && !frontier.some(([r, c]) => r === nb[0] && c === nb[1])) {
          frontier.push(nb);
        }
      }
    }

    if (cage.length === 1) singlesLeft -= 1;
    cages.push(cage);
  }

  return cages;
}

function product(vals: number[]): number {
  return vals.reduce((a, b) => a * b, 1);
}

function assignClues(cages: [number, number][][], solution: number[][]): Clue[] {
  return cages.map((cage) => {
    const vals = cage.map(([r, c]) => solution[r][c]);
    if (cage.length === 1) {
      return { cells: cage, op: null, target: vals[0] };
    }
    if (cage.length === 2) {
      const [a, b] = vals;
      const options: [Op, number][] = [
        ["+", a + b],
        ["-", Math.abs(a - b)],
        ["*", a * b],
      ];
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      if (hi % lo === 0) options.push(["/", hi / lo]);
      const [op, target] = choice(options);
      return { cells: cage, op, target };
    }
    const op = weightedChoice<Op>(["+", "*"], [0.6, 0.4]);
    const target = op === "+" ? vals.reduce((a, b) => a + b, 0) : product(vals);
    return { cells: cage, op, target };
  });
}

class BudgetExceeded extends Error {}

function countSolutions(n: number, clues: Clue[], limit = 2, nodeBudget = 120_000): number {
  const cageOf = new Int32Array(n * n).fill(-1);
  clues.forEach((clue, gi) => {
    for (const [r, c] of clue.cells) cageOf[key(r, c, n)] = gi;
  });

  const cageTotal = clues.map((c) => c.cells.length);
  const cageFilled = new Array(clues.length).fill(0);
  const cageSum = new Array(clues.length).fill(0);
  const cageProd = new Array(clues.length).fill(1);
  const cageVals: number[][] = clues.map(() => []);

  const grid = new Int32Array(n * n);
  const rowUsed = new Int32Array(n);
  const colUsed = new Int32Array(n);
  let found = 0;
  let nodes = 0;

  function cageOkPartial(gi: number): boolean {
    const { op, target } = clues[gi];
    const filled = cageFilled[gi];
    const total = cageTotal[gi];
    if (total === 1) return cageVals[gi][0] === target;
    if (total === 2) {
      if (filled < 2) return true;
      const [a, b] = cageVals[gi];
      if (op === "+") return a + b === target;
      if (op === "-") return Math.abs(a - b) === target;
      if (op === "*") return a * b === target;
      if (op === "/") {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        return lo !== 0 && hi % lo === 0 && hi / lo === target;
      }
      return true;
    }
    const remaining = total - filled;
    if (op === "+") {
      if (remaining === 0) return cageSum[gi] === target;
      return cageSum[gi] + remaining <= target && cageSum[gi] + remaining * n >= target;
    }
    if (op === "*") {
      if (remaining === 0) return cageProd[gi] === target;
      return cageProd[gi] <= target && target % cageProd[gi] === 0 && cageProd[gi] * n ** remaining >= target;
    }
    return true;
  }

  function candidateMask(r: number, c: number): number {
    return ~(rowUsed[r] | colUsed[c]);
  }

  const relevantBits = ((1 << (n + 1)) - 1) & ~1;
  const popcount = new Uint8Array(relevantBits + 1);
  for (let m = 1; m <= relevantBits; m++) popcount[m] = popcount[m >> 1] + (m & 1);

  function countBits(mask: number): number {
    return popcount[mask & relevantBits];
  }

  function pickCell(): [number, number, number] | null {
    let best: [number, number, number] | null = null;
    let bestCount = Infinity;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (grid[key(r, c, n)] !== 0) continue;
        const mask = candidateMask(r, c);
        const count = countBits(mask);
        if (count < bestCount) {
          best = [r, c, mask];
          bestCount = count;
          if (count <= 1) return best;
        }
      }
    }
    return best;
  }

  function backtrack(): boolean {
    nodes += 1;
    if (nodes > nodeBudget) throw new BudgetExceeded();
    const picked = pickCell();
    if (!picked) {
      found += 1;
      return found >= limit;
    }
    const [r, c, mask] = picked;
    const gi = cageOf[key(r, c, n)];
    for (let v = 1; v <= n; v++) {
      if (!(mask & (1 << v))) continue;
      grid[key(r, c, n)] = v;
      rowUsed[r] |= 1 << v;
      colUsed[c] |= 1 << v;
      cageFilled[gi] += 1;
      cageSum[gi] += v;
      cageProd[gi] *= v;
      cageVals[gi].push(v);

      let stop = false;
      if (cageOkPartial(gi)) {
        stop = backtrack();
      }

      cageVals[gi].pop();
      cageProd[gi] /= v;
      cageSum[gi] -= v;
      cageFilled[gi] -= 1;
      rowUsed[r] &= ~(1 << v);
      colUsed[c] &= ~(1 << v);
      grid[key(r, c, n)] = 0;

      if (stop) return true;
    }
    return false;
  }

  try {
    backtrack();
  } catch (e) {
    if (e instanceof BudgetExceeded) return -1;
    throw e;
  }
  return found;
}

function tryGeneratePuzzle(
  n: number,
  difficulty: Difficulty,
  maxCageAttempts: number,
  maxSquareAttempts: number,
  deadline: number
): Puzzle | null {
  for (let i = 0; i < maxSquareAttempts; i++) {
    if (Date.now() > deadline) return null;
    const solution = randomLatinSquare(n);
    for (let j = 0; j < maxCageAttempts; j++) {
      if (Date.now() > deadline) return null;
      const cages = generateCages(n, difficulty);
      const clues = assignClues(cages, solution);
      if (countSolutions(n, clues, 2) === 1) {
        return { size: n, clues, solution };
      }
    }
  }
  return null;
}

// Bigger cages prune less, so an unlucky layout can take a while to prove
// unique. Give the requested difficulty a time budget, then fall back
// toward easier (faster, tighter-pruning) tiers so a puzzle is always
// returned promptly instead of the request hanging.
const FALLBACK_TIERS: Record<Difficulty, Difficulty[]> = {
  hard: ["hard", "medium", "easy"],
  medium: ["medium", "easy"],
  easy: ["easy"],
};

export function generatePuzzle(
  n: number,
  difficulty: Difficulty = "medium",
  maxCageAttempts = 60,
  maxSquareAttempts = 20
): Puzzle {
  const tiers = FALLBACK_TIERS[difficulty];
  for (let t = 0; t < tiers.length; t++) {
    const isLastTier = t === tiers.length - 1;
    const deadline = isLastTier ? Infinity : Date.now() + 8000;
    const result = tryGeneratePuzzle(n, tiers[t], maxCageAttempts, maxSquareAttempts, deadline);
    if (result) return result;
  }
  throw new Error(`failed to generate a unique ${n}x${n} puzzle`);
}
