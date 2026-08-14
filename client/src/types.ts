import type { PathStep, BlockOutcomeFace } from './bfs';

export type { BlockOutcomeFace };

export type Team = 'human' | 'orc';

/**
 * Portrait pitch coordinates — the orientation scenario JSON and the rules
 * engine both use. <Pitch> transposes these for its landscape rendering.
 */
export interface Position {
  col: number; // 0-indexed, 0..14
  row: number; // 0-indexed, 0..25
}

export interface PlayerPiece {
  id: string;
  team: Team;
  name: string;
  role?: string;  // e.g. 'thrower' | 'catcher' | 'lineman' | 'blocker' | 'guard' | 'tackle'
  position: Position;
  ma: number;
  st: number;
  ag: number;
  pa: number;    // passing ability (lower = better; 6 = can't pass reliably)
  av: number;
  skills: string[];
  activated: boolean;
  hasBall: boolean;
  down: boolean; // knocked down by a Block result — no tackle zone, cannot be activated
}

// ── Scenario ────────────────────────────────────────────────────────────────

export interface ScenarioPieceDef {
  id: string;
  team: Team;
  role?: string;
  name: string;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  skills: string[];
  position: Position;
  hasBall: boolean;
  down?: boolean; // defaults to false — piece starts knocked down
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  activeTeam: Team;
  published?: boolean;
  ballPosition?: Position | null;
  pieces: ScenarioPieceDef[];
}

export interface SeriesDefinition {
  id: string;
  name: string;
  description: string;
  scenarioIds: string[];
}

// ── Game ────────────────────────────────────────────────────────────────────

export type MoveLogEntry = {
  kind: 'move';
  pieceName: string;
  pieceRole: string;
  from: Position;
  to: Position;
  steps: number;
  dodgeTarget: number | null;  // null = free move
  dodgeSkillReroll?: boolean;  // Dodge skill contributes its once-per-activation reroll
  isGfi: boolean;              // true = Go For It step (2+ roll)
  pickupTarget?: number | null; // Agility test to pick up a loose ball on this step, null/undefined = no pickup
  actionProb: number;          // probability of this step alone (1 if no roll needed)
  cumulativeProb: number;      // running product up to and including this step
};

export type HandoffLogEntry = {
  kind: 'handoff';
  pieceName: string;       // carrier
  pieceRole: string;
  receiverName: string;
  receiverRole: string;
  from: Position;          // carrier position
  to: Position;            // receiver position
  catchTarget: number;     // roll needed (e.g. 2)
  actionProb: number;      // success chance of this roll alone
  cumulativeProb: number;  // running product including this roll
  // These mirror MoveLogEntry fields so existing risky-move filters work unchanged
  dodgeTarget: null;
  isGfi: false;
};

export type PassLogEntry = {
  kind: 'pass';
  pieceName: string;        // passer
  pieceRole: string;
  receiverName: string;
  receiverRole: string;
  from: Position;           // passer position
  to: Position;             // target square
  passTarget: number;       // pass roll needed
  rangeBand: 'quick' | 'short' | 'long' | 'bomb';
  actionProb: number;       // P(accurate pass roll alone)
  cumulativeProb: number;
  dodgeTarget: null;
  isGfi: false;
};

export type PassCatchLogEntry = {
  kind: 'pass-catch';
  pieceName: string;        // receiver
  pieceRole: string;
  from: Position;           // target square
  to: Position;             // same as from
  catchTarget: number;
  actionProb: number;       // P(catch roll alone)
  cumulativeProb: number;
  dodgeTarget: null;
  isGfi: false;
};

export type BlockLogEntry = {
  kind: 'block';
  isBlitz: boolean;
  pieceName: string;         // attacker
  pieceRole: string;
  receiverName: string;      // defender (reuse receiver* fields for RiskyMove compat)
  receiverRole: string;
  from: Position;            // attacker position (post-move, if Blitz)
  to: Position;               // defender position
  diceCount: 1 | 2 | 3;
  picker: 'attacker' | 'defender';
  outcomeProbs: Record<BlockOutcomeFace, number>; // probability of each face occurring at least/only as required by picker
  acceptedFaces: BlockOutcomeFace[];  // faces the player checked
  resolvedFace: BlockOutcomeFace;     // the single face the game continues from
  actionProb: number;         // combined probability of acceptedFaces per the formula above
  cumulativeProb: number;
  // These mirror MoveLogEntry fields so existing risky-move filters work unchanged
  dodgeTarget: null;
  isGfi: false;
};

export type ActionLogEntry = MoveLogEntry | HandoffLogEntry | PassLogEntry | PassCatchLogEntry | BlockLogEntry;

/** A puzzle is a single turn: you are either still playing it or you scored. */
export type GamePhase =
  | 'playing'
  | 'touchdown';

export type AppMode =
  | 'home'
  | 'puzzle'
  | 'leaderboard'
  | 'admin'
  | 'series-puzzle'
  | 'series-leaderboard'
  | 'settings';

/** Board state captured when an activation begins, so a cancel can rewind it. */
export interface ActivationSnapshot {
  pieces: PlayerPiece[];
  ballPosition: Position | null;
}

export interface GameState {
  pieces: PlayerPiece[];
  activeTeam: Team;
  selectedPieceId: string | null;
  // All squares reachable within remaining MA (for click validation)
  reachableKeys: Set<string>;
  originPos: Position | null;
  // Squares committed so far this activation (piece stays at origin until the
  // activation is finalized by clicking it again)
  committedPath: Position[];
  walkedSquares: Position[];
  // Hover preview: shortest path from path tip to hovered square
  pathPreview: PathStep[];
  remainingMa: number;
  remainingGfi: number;        // GFI steps still available (max 2, resets each activation)
  // Dodge targets queued along the committed path, shown as pending dice
  pendingDodgeTargets: number[];
  // Among the activation's still-successful outcomes, the fraction where the
  // Dodge skill reroll remains unused. Zero means the player has no available
  // Dodge reroll; one means every successful outcome still has it.
  dodgeRerollAvailability: number;
  phase: GamePhase;
  activationLogStart: number;  // actionLog.length when current piece was selected (for cancel rollback)
  // Board as it was when the current activation began. Sub-steps such as Blitz
  // movement and loose-ball pickup commit to the board before the activation
  // ends, so cancelling must restore this alongside truncating the log —
  // otherwise the movement survives while its probability cost is refunded.
  activationSnapshot: ActivationSnapshot | null;
  pendingProb: number;         // product of all pending roll probabilities this activation
  actionLog: ActionLogEntry[];
  scenarioId: string | null;
  // Loose ball on the pitch, not carried by any piece (null once picked up)
  ballPosition: Position | null;
  // Handoff / Pass (shared passUsed flag — one per turn)
  passUsed: boolean;
  // Handoff
  pendingHandoff: boolean;
  isHandoffTargeting: boolean;
  handoffTargets: Set<string>;
  // Pass
  pendingPass: boolean;
  isPassTargeting: boolean;
  passRangeKeys: Map<string, 'quick' | 'short' | 'long' | 'bomb'>;
  passReceiverKeys: Set<string>;
  // Block / Blitz (one Blitz per turn; plain Block has no limit)
  blitzUsed: boolean;
  // Id of the piece currently spending its post-Blitz leftover movement (its
  // block already resolved and committed to `pieces`, but it isn't marked
  // `activated` yet so it can keep moving). Selecting a different piece must
  // finalize this one first — otherwise it stays reselectable later with a
  // fresh full MA pool, effectively granting free extra movement.
  blitzResumeId: string | null;
  pendingBlock: boolean;         // declared Block/Blitz — move first (Blitz only) then pick target
  pendingBlockIsBlitz: boolean;  // whether the current pendingBlock/isBlockTargeting sequence is a Blitz (persists across the movement step, since blockChoice isn't set until a target is picked)
  blitzTargetId: string | null;  // chosen defender for a Blitz; selected before movement begins
  isBlockTargeting: boolean;     // choosing which adjacent opponent to block
  blockTargets: Set<string>;     // adjacent opposing squares eligible to block
  blockChoice: {                 // set once a defender is targeted, before resolving
    defenderId: string;
    isBlitz: boolean;
    diceCount: 1 | 2 | 3;
    picker: 'attacker' | 'defender';
    outcomeProbs: Record<BlockOutcomeFace, number>;
  } | null;
  pushTargetKeys: Set<string>;   // candidate push-back squares once an outcome is resolved
  // Set once the outcome checklist is confirmed, if the resolved face requires
  // a push-back square choice (push / defender-stumbles-falls / defender-down).
  // Cleared once the push (and, for defender-down, follow-up) choice is made.
  pendingBlockResolution: {
    attackerId: string;
    defenderId: string;
    resolvedFace: BlockOutcomeFace;
    defenderFalls: boolean;    // whether the defender is marked `down` once pushed
    defenderFrom: Position;    // defender's pre-push square (needed for follow-up)
    offerFollowUp: boolean;    // true only for a defender-down resolution
    isBlitz: boolean;          // resume any remaining movement after resolving the push
  } | null;
}

// ── Leaderboard ─────────────────────────────────────────────────────────────

export interface RiskyMove {
  pieceName: string;
  pieceRole: string;
  receiverName?: string;                              // handoff / pass
  receiverRole?: string;                              // handoff / pass
  from: Position;
  to: Position;
  dodgeTarget: number | null;
  dodgeSkillReroll?: boolean;                         // movement Dodge skill reroll contributed
  isGfi: boolean;
  pickupTarget?: number | null;                       // loose-ball pickup
  catchTarget?: number;                               // handoff / pass-catch
  passTarget?: number;                                // pass
  rangeBand?: 'quick' | 'short' | 'long' | 'bomb';  // pass
  isBlitz?: boolean;                                  // block
  diceCount?: 1 | 2 | 3;                               // block
  picker?: 'attacker' | 'defender';                   // block
  acceptedFaces?: BlockOutcomeFace[];                  // block
  resolvedFace?: BlockOutcomeFace;                     // block
  actionProb: number;
  cumulativeProb: number;
}

export interface LeaderboardEntry {
  id: string;
  scenarioId: string;
  name: string;
  probability: number;
  diceCount: number;
  date: string;
  moves: RiskyMove[];
  userId?: string;
  authProvider?: 'google';
}

// ── Series ──────────────────────────────────────────────────────────────────

/** One puzzle's result as recorded within a series run. */
export interface SeriesPuzzleResult {
  scenarioId: string;
  scenarioName: string;
  probability: number;
  diceCount: number;
  moves: RiskyMove[];
}

export interface SeriesLeaderboardEntry {
  id: string;
  name: string;
  probability: number;   // average of the puzzle probabilities
  diceCount: number;     // total dice rolls across all puzzles (tie-break)
  date: string;
  puzzles: SeriesPuzzleResult[];
  userId?: string;
  authProvider?: 'google';
}
