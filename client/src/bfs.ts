import type { Position } from './types';

const COLS = 15;
const ROWS = 26;

const DIRS: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1],
];

export function key(p: Position): string {
  return `${p.col},${p.row}`;
}

export function fromKey(k: string): Position {
  const [col, row] = k.split(',').map(Number);
  return { col, row };
}

/**
 * Bounding box in *landscape* grid coordinates (col 0-25 left→right, row 0-14 top→bottom),
 * used by <Pitch> to crop the rendered grid to a sub-region.
 */
export interface ZoomBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

const LANDSCAPE_COLS = 26;
const LANDSCAPE_ROWS = 15;

/**
 * Computes a landscape-coordinate bounding box that encloses the given
 * portrait-coordinate squares, expanded by `padding` squares on each side
 * and clamped to the pitch edges. Portrait { col, row } maps to landscape
 * { col: row, row: col } (see <Pitch> for the same transform).
 */
export function computeZoomBounds(positions: Position[], padding: number): ZoomBounds | null {
  if (positions.length === 0) return null;

  let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
  for (const p of positions) {
    const lCol = p.row; // portrait row -> landscape col
    const lRow = p.col; // portrait col -> landscape row
    if (lCol < minCol) minCol = lCol;
    if (lCol > maxCol) maxCol = lCol;
    if (lRow < minRow) minRow = lRow;
    if (lRow > maxRow) maxRow = lRow;
  }

  return {
    minCol: Math.max(0, minCol - padding),
    maxCol: Math.min(LANDSCAPE_COLS - 1, maxCol + padding),
    minRow: Math.max(0, minRow - padding),
    maxRow: Math.min(LANDSCAPE_ROWS - 1, maxRow + padding),
  };
}

export function neighbours(pos: Position): Position[] {
  const result: Position[] = [];
  for (const [dc, dr] of DIRS) {
    const c = pos.col + dc;
    const r = pos.row + dr;
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
      result.push({ col: c, row: r });
    }
  }
  return result;
}

export function tacklezoneKeys(opponentPositions: Position[]): Set<string> {
  const tz = new Set<string>();
  for (const op of opponentPositions) {
    for (const n of neighbours(op)) {
      tz.add(key(n));
    }
  }
  return tz;
}

// ── Reachable flood-fill (for highlighting all reachable squares) ─────────────

export interface ReachResult {
  free: Position[];
  dodge: Position[];
  // All reachable keys (free + dodge) for quick lookup
  reachableKeys: Set<string>;
}

export function computeReachable(
  origin: Position,
  ma: number,
  allPiecePositions: Position[],
  opponentPositions: Position[],
  gfiRemaining: number = 0,
): ReachResult {
  const blockedKeys = new Set(allPiecePositions.map(key));
  const tzKeys = tacklezoneKeys(opponentPositions);
  const originKey = key(origin);
  const totalSteps = ma + gfiRemaining;

  const cleanDist = new Map<string, number>();
  const dodgeDist = new Map<string, number>();

  // Plain FIFO over a growing array with a read cursor — Array.shift() is O(n)
  // and this runs on every selection and every committed step.
  const queue: { pos: Position; steps: number }[] = [{ pos: origin, steps: 0 }];
  let head = 0;
  cleanDist.set(originKey, 0);

  while (head < queue.length) {
    const { pos, steps } = queue[head++];
    if (steps >= totalSteps) continue;

    const leavingTZ = tzKeys.has(key(pos));

    for (const next of neighbours(pos)) {
      const nk = key(next);
      if (blockedKeys.has(nk)) continue;

      const needsDodge = leavingTZ;

      if (!needsDodge) {
        if (cleanDist.has(nk)) continue;
        cleanDist.set(nk, steps + 1);
        queue.push({ pos: next, steps: steps + 1 });
      } else {
        if (cleanDist.has(nk) || dodgeDist.has(nk)) continue;
        dodgeDist.set(nk, steps + 1);
        queue.push({ pos: next, steps: steps + 1 });
      }
    }
  }

  const free: Position[] = [];
  const dodge: Position[] = [];
  const reachableKeys = new Set<string>();

  for (const k of cleanDist.keys()) {
    if (k !== originKey) { free.push(fromKey(k)); reachableKeys.add(k); }
  }
  for (const k of dodgeDist.keys()) {
    dodge.push(fromKey(k)); reachableKeys.add(k);
  }

  return { free, dodge, reachableKeys };
}

// ── Shortest path finder (for hover preview, FFB-style) ───────────────────────

export interface PathStep {
  pos: Position;
  /** True if leaving the *previous* square required a dodge */
  requiresDodge: boolean;
  /**
   * Dodge target number (2–6) if requiresDodge is true, otherwise null.
   * Computed as: base (6 - AG) + number of opponent TZs covering the destination,
   * clamped to [2, 6] — see dodgeTargetAt.
   */
  dodgeTarget: number | null;
  /** True if this step costs a GFI (Go For It) rather than regular MA */
  isGfi: boolean;
  /**
   * Pickup target number (2–6) if this step's destination is the loose
   * ball's square, otherwise null. Same formula as dodgeTargetAt.
   */
  pickupTarget: number | null;
}

// ── Priority queue ────────────────────────────────────────────────────────────

/**
 * Binary min-heap keyed by a numeric priority.
 *
 * findShortestPath runs on every mouse-move over the pitch; the previous
 * implementation re-sorted its whole frontier on each iteration, which is
 * O(V² log V) with an allocation per comparison pass.
 */
class MinHeap<T> {
  private items: { priority: number; value: T }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(priority: number, value: T): void {
    this.items.push({ priority, value });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].priority <= this.items[i].priority) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.items.length && this.items[left].priority < this.items[smallest].priority) smallest = left;
        if (right < this.items.length && this.items[right].priority < this.items[smallest].priority) smallest = right;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top.value;
  }
}

/**
 * Compute the dodge target for moving into `dest` given the mover's AG
 * and the full list of opponent positions.
 *
 * BB2020 rule:
 *   base = 6 - AG  (AG3 → 3+, AG4 → 2+, AG2 → 4+)
 *   +1 for each opponent whose tackle zone covers `dest`
 *   clamped to [2, 6]
 */
export function dodgeTargetAt(dest: Position, ag: number, opponentPositions: Position[]): number {
  const base = 6 - ag;
  const tzCount = opponentPositions.filter(op =>
    neighbours(op).some(n => n.col === dest.col && n.row === dest.row)
  ).length;
  return Math.min(6, Math.max(2, base + tzCount));
}

/**
 * Compute the pickup target for a player moving onto a loose ball's square.
 *
 * Standard Agility-test rule (same shape as dodgeTargetAt):
 *   base = 6 - AG  (AG3 → 3+, AG4 → 2+)
 *   +1 for each opponent tackle zone covering the ball's square
 *   clamped to [2, 6]
 */
export function pickupTargetAt(pos: Position, ag: number, opponentPositions: Position[]): number {
  const base = 6 - ag;
  const tzCount = opponentPositions.filter(op =>
    neighbours(op).some(n => n.col === pos.col && n.row === pos.row)
  ).length;
  return Math.min(6, Math.max(2, base + tzCount));
}

// ── Passing ───────────────────────────────────────────────────────────────────

export type PassRangeBand = 'quick' | 'short' | 'long' | 'bomb';

const BB2025_THROWING_RANGE_TABLE = [
  ['T', 'Q', 'Q', 'Q', 'S', 'S', 'S', 'L', 'L', 'L', 'L', 'B', 'B', 'B'],
  ['Q', 'Q', 'Q', 'Q', 'S', 'S', 'S', 'L', 'L', 'L', 'L', 'B', 'B', 'B'],
  ['Q', 'Q', 'Q', 'S', 'S', 'S', 'S', 'L', 'L', 'L', 'L', 'B', 'B', 'B'],
  ['Q', 'Q', 'S', 'S', 'S', 'S', 'S', 'L', 'L', 'L', 'B', 'B', 'B'],
  ['S', 'S', 'S', 'S', 'S', 'S', 'L', 'L', 'L', 'L', 'B', 'B', 'B'],
  ['S', 'S', 'S', 'S', 'S', 'L', 'L', 'L', 'L', 'B', 'B', 'B'],
  ['S', 'S', 'S', 'S', 'L', 'L', 'L', 'L', 'L', 'B', 'B', 'B'],
  ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'B', 'B', 'B'],
  ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'B', 'B', 'B', 'B'],
  ['L', 'L', 'L', 'L', 'L', 'B', 'B', 'B', 'B', 'B'],
  ['L', 'L', 'L', 'B', 'B', 'B', 'B', 'B', 'B'],
  ['B', 'B', 'B', 'B', 'B', 'B', 'B'],
  ['B', 'B', 'B', 'B', 'B'],
  ['B', 'B', 'B'],
] as const;

function passRangeCodeToBand(code: string | undefined): PassRangeBand | null {
  switch (code) {
    case 'Q': return 'quick';
    case 'S': return 'short';
    case 'L': return 'long';
    case 'B': return 'bomb';
    default: return null;
  }
}

/**
 * BB2025 range-ruler lookup from FFB's throwing range table.
 * The table is indexed by absolute square offsets and is symmetrical.
 */
export function rangeBandForPass(from: Position, to: Position): PassRangeBand | null {
  const dx = Math.abs(from.col - to.col);
  const dy = Math.abs(from.row - to.row);
  const row = BB2025_THROWING_RANGE_TABLE[Math.min(dx, dy)];
  return passRangeCodeToBand(row?.[Math.max(dx, dy)]);
}

/** BB2025 pass range penalty: quick +0, short +1, long +2, bomb +3. */
export function rangeModifier(band: PassRangeBand): number {
  switch (band) {
    case 'quick': return 0;
    case 'short': return 1;
    case 'long':  return 2;
    case 'bomb':  return 3;
  }
}

/**
 * Pass target number for a passer throwing from `passerPos` to `targetPos`.
 *
 * BB2025 formula: max(2, min(6, pa + rangePenalty + tzCount))
 *   pa            = passer's passing ability stat
 *   rangePenalty  = +0 quick, +1 short, +2 long, +3 bomb
 *   tzCount       = opposing tackle zones covering the passer's square
 *
 * Returns null if target is out of range according to the BB2025 range ruler.
 */
export function passTargetAt(
  passerPos: Position,
  passerPa: number,
  targetPos: Position,
  opponentPositions: Position[],
): number | null {
  const band = rangeBandForPass(passerPos, targetPos);
  if (!band) return null;

  const rangePenalty = rangeModifier(band);
  const tzCount = opponentPositions.filter(op =>
    neighbours(op).some(n => n.col === passerPos.col && n.row === passerPos.row)
  ).length;

  return Math.min(6, Math.max(2, passerPa + rangePenalty + tzCount));
}

/**
 * Compute all throwable squares from `passerPos` and their BB2025 range bands.
 * Returns a Map from position key → band for every square in range.
 */
export function computePassRange(passerPos: Position): Map<string, PassRangeBand> {
  const result = new Map<string, PassRangeBand>();
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const pos: Position = { col: c, row: r };
      const band = rangeBandForPass(passerPos, pos);
      if (band) result.set(key(pos), band);
    }
  }
  return result;
}

/**
 * Compute the catch target for a handoff received at `receiverPos`.
 *
 * BB2020 handoff rule (accurate pass):
 *   base = 6 - AG
 *   −1 for accurate pass (handoff always counts as accurate)
 *   +1 per opposing tackle zone covering the receiver's square
 *   clamped to [2, 6]
 *
 * Example: AG 3, no TZs → 6 - 3 - 1 = 2+
 */
export function catchTargetAt(receiverPos: Position, receiverAg: number, opponentPositions: Position[]): number {
  const base = 6 - receiverAg - 1;
  const tzCount = opponentPositions.filter(op =>
    neighbours(op).some(n => n.col === receiverPos.col && n.row === receiverPos.row)
  ).length;
  return Math.min(6, Math.max(2, base + tzCount));
}

// ── Block / Blitz ─────────────────────────────────────────────────────────────

export type BlockOutcomeFace =
  | 'attacker-down' | 'both-down' | 'push' | 'defender-stumbles' | 'defender-down';

/** Number of the die's 6 physical faces that produce each outcome (3–4 = Push, 2 faces). */
const BLOCK_FACE_WEIGHTS: Record<BlockOutcomeFace, number> = {
  'attacker-down': 1,
  'both-down': 1,
  'push': 2,
  'defender-stumbles': 1,
  'defender-down': 1,
};

export const BLOCK_OUTCOME_FACES: BlockOutcomeFace[] = [
  'attacker-down', 'both-down', 'push', 'defender-stumbles', 'defender-down',
];

interface AssistCandidate {
  id: string;
  position: Position;
  down?: boolean;
}

/**
 * Flat count of adjacent teammates who can assist a block (excludes the
 * blocking player itself and any teammate who is `down`). No exclusion for
 * teammates who are themselves in an opponent's tackle zone, and no Guard
 * doubling — a simplified "flat adjacency count" per this project's scope.
 */
export function countAdjacentAssists(pos: Position, teammates: AssistCandidate[], excludeId: string): number {
  return teammates.filter(t =>
    t.id !== excludeId && !t.down && neighbours(pos).some(n => n.col === t.position.col && n.row === t.position.row)
  ).length;
}

/**
 * BB2020 block dice count + picker, from effective Strength (own ST + assists):
 *   attacker ST > 2x defender ST -> 3 dice, attacker picks
 *   attacker ST > defender ST    -> 2 dice, attacker picks
 *   attacker ST == defender ST   -> 1 die, no choice
 *   defender ST > attacker ST    -> 2 dice, defender picks
 *   defender ST > 2x attacker ST -> 3 dice, defender picks
 */
export function blockDiceCount(
  attackerSt: number,
  attackerAssists: number,
  defenderSt: number,
  defenderAssists: number,
): { diceCount: 1 | 2 | 3; picker: 'attacker' | 'defender' } {
  const aSt = attackerSt + attackerAssists;
  const dSt = defenderSt + defenderAssists;
  if (aSt > dSt * 2) return { diceCount: 3, picker: 'attacker' };
  if (dSt > aSt * 2) return { diceCount: 3, picker: 'defender' };
  if (aSt > dSt) return { diceCount: 2, picker: 'attacker' };
  if (dSt > aSt) return { diceCount: 2, picker: 'defender' };
  return { diceCount: 1, picker: 'attacker' };
}

/**
 * Combined probability that a block "succeeds" (per the outcome-checklist
 * model) for an arbitrary accepted subset of outcome faces:
 *   p = (number of physical die faces in the accepted set) / 6
 *   attacker picks -> P = 1 - (1 - p)^diceCount   (succeeds if ANY die matches)
 *   defender picks -> P = p^diceCount             (succeeds only if ALL dice match)
 */
export function blockCombinedProbability(
  acceptedFaces: BlockOutcomeFace[],
  diceCount: 1 | 2 | 3,
  picker: 'attacker' | 'defender',
): number {
  const weight = acceptedFaces.reduce((sum, f) => sum + BLOCK_FACE_WEIGHTS[f], 0);
  const p = weight / 6;
  return picker === 'attacker' ? 1 - Math.pow(1 - p, diceCount) : Math.pow(p, diceCount);
}

/**
 * Individual combined probability for each of the 5 outcome faces in
 * isolation (i.e. as if that were the only face checked), for UI display.
 */
export function blockOutcomeProbabilities(
  diceCount: 1 | 2 | 3,
  picker: 'attacker' | 'defender',
): Record<BlockOutcomeFace, number> {
  const result = {} as Record<BlockOutcomeFace, number>;
  for (const face of BLOCK_OUTCOME_FACES) {
    result[face] = blockCombinedProbability([face], diceCount, picker);
  }
  return result;
}

/**
 * Up to 3 on-pitch, unoccupied squares the defender could be pushed into,
 * directly away from the attacker (the BB "push chart" arc). Diagonal hits
 * push along the diagonal plus the two orthogonal flank squares; orthogonal
 * hits push straight back plus the two diagonal flank squares.
 */
export function pushBackCandidates(
  attackerPos: Position,
  defenderPos: Position,
  allPiecePositions: Position[],
): Position[] {
  const dx = Math.sign(defenderPos.col - attackerPos.col);
  const dy = Math.sign(defenderPos.row - attackerPos.row);

  let offsets: [number, number][];
  if (dx !== 0 && dy !== 0) {
    offsets = [[dx, dy], [dx, 0], [0, dy]];
  } else if (dx === 0) {
    offsets = [[0, dy], [-1, dy], [1, dy]];
  } else {
    offsets = [[dx, 0], [dx, -1], [dx, 1]];
  }

  const blocked = new Set(allPiecePositions.map(key));
  const result: Position[] = [];
  for (const [ox, oy] of offsets) {
    const sq: Position = { col: defenderPos.col + ox, row: defenderPos.row + oy };
    if (sq.col < 0 || sq.col >= COLS || sq.row < 0 || sq.row >= ROWS) continue;
    if (blocked.has(key(sq))) continue;
    result.push(sq);
  }
  return result;
}

/**
 * Find the shortest path (Chebyshev distance) from `origin` to `target`
 * within `ma` steps, avoiding blocked squares.
 *
 * Tiebreaker: among equal-length paths, prefer the one that stays closest
 * to the straight line between origin and target (minimise cross-product deviation).
 *
 * Returns the sequence of squares from origin (exclusive) to target (inclusive),
 * each annotated with whether a dodge is required to enter it.
 * Returns null if target is unreachable within ma.
 */
export function findShortestPath(
  origin: Position,
  target: Position,
  ma: number,
  allPiecePositions: Position[],
  opponentPositions: Position[],
  ag: number = 3,
  gfiRemaining: number = 0,
  ballPosition: Position | null = null,
): PathStep[] | null {
  const blockedKeys = new Set(allPiecePositions.map(key));
  const tzKeys = tacklezoneKeys(opponentPositions);
  const targetKey = key(target);
  const originKey = key(origin);
  const totalSteps = ma + gfiRemaining;

  if (blockedKeys.has(targetKey)) return null;
  if (originKey === targetKey) return [];

  const dx = target.col - origin.col;
  const dy = target.row - origin.row;

  function deviation(p: Position): number {
    return Math.abs(dx * (p.row - origin.row) - dy * (p.col - origin.col));
  }

  // Parent pointers instead of copying the whole path into every queued state —
  // the path is reconstructed once, on success.
  type Node = {
    pos: Position;
    steps: number;
    totalDeviation: number;
    step: PathStep | null;   // the step that arrived here (null at the origin)
    parent: Node | null;
  };

  function reconstruct(node: Node): PathStep[] {
    const path: PathStep[] = [];
    for (let current: Node | null = node; current?.step; current = current.parent) {
      path.push(current.step);
    }
    return path.reverse();
  }

  const visited = new Map<string, [number, number]>();
  const queue = new MinHeap<Node>();

  visited.set(`${originKey}:0`, [0, 0]);
  queue.push(0, { pos: origin, steps: 0, totalDeviation: 0, step: null, parent: null });

  while (queue.size > 0) {
    const node = queue.pop()!;
    const { pos, steps, totalDeviation } = node;

    if (key(pos) === targetKey) {
      return reconstruct(node);
    }

    if (steps >= totalSteps) continue;

    const leavingTZ = tzKeys.has(key(pos));
    // This step (departing from pos) costs a GFI if we've already used all normal MA
    const stepIsGfi = steps >= ma;

    for (const next of neighbours(pos)) {
      const nk = key(next);
      if (blockedKeys.has(nk)) continue;

      const newSteps = steps + 1;
      if (newSteps > totalSteps) continue;

      const needsDodge = leavingTZ;
      // State key: destination + whether this arrival required dodge + whether it cost GFI
      const stateKey = `${nk}:${needsDodge ? 1 : 0}:${stepIsGfi ? 1 : 0}`;
      const newDev = totalDeviation + deviation(next);

      const existing = visited.get(stateKey);
      if (existing) {
        const [prevSteps, prevDev] = existing;
        if (prevSteps < newSteps || (prevSteps === newSteps && prevDev <= newDev)) continue;
      }
      visited.set(stateKey, [newSteps, newDev]);

      const isBallSquare = ballPosition !== null && next.col === ballPosition.col && next.row === ballPosition.row;

      const step: PathStep = {
        pos: next,
        requiresDodge: needsDodge,
        dodgeTarget: needsDodge ? dodgeTargetAt(next, ag, opponentPositions) : null,
        isGfi: stepIsGfi,
        pickupTarget: isBallSquare ? pickupTargetAt(next, ag, opponentPositions) : null,
      };
      // Fewest steps first, straightest line as the tie-break.
      queue.push(newSteps * 10000 + newDev, {
        pos: next,
        steps: newSteps,
        totalDeviation: newDev,
        step,
        parent: node,
      });
    }
  }

  return null;
}
