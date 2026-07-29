import { useState, useCallback, useEffect } from 'react';
import { useGameState, makeFreePlayState, makeScenarioState } from './useGameState';
import { Pitch } from './Pitch';
import { PieceMenu } from './PieceMenu';
import type { PieceMenuAction } from './PieceMenu';
import { PlayerPanel } from './PlayerPanel';
import { DiceLog } from './DiceLog';
import { PhaseModal } from './PhaseModal';
import { ScenarioSelect } from './ScenarioSelect';
import { SubmitModal } from './SubmitModal';
import { Leaderboard } from './Leaderboard';
import { ScoreSummary } from './ScoreSummary';
import { SeriesLeaderboard } from './SeriesLeaderboard';
import { SeriesScoreSummary } from './SeriesScoreSummary';
import { ConfirmDialog } from './ConfirmDialog';
import { UserMenu } from './UserMenu';
import { submitScore, fetchLeaderboard, submitSeriesScore, fetchSeriesLeaderboard } from './api';
import { resolveSeriesScenarios } from './series';
import { loadScenarioData } from './scenarios/runtime';
import type { ScenarioData } from './scenarios/runtime';
import { scenarios as staticScenarios } from './scenarios';
import { defaultSeries as staticSeries } from './series';
import { PuzzleEditor } from './editor/PuzzleEditor';
import { useAuth } from './auth';
import type {
  AppMode, PlayerPiece, Scenario, LeaderboardEntry,
  SeriesLeaderboardEntry, SeriesPuzzleResult, RiskyMove, ActionLogEntry,
} from './types';
import { key, computeZoomBounds } from './bfs';
import type { ZoomBounds } from './bfs';
import './App.css';

const TURNS_PER_HALF = 8;
const LOCAL_SCORE_KEY = 'bbt.localScores.v1';
const GUEST_NAME_KEY = 'bbt.guestName.v1';

// Client-side allowlist controlling whether the "Admin Mode" button is shown at
// all — this is a UX nicety only, NOT the security boundary. The actual write
// endpoints (netlify/functions/editor-*.js, server/editor.js) independently
// verify the signed-in user's Google identity token against the server-side
// ADMIN_EMAILS env var, so hiding this button doesn't grant write access and
// showing it doesn't bypass the server check. Keep the two lists in sync.
const ADMIN_EMAILS = new Set(
  (import.meta.env.VITE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean),
);

type LocalScoreMap = Record<string, string[]>;

function readGuestName(): string {
  try {
    return window.localStorage.getItem(GUEST_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeGuestName(name: string): void {
  try {
    window.localStorage.setItem(GUEST_NAME_KEY, name);
  } catch {
    // Storage unavailable — guest name just won't persist across refreshes.
  }
}

function readLocalScores(): LocalScoreMap {
  try {
    const raw = window.localStorage.getItem(LOCAL_SCORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as LocalScoreMap : {};
  } catch {
    return {};
  }
}

function rememberLocalScore(scenarioId: string, entryId: string): void {
  const scores = readLocalScores();
  const scenarioScores = scores[scenarioId] ?? [];
  scores[scenarioId] = scenarioScores.includes(entryId)
    ? scenarioScores
    : [...scenarioScores, entryId];
  window.localStorage.setItem(LOCAL_SCORE_KEY, JSON.stringify(scores));
}

/** Build the risky-moves list + summary stats from a completed puzzle's action log. */
function summarizeActionLog(actionLog: ActionLogEntry[]) {
  const cumulativeProb = actionLog.length > 0
    ? actionLog[actionLog.length - 1].cumulativeProb
    : 1;
  const riskyMoves = actionLog.filter(e =>
    e.kind === 'handoff' || e.kind === 'pass' || e.kind === 'pass-catch' ||
    e.dodgeTarget !== null || e.isGfi || (e.kind === 'move' && !!e.pickupTarget)
  );
  const diceCount = riskyMoves.length;
  const moves: RiskyMove[] = riskyMoves.map(e => {
    if (e.kind === 'handoff') {
      return {
        pieceName: e.pieceName, pieceRole: e.pieceRole,
        receiverName: e.receiverName, receiverRole: e.receiverRole,
        from: e.from, to: e.to,
        dodgeTarget: null, isGfi: false,
        catchTarget: e.catchTarget,
        actionProb: e.actionProb, cumulativeProb: e.cumulativeProb,
      };
    }
    if (e.kind === 'pass') {
      return {
        pieceName: e.pieceName, pieceRole: e.pieceRole,
        receiverName: e.receiverName, receiverRole: e.receiverRole,
        from: e.from, to: e.to,
        dodgeTarget: null, isGfi: false,
        passTarget: e.passTarget, rangeBand: e.rangeBand,
        actionProb: e.actionProb, cumulativeProb: e.cumulativeProb,
      };
    }
    if (e.kind === 'pass-catch') {
      return {
        pieceName: e.pieceName, pieceRole: e.pieceRole,
        from: e.from, to: e.to,
        dodgeTarget: null, isGfi: false,
        catchTarget: e.catchTarget,
        actionProb: e.actionProb, cumulativeProb: e.cumulativeProb,
      };
    }
    return {
      pieceName: e.pieceName, pieceRole: e.pieceRole,
      from: e.from, to: e.to,
      dodgeTarget: e.dodgeTarget, isGfi: e.isGfi,
      pickupTarget: e.pickupTarget ?? null,
      actionProb: e.actionProb, cumulativeProb: e.cumulativeProb,
    };
  });
  return { cumulativeProb, diceCount, moves };
}

interface SeriesRunState {
  playerName: string;
  puzzleIndex: number;           // 0-based index into the active series
  results: SeriesPuzzleResult[]; // one entry per completed puzzle so far
}

interface IdentityGateProps {
  authConfigured: boolean;
  onGoogleSignIn: () => Promise<void>;
  onGuest: (name: string) => void;
}

function IdentityGate({ authConfigured, onGoogleSignIn, onGuest }: IdentityGateProps) {
  const [guestMode, setGuestMode] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  async function handleGoogleSignIn() {
    setSigningIn(true);
    try {
      await onGoogleSignIn();
    } finally {
      setSigningIn(false);
    }
  }

  function submitGuest() {
    const trimmed = guestName.trim();
    if (!trimmed) return;
    onGuest(trimmed);
  }

  return (
    <div className="identity-gate">
      <div className="identity-gate__panel">
        <div className="identity-gate__header">
          <h1 className="identity-gate__title">BB Tactics</h1>
          <p className="identity-gate__subtitle">
            Choose how your leaderboard runs should be identified.
          </p>
        </div>

        <div className="identity-gate__actions">
          <button
            className="btn btn--primary"
            disabled={!authConfigured || signingIn}
            onClick={() => { void handleGoogleSignIn(); }}
          >
            {authConfigured ? 'Log In With Google' : 'Google Login Unavailable'}
          </button>
          <button className="btn btn--secondary" onClick={() => setGuestMode(true)}>
            Play As Guest
          </button>
        </div>

        {guestMode && (
          <div className="identity-gate__guest">
            <label className="identity-gate__label" htmlFor="guest-name">Guest name</label>
            <div className="identity-gate__guest-row">
              <input
                id="guest-name"
                className="identity-gate__input"
                type="text"
                maxLength={32}
                placeholder="Your name"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitGuest()}
                autoFocus
              />
              <button className="btn btn--primary" disabled={!guestName.trim()} onClick={submitGuest}>
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const { currentUser, idToken, isConfigured: authConfigured, signIn, signOut } = useAuth();
  // Scenario/series data starts as the build-time static bundle (immediate,
  // no loading flash) and is replaced by the currently published set fetched
  // from /api/scenarios once that resolves — see scenarios/runtime.ts.
  const [scenarioData, setScenarioData] = useState<ScenarioData>(() => ({
    scenarios: staticScenarios,
    series: staticSeries,
  }));
  const seriesScenarios = resolveSeriesScenarios(scenarioData.series, scenarioData.scenarios);
  const [guestName, setGuestNameState] = useState(readGuestName);
  const setGuestName = useCallback((name: string) => {
    setGuestNameState(name);
    writeGuestName(name);
  }, []);
  const [appMode, setAppMode] = useState<AppMode>('home');
  // Re-fetch whenever the player lands on the home/select screen (including on
  // first load) so a scenario published while this tab was open — or before
  // this tab was ever opened — shows up without a hard refresh. Cheap no-op if
  // nothing changed since /api/scenarios falls back to the static bundle on
  // failure and the fetch itself is a single small JSON payload.
  useEffect(() => {
    if (appMode !== 'home') return;
    let cancelled = false;
    void loadScenarioData().then(data => { if (!cancelled) setScenarioData(data); });
    return () => { cancelled = true; };
  }, [appMode]);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [leaderboardHighlight, setLeaderboardHighlight] = useState<string | undefined>();
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState(0);
  const [leaderboardInitialEntries, setLeaderboardInitialEntries] = useState<LeaderboardEntry[] | undefined>();
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | undefined>();
  const [progressRefreshKey, setProgressRefreshKey] = useState(0);
  const [editorPreviewScenario, setEditorPreviewScenario] = useState<Scenario | null>(null);

  // ── Series mode state ──────────────────────────────────────────────────
  const [seriesRun, setSeriesRun] = useState<SeriesRunState | null>(null);
  const [seriesHighlight, setSeriesHighlight] = useState<string | undefined>();
  const [seriesRefreshKey, setSeriesRefreshKey] = useState(0);
  const [seriesInitialEntries, setSeriesInitialEntries] = useState<SeriesLeaderboardEntry[] | undefined>();
  const [selectedSeriesEntry, setSelectedSeriesEntry] = useState<SeriesLeaderboardEntry | undefined>();
  const [confirmLeaveSeries, setConfirmLeaveSeries] = useState(false);

  // ── Zoom mode ────────────────────────────────────────────────────────────
  // Computed once when play starts (not recalculated as moves are made or
  // pieces are selected). Radius is the largest MA among the player's own
  // team's pieces, plus 2 for GFI/rush squares.
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [zoomBounds, setZoomBounds] = useState<ZoomBounds | null>(null);

  const computeStartOfPlayZoom = useCallback((pieces: PlayerPiece[], activeTeam: string): ZoomBounds | null => {
    const ownPieces = pieces.filter(p => p.team === activeTeam);
    if (ownPieces.length === 0) return null;
    const maxMa = Math.max(...ownPieces.map(p => p.ma));
    const radius = maxMa + 2; // MA + max GFI (2 rush squares)
    const positions = ownPieces.flatMap(p => [
      { col: p.position.col - radius, row: p.position.row - radius },
      { col: p.position.col + radius, row: p.position.row + radius },
    ]);
    return computeZoomBounds(positions, 1);
  }, []);

  // Game state — reinitialised when mode/scenario changes
  const { state, setState, handleSquareClick: hookSquareClick, handleSquareHover: hookSquareHover,
          handleSquareLeave: hookSquareLeave, handleCancelSelection,
          handleContinue, handleHandoffAction, handleHandoffTarget,
          handlePassAction, handlePassTarget }
    = useGameState(makeFreePlayState());

  const identityName = currentUser?.displayName ?? guestName;
  const identityReady = Boolean(identityName.trim());
  const identityAvatarUrl = currentUser?.avatarUrl;
  // Empty ADMIN_EMAILS (unset in this environment) means "show to everyone" —
  // matches the server-side fallback in requireAdminGoogleUser, keeping local
  // dev usable without any Google OAuth/admin config.
  const isAdmin = ADMIN_EMAILS.size === 0
    || Boolean(currentUser?.email && ADMIN_EMAILS.has(currentUser.email.toLowerCase()));
  // Defense in depth: appMode is client-only state with no URL routing, so this
  // shouldn't be reachable since the Admin Mode button is hidden for non-admins.
  // The real gate is server-side (ADMIN_EMAILS check on the write endpoints).
  // Render 'home' instead of setState-in-effect to avoid an extra render pass.
  const effectiveAppMode = appMode === 'admin' && !isAdmin ? 'home' : appMode;

  const handleSignOut = useCallback(() => {
    if (currentUser) {
      signOut();
    } else {
      setGuestName('');
    }
    setAppMode('home');
  }, [currentUser, signOut, setGuestName]);

  const startPuzzle = useCallback((scenario: Scenario) => {
    setEditorPreviewScenario(null);
    setActiveScenario(scenario);
    const s = makeScenarioState(scenario);
    setState(s);
    setZoomBounds(computeStartOfPlayZoom(s.pieces, s.activeTeam));
    setAppMode('puzzle');
  }, [setState, computeStartOfPlayZoom]);

  const previewPuzzle = useCallback((scenario: Scenario) => {
    setEditorPreviewScenario(scenario);
    setActiveScenario(scenario);
    const s = makeScenarioState(scenario);
    setState(s);
    setZoomBounds(computeStartOfPlayZoom(s.pieces, s.activeTeam));
    setAppMode('puzzle');
  }, [setState, computeStartOfPlayZoom]);

  const goLeaderboard = useCallback((scenario: Scenario) => {
    setActiveScenario(scenario);
    setLeaderboardHighlight(undefined);
    setAppMode('leaderboard');
  }, []);

  // Route square clicks: targeting modes take priority over normal movement
  const handleSquareClick = useCallback((col: number, row: number) => {
    if (state.isHandoffTargeting) {
      handleHandoffTarget(col, row);
    } else if (state.isPassTargeting) {
      handlePassTarget(col, row);
    } else {
      hookSquareClick(col, row);
    }
  }, [state.isHandoffTargeting, state.isPassTargeting, handleHandoffTarget, handlePassTarget, hookSquareClick]);

  // Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCancelSelection(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCancelSelection]);

  // Context menu state
  const [pieceMenu, setPieceMenu] = useState<{ piece: PlayerPiece; x: number; y: number } | null>(null);

  const handlePieceClick = useCallback((col: number, row: number, x: number, y: number) => {
    const k = key({ col, row });
    const piece = state.pieces.find(p => key(p.position) === k);
    if (!piece) return;

    // During handoff targeting, clicking a highlighted receiver executes the handoff
    if (state.isHandoffTargeting) {
      if (state.handoffTargets.has(k)) {
        handleHandoffTarget(col, row);
      } else {
        handleCancelSelection();
      }
      return;
    }

    // During pass targeting, clicking a highlighted receiver executes the pass
    if (state.isPassTargeting) {
      if (state.passReceiverKeys.has(k)) {
        handlePassTarget(col, row);
      } else {
        handleCancelSelection();
      }
      return;
    }

    // If a piece is already selected and this is a reachable square — treat as a move waypoint
    if (state.selectedPieceId && state.reachableKeys.has(k)) {
      hookSquareClick(col, row);
      return;
    }

    // Clicking the already-selected piece ends activation
    if (piece.id === state.selectedPieceId) {
      hookSquareClick(col, row);
      return;
    }

    // Own unactivated piece — show context menu
    if (piece.team === state.activeTeam && !piece.activated) {
      setPieceMenu({ piece, x, y });
      return;
    }

    // Anything else (opponent, activated piece) — fall through to normal click
    hookSquareClick(col, row);
  }, [state.pieces, state.selectedPieceId, state.reachableKeys, state.activeTeam,
      state.isHandoffTargeting, state.handoffTargets, state.isPassTargeting, state.passReceiverKeys,
      hookSquareClick, handleHandoffTarget, handlePassTarget, handleCancelSelection]);

  const handleMenuAction = useCallback((actionKey: string) => {
    if (!pieceMenu) return;
    setPieceMenu(null);
    if (actionKey === 'move') {
      const { col, row } = pieceMenu.piece.position;
      hookSquareClick(col, row);
    } else if (actionKey === 'handoff') {
      handleHandoffAction(pieceMenu.piece.id);
    } else if (actionKey === 'pass') {
      handlePassAction(pieceMenu.piece.id);
    }
  }, [pieceMenu, hookSquareClick, handleHandoffAction, handlePassAction]);

  const dismissMenu = useCallback(() => setPieceMenu(null), []);

  // Hover state for the shared player card — combined with movement hover
  const [hoveredPiece, setHoveredPiece] = useState<PlayerPiece | null>(null);
  const handleSquareHover = useCallback((col: number, row: number) => {
    // Update movement preview in game state
    hookSquareHover(col, row);
    const k = key({ col, row });
    const piece = state.pieces.find(p => key(p.position) === k);
    setHoveredPiece(piece ?? null);
  }, [hookSquareHover, state.pieces]);
  const handleSquareLeave = useCallback(() => {
    hookSquareLeave();
    setHoveredPiece(null);
  }, [hookSquareLeave]);

  // Submission handler (standalone puzzle mode)
  const handleSubmit = useCallback(async (name: string) => {
    if (!activeScenario) return;
    const { cumulativeProb, diceCount, moves } = summarizeActionLog(state.actionLog);
    try {
      const entry = await submitScore(activeScenario.id, name, cumulativeProb, diceCount, moves, idToken);
      rememberLocalScore(activeScenario.id, entry.id);
      setLeaderboardHighlight(entry.id);
      setProgressRefreshKey(k => k + 1);
      setState(s => ({ ...s, phase: 'playing' }));
      setAppMode('leaderboard');
      await new Promise(res => setTimeout(res, 3000));
      const entries = await fetchLeaderboard(activeScenario.id);
      setLeaderboardInitialEntries(entries);
      setLeaderboardRefreshKey(k => k + 1);
    } catch {
      setState(s => ({ ...s, phase: 'playing' }));
      setAppMode('leaderboard');
    }
  }, [activeScenario, state.actionLog, setState, idToken]);

  const handleSkipSubmit = useCallback(() => {
    setState(s => ({ ...s, phase: 'playing' }));
    setAppMode('home');
  }, [setState]);

  const handleRestartTurn = useCallback(() => {
    if (!activeScenario) return;
    const s = makeScenarioState(activeScenario);
    setState(s);
    setZoomBounds(computeStartOfPlayZoom(s.pieces, s.activeTeam));
  }, [activeScenario, setState, computeStartOfPlayZoom]);

  // ── Series mode handlers ──────────────────────────────────────────────────
  const startSeries = useCallback(() => {
    if (!identityName.trim()) return;
    const firstScenario = seriesScenarios[0];
    if (!firstScenario) return;
    setSeriesRun({ playerName: identityName, puzzleIndex: 0, results: [] });
    setActiveScenario(firstScenario);
    const s = makeScenarioState(firstScenario);
    setState(s);
    setZoomBounds(computeStartOfPlayZoom(s.pieces, s.activeTeam));
    setAppMode('series-puzzle');
  }, [identityName, seriesScenarios, setState, computeStartOfPlayZoom]);

  // Called when the player continues past a touchdown while in a series run.
  // Submits the puzzle's score to its individual leaderboard, records the
  // result, then either advances to the next puzzle or finalizes the series.
  const handleSeriesContinue = useCallback(async () => {
    if (!activeScenario || !seriesRun) return;
    const { cumulativeProb, diceCount, moves } = summarizeActionLog(state.actionLog);

    // Submit to the puzzle's own leaderboard too (best-effort — series flow
    // continues even if this fails).
    try {
      await submitScore(activeScenario.id, seriesRun.playerName, cumulativeProb, diceCount, moves, idToken);
    } catch {
      // Individual leaderboard submission is best-effort in series mode.
    }

    const result: SeriesPuzzleResult = {
      scenarioId: activeScenario.id,
      scenarioName: activeScenario.name,
      probability: cumulativeProb,
      diceCount,
      moves,
    };
    const results = [...seriesRun.results, result];
    const nextIndex = seriesRun.puzzleIndex + 1;

    if (nextIndex < seriesScenarios.length) {
      const nextScenario = seriesScenarios[nextIndex];
      setSeriesRun({ ...seriesRun, puzzleIndex: nextIndex, results });
      setActiveScenario(nextScenario);
      const s = makeScenarioState(nextScenario);
      setState(s);
      setZoomBounds(computeStartOfPlayZoom(s.pieces, s.activeTeam));
      return;
    }

    // Series complete — compute average and submit to the series leaderboard.
    const avgProbability = results.reduce((sum, r) => sum + r.probability, 0) / results.length;
    const totalDice = results.reduce((sum, r) => sum + r.diceCount, 0);
    try {
      const entry = await submitSeriesScore(seriesRun.playerName, avgProbability, totalDice, results, idToken);
      rememberLocalScore('series', entry.id);
      setSeriesHighlight(entry.id);
      setProgressRefreshKey(k => k + 1);
      setState(s => ({ ...s, phase: 'playing' }));
      setSeriesRun(null);
      setAppMode('series-leaderboard');
      // The backing store can take a moment to become read-consistent after a
      // write, so wait before re-fetching (mirrors the individual leaderboard).
      await new Promise(res => setTimeout(res, 3000));
      const entries = await fetchSeriesLeaderboard();
      setSeriesInitialEntries(entries);
      setSeriesRefreshKey(k => k + 1);
    } catch {
      setSeriesHighlight(undefined);
      setState(s => ({ ...s, phase: 'playing' }));
      setSeriesRun(null);
      setAppMode('series-leaderboard');
    }
  }, [activeScenario, seriesRun, seriesScenarios, state.actionLog, setState, idToken, computeStartOfPlayZoom]);

  const requestLeaveSeries = useCallback(() => {
    setConfirmLeaveSeries(true);
  }, []);

  const confirmLeaveSeriesYes = useCallback(() => {
    setConfirmLeaveSeries(false);
    setSeriesRun(null);
    setAppMode('home');
  }, []);

  const confirmLeaveSeriesNo = useCallback(() => {
    setConfirmLeaveSeries(false);
  }, []);

  const handleBackClick = useCallback(() => {
    if (appMode === 'series-puzzle') {
      requestLeaveSeries();
    } else if (editorPreviewScenario) {
      setAppMode('admin');
    } else {
      setAppMode('home');
    }
  }, [appMode, editorPreviewScenario, requestLeaveSeries]);

  // ── Render: non-game screens ─────────────────────────────────────────────
  if (!identityReady) {
    return (
      <div className="app app--home">
        <IdentityGate
          authConfigured={authConfigured}
          onGoogleSignIn={signIn}
          onGuest={setGuestName}
        />
      </div>
    );
  }

  if (effectiveAppMode === 'home') {
    return (
      <div className="app app--home">
        <UserMenu name={identityName} avatarUrl={identityAvatarUrl} onSignOut={handleSignOut} />
        <ScenarioSelect
          scenarios={scenarioData.scenarios}
          series={scenarioData.series}
          onPlay={startPuzzle}
          onLeaderboard={goLeaderboard}
          onStartSeries={startSeries}
          onSeriesLeaderboard={() => { setSeriesHighlight(undefined); setSeriesInitialEntries(undefined); setAppMode('series-leaderboard'); }}
          onAdmin={() => setAppMode('admin')}
          progressRefreshKey={progressRefreshKey}
          userId={currentUser?.id}
          isAdmin={isAdmin}
        />
      </div>
    );
  }

  if (effectiveAppMode === 'series-leaderboard') {
    if (selectedSeriesEntry) {
      return (
        <div className="app app--home">
          <UserMenu name={identityName} avatarUrl={identityAvatarUrl} onSignOut={handleSignOut} />
          <SeriesScoreSummary
            entry={selectedSeriesEntry}
            onBack={() => setSelectedSeriesEntry(undefined)}
          />
        </div>
      );
    }
    return (
      <div className="app app--home">
        <UserMenu name={identityName} avatarUrl={identityAvatarUrl} onSignOut={handleSignOut} />
        <SeriesLeaderboard
          key={seriesRefreshKey}
          onBack={() => { setSeriesInitialEntries(undefined); setAppMode('home'); }}
          highlightId={seriesHighlight}
          initialEntries={seriesInitialEntries}
          onEntriesLoaded={setSeriesInitialEntries}
          onRowClick={setSelectedSeriesEntry}
        />
      </div>
    );
  }

  if (effectiveAppMode === 'admin') {
    return (
      <div className="app app--home">
        <UserMenu name={identityName} avatarUrl={identityAvatarUrl} onSignOut={handleSignOut} />
        <PuzzleEditor
          onBack={() => setAppMode('home')}
          onPlay={previewPuzzle}
          previewScenario={editorPreviewScenario}
          idToken={idToken}
        />
      </div>
    );
  }

  if (effectiveAppMode === 'leaderboard' && activeScenario) {
    if (selectedEntry) {
      return (
        <div className="app app--home">
          <UserMenu name={identityName} avatarUrl={identityAvatarUrl} onSignOut={handleSignOut} />
          <ScoreSummary
            entry={selectedEntry}
            onBack={() => setSelectedEntry(undefined)}
          />
        </div>
      );
    }
    return (
      <div className="app app--home">
        <UserMenu name={identityName} avatarUrl={identityAvatarUrl} onSignOut={handleSignOut} />
        <Leaderboard
          key={leaderboardRefreshKey}
          scenario={activeScenario}
          onBack={() => { setLeaderboardInitialEntries(undefined); setAppMode('home'); }}
          highlightId={leaderboardHighlight}
          initialEntries={leaderboardInitialEntries}
          onEntriesLoaded={setLeaderboardInitialEntries}
          onRowClick={setSelectedEntry}
        />
      </div>
    );
  }

  // ── Game screen (freeplay or puzzle) ─────────────────────────────────────
  const selectedPiece = state.selectedPieceId
    ? state.pieces.find(p => p.id === state.selectedPieceId) ?? null
    : null;
  const inspectedPiece = hoveredPiece ?? selectedPiece;

  const teamLabel = state.activeTeam === 'human' ? 'Human' : 'Orc';
  const activePiece = state.pieces.find(p => p.team === state.activeTeam);
  const activationStatus = state.isHandoffTargeting
    ? 'Select a receiver to hand off to · Esc to cancel'
    : state.isPassTargeting
    ? 'Select a receiver to throw to · Esc to cancel'
    : state.pendingHandoff
    ? `Hand Off declared — move up to ${state.remainingMa} MA, then click piece to hand off · Esc to cancel`
    : state.pendingPass
    ? `Pass declared — move up to ${state.remainingMa} MA, then click piece to throw · Esc to cancel`
    : activePiece?.activated && !state.selectedPieceId
    ? 'Piece activated — end your turn'
    : state.selectedPieceId
    ? `Planning — ${state.remainingMa} MA left · Esc to cancel`
    : 'Select your piece to move';

  const currentTurn = state.activeTeam === 'human' ? state.humanTurn : state.orcTurn;
  const displayTurn = Math.min(currentTurn, TURNS_PER_HALF);

  // Live probability: committed actions × pending dodges not yet committed
  const lastCommittedProb = state.actionLog.length > 0
    ? state.actionLog[state.actionLog.length - 1].cumulativeProb : 1;
  const liveProbPct = Math.round(lastCommittedProb * state.pendingProb * 100);
  // Always show in puzzle mode — starts at 100% and decreases as risky moves are added
  // (showProb removed — always visible)

  return (
    <div className="app">
      <header className="hud">
        <button className="hud__back" onClick={handleBackClick}>{editorPreviewScenario ? '← Designer' : '← Menu'}</button>

        {!state.isPuzzleMode && (
          <div className="hud__score">
            <span className="hud__score-label hud__score-label--human">Human</span>
            <span className="hud__score-value">{state.score.human}</span>
            <span className="hud__score-sep">–</span>
            <span className="hud__score-value">{state.score.orc}</span>
            <span className="hud__score-label hud__score-label--orc">Orc</span>
          </div>
        )}

        {state.isPuzzleMode && (
          <div className="hud__prob">
            {seriesRun && (
              <span className="hud__prob-label">
                Puzzle {seriesRun.puzzleIndex + 1} / {seriesScenarios.length} ·{' '}
              </span>
            )}
            <span className="hud__prob-label">Success chance</span>
            <span className={`hud__prob-value ${liveProbPct < 50 ? 'hud__prob-value--risky' : ''}`}>
              {liveProbPct}%
            </span>
          </div>
        )}

        {!state.isPuzzleMode && (
          <div className="hud__meta">
            <span className="hud__half">Half {state.half}</span>
            <span className="hud__turn">Turn {displayTurn} / {TURNS_PER_HALF}</span>
          </div>
        )}

        <div className="hud__team">
          <span className={`hud__dot hud__dot--${state.activeTeam}`} />
          <strong>{teamLabel}'s Turn</strong>
        </div>

        <div className="hud__status">{activationStatus}</div>

        <button
          className={`hud__zoom${zoomEnabled ? ' hud__zoom--active' : ''}`}
          onClick={() => setZoomEnabled(z => !z)}
          title="Zoom to legal moves"
        >
          {zoomEnabled ? '🔍 Zoom On' : '🔍 Zoom'}
        </button>

        {state.isPuzzleMode && (
          <button className="hud__restart" onClick={handleRestartTurn}>↺ Restart</button>
        )}

        <UserMenu name={identityName} avatarUrl={identityAvatarUrl} onSignOut={handleSignOut} />
      </header>

      <div className="legend">
        <span className="legend__item legend__item--tz">Tackle Zone</span>
        <span className="legend__item legend__item--free">Free Move</span>
        <span className="legend__item legend__item--gfi">Go For It</span>
        <span className="legend__item legend__item--dodge">Dodge Required</span>
        {state.isPassTargeting && <>
          <span className="legend__item legend__item--range-quick">Quick (0–3)</span>
          <span className="legend__item legend__item--range-short">Short (4–6)</span>
          <span className="legend__item legend__item--range-long">Long (7–9)</span>
          <span className="legend__item legend__item--range-bomb">Bomb (10–13)</span>
        </>}
      </div>

      <div className="game-area">
        <div className="side-col side-col--left">
          <DiceLog
            log={state.actionLog}
            pendingProb={state.pendingProb}
            pendingTargets={state.pendingDodgeTargets}
          />

        </div>

        <main className="pitch-wrapper">
          <Pitch
            state={state}
            onSquareClick={handleSquareClick}
            onPieceClick={handlePieceClick}
            onSquareHover={handleSquareHover}
            onSquareLeave={handleSquareLeave}
            zoomBounds={zoomEnabled ? zoomBounds : null}
          />
        </main>

        <div className="side-col side-col--right">
          <PlayerPanel piece={inspectedPiece} side="right" />
        </div>
      </div>

      {/* Free-play half/game over */}
      {(state.phase === 'half_over' || state.phase === 'game_over') && (
        <PhaseModal state={state} onContinue={handleContinue} />
      )}

      {/* Touchdown — show summary and submit score */}
      {state.phase === 'touchdown' && appMode === 'series-puzzle' && seriesRun && (
        <SubmitModal
          actionLog={state.actionLog}
          onSubmit={handleSeriesContinue}
          onDismiss={handleSeriesContinue}
          seriesMode
          continueLabel={
            seriesRun.puzzleIndex + 1 < seriesScenarios.length
              ? `Continue to Puzzle ${seriesRun.puzzleIndex + 2}`
              : 'Finish Series'
          }
        />
      )}
      {state.phase === 'touchdown' && appMode === 'puzzle' && (
        <SubmitModal
          actionLog={state.actionLog}
          onSubmit={handleSubmit}
          onDismiss={handleSkipSubmit}
          defaultName={identityName}
          signedInName={identityName}
        />
      )}

      {/* Confirm leaving a series run in progress */}
      {confirmLeaveSeries && (
        <ConfirmDialog
          title="Leave series?"
          message="Your progress in this series run will be lost."
          confirmLabel="Leave"
          cancelLabel="Keep Playing"
          onConfirm={confirmLeaveSeriesYes}
          onCancel={confirmLeaveSeriesNo}
        />
      )}

      {/* Piece context menu */}
      {pieceMenu && (() => {
        const menuPiece = pieceMenu.piece;
        // A piece can Hand Off / Pass if it already carries the ball, or if the
        // ball is currently loose on the pitch — in the latter case the player
        // is expected to move this piece onto the ball's square first (a pickup
        // roll), then hand off/pass with the ball it just picked up.
        const canHandoff = (menuPiece.hasBall || state.ballPosition !== null) && !state.passUsed && !menuPiece.activated;
        const canPass    = (menuPiece.hasBall || state.ballPosition !== null) && !state.passUsed && !menuPiece.activated;
        const menuActions: PieceMenuAction[] = [
          { label: 'Move',     key: 'move' },
          { label: 'Hand Off', key: 'handoff', disabled: !canHandoff },
          { label: 'Pass',     key: 'pass',    disabled: !canPass },
        ];
        return (
          <PieceMenu
            piece={menuPiece}
            x={pieceMenu.x}
            y={pieceMenu.y}
            actions={menuActions}
            onAction={handleMenuAction}
            onDismiss={dismissMenu}
          />
        );
      })()}
    </div>
  );
}
