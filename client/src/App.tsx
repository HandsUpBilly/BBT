import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { makeEmptyState, makeScenarioState, pathPreviewProb, passActionAvailability } from './useGameState';
import { useBranchRun } from './useBranchRun';
import { BranchStrip } from './BranchStrip';
import { BranchRunSummary } from './BranchRunSummary';
import { toSubmissionTree } from './branchRun';
import { Pitch } from './Pitch';
import type { PitchOrientation } from './Pitch';
import { PieceMenu } from './PieceMenu';
import type { PieceMenuAction } from './PieceMenu';
import { PlayerPanel } from './PlayerPanel';
import { ScenarioSelect } from './ScenarioSelect';
import { SubmitModal } from './SubmitModal';
import { Leaderboard } from './Leaderboard';
import { ScoreSummary } from './ScoreSummary';
import { SeriesLeaderboard } from './SeriesLeaderboard';
import { SeriesScoreSummary } from './SeriesScoreSummary';
import { ConfirmDialog } from './ConfirmDialog';
import { BlockSplitPanel } from './BlockSplitPanel';
import { blockBoardStates } from './blockBranching';
import { blockActionAvailability } from './blockActionAvailability';
import { UserMenu } from './UserMenu';
import { LegendMenu } from './LegendMenu';
import { MobileInfoSheet } from './MobileInfoSheet';
import { ActionLogMenu } from './ActionLogMenu';
import { GameToolsMenu } from './GameToolsMenu';
import { AppFooter } from './AppFooter';
import { CommitBar } from './CommitBar';
import { SuccessChanceReadout } from './SuccessChanceReadout';
import { ReportProblemButton } from './ReportProblemButton';
import { ReportProblemModal } from './ReportProblemModal';
import { AboutDialog } from './AboutDialog';
import { SettingsScreen } from './SettingsScreen';
import { TutorialLessonDialog } from './TutorialLessonDialog';
import { TUTORIAL_LESSON_IDS, tutorialLessonFor } from './tutorialLessons';
import type { TutorialLesson } from './tutorialLessons';
import { submitScore, fetchLeaderboard, submitSeriesScore, fetchSeriesLeaderboard, fetchProgress, ApiError } from './api';
import type { ProgressData } from './api';
import { recordAttempt } from './attemptStore';
import { summarizeActionLog } from './riskyMoves';
import { readAllPrefs, writePrefs, GUEST_PREFS_KEY } from './prefs';
import type { PlayerPrefs } from './prefs';
import { playerComparison } from './playerComparison';
import { resolveSeriesScenarios } from './series';
import { loadScenarioData } from './scenarios/runtime';
import type { ScenarioData } from './scenarios/runtime';
import { scenarios as staticScenarios } from './scenarios';
import { defaultSeries as staticSeries } from './series';
import { PuzzleEditor } from './editor/PuzzleEditor';
import { useAuth } from './auth';
import type {
  AppMode, GameState, PlayerPiece, Position, Scenario, LeaderboardEntry,
  SeriesLeaderboardEntry, SeriesPuzzleResult,
} from './types';
import { key, computeZoomBounds } from './bfs';
import type { ZoomBounds } from './bfs';
import { useCompactLayout, useHoverCapable, usePortraitViewport } from './useMediaQuery';
import './App.css';
import './PlaybookTheme.css';

const LOCAL_SCORE_KEY = 'bbt.localScores.v1';
const GUEST_NAME_KEY = 'bbt.guestName.v1';
const GOOGLE_ALIASES_KEY = 'bbt.googleAliases.v1';
const DOUBLE_CLICK_WINDOW_MS = 500;

// Client-side allowlist controlling whether the "Puzzle Creator" tab is shown at
// all — this is a UX nicety only, NOT the security boundary. The actual write
// endpoints (netlify/functions/editor-*.js, server/editor.js) independently
// verify the signed-in user's Google identity token against the server-side
// ADMIN_EMAILS env var, so hiding this tab doesn't grant write access and
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

function readGoogleAliases(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(GOOGLE_ALIASES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, alias]) => typeof alias === 'string'),
    );
  } catch {
    return {};
  }
}

function writeGoogleAlias(userId: string, alias: string): void {
  try {
    const aliases = readGoogleAliases();
    aliases[userId] = alias;
    window.localStorage.setItem(GOOGLE_ALIASES_KEY, JSON.stringify(aliases));
  } catch {
    // Storage unavailable — the alias will be requested again after refresh.
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
  try {
    const scores = readLocalScores();
    const scenarioScores = scores[scenarioId] ?? [];
    scores[scenarioId] = scenarioScores.includes(entryId)
      ? scenarioScores
      : [...scenarioScores, entryId];
    window.localStorage.setItem(LOCAL_SCORE_KEY, JSON.stringify(scores));
  } catch {
    // Storage unavailable (private browsing, quota). The score is already on
    // the server — only the local "you played this" marker is lost, and this
    // must not abort the submit flow around it.
  }
}


/**
 * Netlify Blobs is not immediately read-consistent after a write, so the
 * leaderboard is refetched only after this delay. See AGENTS.md.
 */
const LEADERBOARD_CONSISTENCY_DELAY_MS = 3000;

/** Turns a thrown submit failure into something worth showing a player. */
function describeSubmitError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your sign-in expired. Sign in again and resubmit.';
    if (error.status === 400) return error.message;
    if (error.status === 429) return 'SUBMISSION HALTED: Wait a moment, then try again.';
    if (error.status >= 500) return 'The leaderboard is unavailable right now. Try again shortly.';
    return error.message;
  }
  return 'Could not reach the leaderboard. Check your connection and try again.';
}

interface SeriesRunState {
  playerName: string;
  puzzleIndex: number;           // 0-based index into the active series
  results: SeriesPuzzleResult[]; // one entry per completed puzzle so far
}

interface IdentityGateProps {
  authConfigured: boolean;
  googleSignedIn: boolean;
  onGoogleSignIn: () => Promise<void>;
  onAlias: (alias: string) => void;
}

function IdentityGate({ authConfigured, googleSignedIn, onGoogleSignIn, onAlias }: IdentityGateProps) {
  const [guestMode, setGuestMode] = useState(false);
  const [alias, setAlias] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  async function handleGoogleSignIn() {
    setSigningIn(true);
    try {
      await onGoogleSignIn();
    } finally {
      setSigningIn(false);
    }
  }

  function submitAlias() {
    const trimmed = alias.trim();
    if (!trimmed) return;
    onAlias(trimmed);
  }

  const showAliasEntry = googleSignedIn || guestMode;

  return (
    <div className="identity-gate">
      <div className="identity-gate__panel">
        <div className="identity-gate__header">
          <span className="identity-gate__eyebrow">The final turn: Do or die</span>
          <h1 className="identity-gate__title">Turn 16</h1>
          <p className="identity-gate__subtitle">
            One turn remains. Sign the team sheet and find the route to the end zone.
          </p>
        </div>

        {!googleSignedIn && (
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
        )}

        {showAliasEntry && (
          <div className="identity-gate__guest">
            <label className="identity-gate__label" htmlFor="player-alias">Choose your public alias</label>
            <p className="identity-gate__alias-help">This is the name shown on leaderboards and reports.</p>
            <div className="identity-gate__guest-row">
              <input
                id="player-alias"
                className="identity-gate__input"
                type="text"
                maxLength={32}
                placeholder="e.g. Endzone Expert"
                value={alias}
                onChange={e => setAlias(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitAlias()}
                autoFocus
              />
              <button className="btn btn--primary" disabled={!alias.trim()} onClick={submitAlias}>
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
  const { currentUser, idToken, sessionExpired, isConfigured: authConfigured, signIn, signOut } = useAuth();
  // Scenario/series data starts as the build-time static bundle (immediate,
  // no loading flash) and is replaced by the currently published set fetched
  // from /api/scenarios once that resolves — see scenarios/runtime.ts.
  const [scenarioData, setScenarioData] = useState<ScenarioData>(() => ({
    scenarios: staticScenarios,
    series: staticSeries,
  }));
  const seriesScenarios = resolveSeriesScenarios(scenarioData.series, scenarioData.scenarios);
  const [guestAlias, setGuestAliasState] = useState(readGuestName);
  const setGuestAlias = useCallback((alias: string) => {
    setGuestAliasState(alias);
    writeGuestName(alias);
  }, []);
  const [googleAliases, setGoogleAliases] = useState(readGoogleAliases);
  const setGoogleAlias = useCallback((alias: string) => {
    if (!currentUser) return;
    setGoogleAliases(aliases => ({ ...aliases, [currentUser.id]: alias }));
    writeGoogleAlias(currentUser.id, alias);
  }, [currentUser]);
  // Per-account display prefs (avatar, player token style) — same keyed-map
  // shape as googleAliases above, with guests sharing the fixed key
  // GUEST_PREFS_KEY rather than being keyed by name, since name is itself
  // editable on the same screen. See prefs.ts.
  const identityKey = currentUser?.id ?? GUEST_PREFS_KEY;
  const [allPrefs, setAllPrefs] = useState(readAllPrefs);
  const prefs = allPrefs[identityKey] ?? {};
  const setPrefs = useCallback((patch: Partial<PlayerPrefs>) => {
    setAllPrefs(all => ({ ...all, [identityKey]: { ...all[identityKey], ...patch } }));
    writePrefs(identityKey, patch);
  }, [identityKey]);
  // Which screen "Back" returns to from Settings — it can be opened from the
  // game HUD, so it must not always land on home, and mid-puzzle game state
  // lives above appMode and survives the round trip untouched.
  const [settingsReturnMode, setSettingsReturnMode] = useState<AppMode>('home');
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

  // Every scenario leaderboard plus the series board in one request. Fetched
  // here rather than inside ScenarioSelect so it doesn't re-run when the
  // scenario array identity changes as loadScenarioData() resolves — that used
  // to double an already N+1 fan-out on every visit to the home screen.
  const [progress, setProgress] = useState<ProgressData | undefined>();
  useEffect(() => {
    if (appMode !== 'home') return;
    let cancelled = false;
    void fetchProgress().then(data => { if (!cancelled) setProgress(data); });
    return () => { cancelled = true; };
  }, [appMode, progressRefreshKey]);

  // ── Series mode state ──────────────────────────────────────────────────
  const [seriesRun, setSeriesRun] = useState<SeriesRunState | null>(null);
  const [seriesHighlight, setSeriesHighlight] = useState<string | undefined>();
  const [seriesRefreshKey, setSeriesRefreshKey] = useState(0);
  const [seriesInitialEntries, setSeriesInitialEntries] = useState<SeriesLeaderboardEntry[] | undefined>();
  const [selectedSeriesEntry, setSelectedSeriesEntry] = useState<SeriesLeaderboardEntry | undefined>();
  const [confirmLeaveSeries, setConfirmLeaveSeries] = useState(false);
  const [reviewingCompletedBoard, setReviewingCompletedBoard] = useState(false);
  const [tutorialLesson, setTutorialLesson] = useState<{ lesson: TutorialLesson; step: number } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  // Blocking failure on the touchdown submit — keeps the SubmitModal open so
  // the player can retry rather than silently losing the run.
  const [submitError, setSubmitError] = useState<string | undefined>();
  // Non-blocking notice (e.g. a best-effort individual submit failed mid-series).
  const [submitNotice, setSubmitNotice] = useState<string | undefined>();

  const queueTutorialLesson = useCallback((scenario: Scenario, step: number) => {
    const lesson = tutorialLessonFor(scenario.id);
    const guidanceEnabled = prefs.showTutorialGuidance ?? true;
    setTutorialLesson(lesson && guidanceEnabled ? { lesson, step } : null);
  }, [prefs.showTutorialGuidance]);

  const dismissTutorialLesson = useCallback((disableFutureLessons: boolean) => {
    if (!tutorialLesson) return;
    if (disableFutureLessons) setPrefs({ showTutorialGuidance: false });
    setTutorialLesson(null);
  }, [setPrefs, tutorialLesson]);

  const showCurrentTutorialLesson = useCallback(() => {
    const isPlayablePuzzle = appMode === 'series-puzzle' || appMode === 'puzzle';
    if (!isPlayablePuzzle || !activeScenario || editorPreviewScenario) return;
    const lesson = tutorialLessonFor(activeScenario.id);
    const lessonIndex = TUTORIAL_LESSON_IDS.indexOf(activeScenario.id);
    const step = appMode === 'series-puzzle' && seriesRun
      ? seriesRun.puzzleIndex + 1
      : lessonIndex + 1;
    if (lesson && step > 0) setTutorialLesson({ lesson, step });
  }, [activeScenario, appMode, editorPreviewScenario, seriesRun]);

  // ── Viewport shape ───────────────────────────────────────────────────────
  // Three separate questions — see useMediaQuery.ts for why none of them is a
  // proxy for the others.
  //   compact  — is there room for the side columns?  (size)
  //   hover    — can the preview follow a cursor?     (input capability)
  //
  // The third, pointer precision, decides hit-target sizes and is answered
  // entirely in CSS — no component needs to branch on it.
  const compact = useCompactLayout();
  const hoverCapable = useHoverCapable();
  const portraitViewport = usePortraitViewport();
  // Rotating the board is worth it whenever the viewport is tall and narrow,
  // whatever is pointing at it — a narrow desktop window benefits just as
  // much as a phone. In landscape the pitch's own shape already fits.
  const pitchOrientation: PitchOrientation =
    compact && portraitViewport ? 'portrait' : 'landscape';

  // ── Zoom mode ────────────────────────────────────────────────────────────
  // Computed once when play starts (not recalculated as moves are made or
  // pieces are selected). Radius is the largest MA among the player's own
  // team's pieces, plus 2 for GFI/rush squares.
  //
  // On by default on a compact viewport: the full 26×15 board gives 11px
  // squares on a phone, and the crop is the difference between a tappable
  // board and one that needs a fingertip the size of a pea. Keyed to size
  // rather than pointer — a 1280px touchscreen has ample room and should
  // start with the whole pitch. Derived rather than stored, so the default
  // still applies if the media query resolves after first paint, until the
  // player overrides it and their choice sticks.
  const [zoomOverride, setZoomOverride] = useState<boolean | null>(null);
  const zoomEnabled = zoomOverride ?? compact;
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

  // Parallel Universes is the standard game model. Before the first block it
  // contains one line and behaves like the ordinary one-board game.
  const branchedBoards = useBranchRun(makeEmptyState());
  const game = branchedBoards;
  const branchedSummary = branchedBoards.summary;

  const { state, setState, handleSquareClick: hookSquareClick, handleSquareHover: hookSquareHover,
          handleSquareLeave: hookSquareLeave, handleCancelSelection,
          handleHandoffAction, handleHandoffTarget,
          handlePassAction, handlePassTarget,
          handleBlockAction, handleBlockTarget, handlePushChoice } = game;

  const setBranchedState = branchedBoards.setState;
  // `phase: 'touchdown'` marks one branch scoring, not the run finishing, so
  // the branching summary needs its own dismissal flag rather than borrowing
  // the single-board trick of rewinding the phase.
  const [branchSummaryDismissed, setBranchSummaryDismissed] = useState(false);
  const resetBoards = useCallback((next: GameState) => {
    setBranchedState(next);
    setBranchSummaryDismissed(false);
  }, [setBranchedState]);

  const identityName = currentUser ? googleAliases[currentUser.id] ?? '' : guestAlias;
  const identityReady = Boolean(identityName.trim());
  // Empty ADMIN_EMAILS (unset in this environment) means "show to everyone" —
  // matches the server-side fallback in requireAdminGoogleUser, keeping local
  // dev usable without any Google OAuth/admin config.
  const isAdmin = ADMIN_EMAILS.size === 0
    || Boolean(currentUser?.email && ADMIN_EMAILS.has(currentUser.email.toLowerCase()));
  // Defense in depth: appMode is client-only state with no URL routing, so this
  // shouldn't be reachable since the Puzzle Creator tab is hidden for non-admins.
  // The real gate is server-side (ADMIN_EMAILS check on the write endpoints).
  // Render 'home' instead of setState-in-effect to avoid an extra render pass.
  const effectiveAppMode = appMode === 'admin' && !isAdmin ? 'home' : appMode;
  useLayoutEffect(() => {
    if (effectiveAppMode !== 'puzzle' && effectiveAppMode !== 'series-puzzle') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [effectiveAppMode, activeScenario?.id]);
  const reportScenario = effectiveAppMode === 'puzzle' || effectiveAppMode === 'series-puzzle' || effectiveAppMode === 'leaderboard'
    ? activeScenario
    : null;
  const reportContext = {
    mode: effectiveAppMode,
    ...(reportScenario ? { scenarioId: reportScenario.id, scenarioName: reportScenario.name } : {}),
    appVersion: __BBT_VERSION__,
    userAgent: navigator.userAgent,
  };
  const reportButton = (variant: 'header' | 'hud') => (
    <ReportProblemButton variant={variant} onClick={() => setReportOpen(true)} />
  );
  // A lapsed Google session still shows the player as signed in, but writes
  // would 401. Offer the fix before they lose a run to it.
  const expiredBanner = sessionExpired && (
    <div className="app__notice app__notice--warning" role="status">
      <span>SIGN-IN EXPIRED: Scores cannot be saved until you sign in again.</span>
      <button type="button" className="app__notice-action" onClick={() => { void signIn(); }}>
        Sign in again
      </button>
    </div>
  );
  const notice = (
    <>
      {expiredBanner}
      {submitNotice && (
        <div className="app__notice" role="status">
          <span>{submitNotice}</span>
          <button type="button" onClick={() => setSubmitNotice(undefined)} aria-label="Dismiss">×</button>
        </div>
      )}
    </>
  );
  const reportModal = reportOpen && (
    <ReportProblemModal
      defaultReporterName={identityName}
      context={reportContext}
      idToken={idToken}
      onClose={() => setReportOpen(false)}
    />
  );
  const aboutModal = aboutOpen && (
    <AboutDialog
      version={__BBT_VERSION__}
      deployedAt={__BBT_DEPLOYED_AT__}
      onClose={() => setAboutOpen(false)}
    />
  );
  const handleSignOut = useCallback(() => {
    if (currentUser) {
      signOut();
    } else {
      setGuestAlias('');
    }
    setAppMode('home');
  }, [currentUser, signOut, setGuestAlias]);

  // Opened from the account menu on every screen it appears on, so it must
  // remember which one to return to rather than always landing on home.
  const openSettings = useCallback(() => {
    setSettingsReturnMode(current => (appMode === 'settings' ? current : appMode));
    setAppMode('settings');
  }, [appMode]);

  const accountMenu = (
    <UserMenu
      name={identityName}
      avatar={prefs.avatar}
      onSettings={openSettings}
      onAbout={() => setAboutOpen(true)}
      onSignOut={handleSignOut}
    />
  );

  const archiveControls = (
    <div className="app__account-controls">
      {reportButton('header')}
      {accountMenu}
    </div>
  );

  const startPuzzle = useCallback((scenario: Scenario) => {
    setEditorPreviewScenario(null);
    setActiveScenario(scenario);
    const s = makeScenarioState(scenario);
    resetBoards(s);
    setZoomBounds(computeStartOfPlayZoom(s.pieces, s.activeTeam));
    const lessonIndex = TUTORIAL_LESSON_IDS.indexOf(scenario.id);
    queueTutorialLesson(scenario, lessonIndex + 1);
    setAppMode('puzzle');
  }, [resetBoards, computeStartOfPlayZoom, queueTutorialLesson]);

  const previewPuzzle = useCallback((scenario: Scenario) => {
    setTutorialLesson(null);
    setEditorPreviewScenario(scenario);
    setActiveScenario(scenario);
    const s = makeScenarioState(scenario);
    resetBoards(s);
    setZoomBounds(computeStartOfPlayZoom(s.pieces, s.activeTeam));
    setAppMode('puzzle');
  }, [resetBoards, computeStartOfPlayZoom]);

  const goLeaderboard = useCallback((scenario: Scenario) => {
    setActiveScenario(scenario);
    setLeaderboardHighlight(undefined);
    setAppMode('leaderboard');
  }, []);

  // Push-back square choice: if the resolution offers a follow-up (Defender
  // Down only), remember the chosen square and ask Yes/No before finalizing;
  // otherwise resolve immediately with followUp: false.
  const [pendingPushSquare, setPendingPushSquare] = useState<{ col: number; row: number } | null>(null);

  // ── Plot the route, then confirm once ─────────────────────────────────────
  // Intermediate waypoints commit provisionally so the player can keep shaping
  // the route. Double-clicking the route tip marks the whole move as finished;
  // only then does the final Confirm Move / Plot Again choice appear.
  const [armedMove, setArmedMove] = useState<{
    context: string;
    destination: Position;
  } | null>(null);
  const [finishedMove, setFinishedMove] = useState<{
    context: string;
    destination: Position;
  } | null>(null);
  const lastFinishClickRef = useRef<{ token: string; at: number } | null>(null);
  const movementContext = state.selectedPieceId
    ? `${state.selectedPieceId}:${state.walkedSquares.length}`
    : null;
  const activeArmedMove = armedMove?.context === movementContext ? armedMove : null;
  const activeFinishedMove = finishedMove?.context === movementContext ? finishedMove : null;
  // Which player's card the side panel / bottom sheet is showing. Follows the
  // cursor on a mouse and the last tapped square on touch.
  const [hoveredPiece, setHoveredPiece] = useState<PlayerPiece | null>(null);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);

  const disarm = useCallback(() => {
    setArmedMove(null);
    setFinishedMove(null);
    lastFinishClickRef.current = null;
  }, []);

  const finishOnDoubleClick = useCallback((
    context: string,
    destination: Position,
    complete = true,
  ): boolean => {
    const now = Date.now();
    const token = `${context}:${key(destination)}`;
    const previous = lastFinishClickRef.current;
    lastFinishClickRef.current = { token, at: now };
    if (!previous || previous.token !== token || now - previous.at > DOUBLE_CLICK_WINDOW_MS) {
      return false;
    }
    if (complete) {
      setArmedMove(null);
      setFinishedMove({ context, destination });
    }
    return true;
  }, []);

  /**
   * Touch still needs its preview-first tap. Hover-capable pointers commit
   * ordinary waypoints immediately; a scoring destination remains previewed
   * until its double-click opens the final confirmation.
   */
  const previewBeforeCommit = useCallback((col: number, row: number): boolean => {
    if (!movementContext) return false;
    const destination = { col, row };
    const k = key(destination);
    if (!state.reachableKeys.has(k)) return false;

    const selected = state.pieces.find(piece => piece.id === state.selectedPieceId);
    const picksUpBall = state.ballPosition !== null
      && state.pathPreview.some(step => key(step.pos) === key(state.ballPosition!));
    const carriesBall = Boolean(selected?.hasBall || picksUpBall);
    const scores = carriesBall
      && (selected?.team === 'human' ? row === 0 : row === 25);
    const samePreview = activeArmedMove && key(activeArmedMove.destination) === k;

    if (samePreview) {
      // A touchdown must never slip through as an ordinary waypoint. Even a
      // slow repeat tap leaves it staged; only the endpoint double-click may
      // expose the final decision.
      if (scores) {
        finishOnDoubleClick(movementContext, destination);
        return true;
      }
      if (!hoverCapable) {
        setArmedMove(null);
        return false;
      }
    }

    if (hoverCapable && !scores) return false;

    setArmedMove({ context: movementContext, destination });
    finishOnDoubleClick(movementContext, destination, scores);
    hookSquareHover(col, row);
    const piece = state.pieces.find(p => key(p.position) === k);
    setHoveredPiece(piece ?? null);
    return true;
  }, [movementContext, state.reachableKeys, state.pieces, state.selectedPieceId,
      state.ballPosition, state.pathPreview, activeArmedMove, hoverCapable,
      finishOnDoubleClick, hookSquareHover]);

  // Route square clicks: targeting modes take priority over normal movement
  const handleSquareClick = useCallback((col: number, row: number) => {
    if (state.isHandoffTargeting) {
      handleHandoffTarget(col, row);
    } else if (state.isPassTargeting) {
      handlePassTarget(col, row);
    } else if (state.isBlockTargeting) {
      handleBlockTarget(col, row);
    } else if (state.pendingBlockResolution) {
      if (!state.pushTargetKeys.has(key({ col, row }))) return;
      if (state.pendingBlockResolution.offerFollowUp) {
        setPendingPushSquare({ col, row });
      } else {
        handlePushChoice(col, row, false);
      }
    } else {
      const routeTip = state.committedPath[state.committedPath.length - 1];
      if (movementContext && routeTip && key(routeTip) === key({ col, row }) && !state.pendingBlock) {
        finishOnDoubleClick(movementContext, routeTip);
        return;
      }
      if (previewBeforeCommit(col, row)) return;
      setArmedMove(null);
      hookSquareClick(col, row);
    }
  }, [state.isHandoffTargeting, state.isPassTargeting, state.isBlockTargeting, state.pendingBlockResolution,
      state.pushTargetKeys, state.committedPath, state.pendingBlock, movementContext,
      handleHandoffTarget, handlePassTarget, handleBlockTarget, handlePushChoice,
      hookSquareClick, previewBeforeCommit, finishOnDoubleClick]);

  // Escape cancels the current activation. Dialogs handle their own Escape via
  // useModalFocus and stop propagation, so this only fires on the board.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      disarm();
      handleCancelSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disarm, handleCancelSelection]);

  // Context menu state
  const [pieceMenu, setPieceMenu] = useState<{ piece: PlayerPiece; x: number; y: number } | null>(null);

  const handlePieceClick = useCallback((col: number, row: number, x: number, y: number) => {
    const k = key({ col, row });
    const piece = state.pieces.find(p => key(p.position) === k);
    if (!piece) return;

    // Touch has no hover, so a tap is the only way the player card can learn
    // which player to show — including opponents, whose skills are exactly
    // what you need before deciding whether to block them.
    if (!hoverCapable) setHoveredPiece(piece);
    if (compact) setMobileInfoOpen(true);

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

    // During block targeting, clicking a highlighted defender throws the block
    if (state.isBlockTargeting) {
      if (state.blockTargets.has(k)) {
        handleBlockTarget(col, row);
      } else {
        handleCancelSelection();
      }
      return;
    }

    // A Blitz target is chosen before movement. Clicking that same defender
    // once the attacker is adjacent performs the block without ending the
    // activation, so remaining movement can be used afterward.
    if (state.pendingBlockIsBlitz && state.blitzTargetId === piece.id) {
      handleBlockTarget(col, row);
      return;
    }

    // If a piece is already selected and this is a reachable square — treat as a move waypoint
    if (state.selectedPieceId && state.reachableKeys.has(k)) {
      if (previewBeforeCommit(col, row)) return;
      disarm();
      hookSquareClick(col, row);
      return;
    }

    // With movement plotted, double-clicking either the route-tip ghost or the
    // original token opens the one final confirmation. A zero-square action
    // still ends normally with one click.
    if (piece.id === state.selectedPieceId) {
      const routeTip = state.committedPath[state.committedPath.length - 1];
      if (movementContext && routeTip) {
        finishOnDoubleClick(movementContext, routeTip);
        return;
      }
      hookSquareClick(col, row);
      return;
    }

    // Own unactivated piece — show context menu
    if (piece.team === state.activeTeam && !piece.activated) {
      if (compact) setMobileInfoOpen(false);
      setPieceMenu({ piece, x, y });
      return;
    }

    // Anything else (opponent, activated piece) — fall through to normal click
    hookSquareClick(col, row);
  }, [state.pieces, state.selectedPieceId, state.reachableKeys, state.activeTeam,
      state.isHandoffTargeting, state.handoffTargets, state.isPassTargeting, state.passReceiverKeys,
      state.isBlockTargeting, state.blockTargets, state.pendingBlockIsBlitz, state.blitzTargetId,
      state.committedPath, movementContext,
      hookSquareClick, handleHandoffTarget, handlePassTarget, handleBlockTarget, handleCancelSelection,
      previewBeforeCommit, finishOnDoubleClick, hoverCapable, compact]);

  const handleMenuAction = useCallback((actionKey: string, moveFirst: boolean) => {
    if (!pieceMenu) return;
    const { col, row } = pieceMenu.piece.position;
    setPieceMenu(null);
    if (compact) setMobileInfoOpen(true);
    if (actionKey === 'move') {
      hookSquareClick(col, row);
    } else if (actionKey === 'handoff') {
      handleHandoffAction(pieceMenu.piece.id);
      // "Move" wasn't checked — skip movement and go straight to receiver
      // targeting from the carrier's current square, same as clicking the
      // piece again to end activation with zero squares walked.
      if (!moveFirst) hookSquareClick(col, row);
    } else if (actionKey === 'pass') {
      handlePassAction(pieceMenu.piece.id);
      if (!moveFirst) hookSquareClick(col, row);
    } else if (actionKey === 'block') {
      // Plain Block never moves — handleBlockAction(pieceId, false) targets
      // straight from the current square regardless of the Move checkbox.
      handleBlockAction(pieceMenu.piece.id, false);
    } else if (actionKey === 'blitz') {
      handleBlockAction(pieceMenu.piece.id, true);
    }
  }, [pieceMenu, hookSquareClick, handleHandoffAction, handlePassAction, handleBlockAction, compact]);

  const dismissMenu = useCallback(() => {
    setPieceMenu(null);
    if (compact) setMobileInfoOpen(true);
  }, [compact]);

  const handleSquareHover = useCallback((col: number, row: number) => {
    // A tap can emit a synthetic mouseenter, so only genuine hover-capable
    // inputs drive this preview. Freeze only the scoring preview or the final
    // route while the pointer travels to the confirmation controls.
    if (!hoverCapable) return;
    if (activeArmedMove || activeFinishedMove) return;
    // Update movement preview in game state
    hookSquareHover(col, row);
    const k = key({ col, row });
    const piece = state.pieces.find(p => key(p.position) === k);
    setHoveredPiece(piece ?? null);
  }, [hoverCapable, activeArmedMove, activeFinishedMove, hookSquareHover, state.pieces]);
  const handleSquareLeave = useCallback(() => {
    if (!hoverCapable) return;
    if (activeArmedMove || activeFinishedMove) return;
    hookSquareLeave();
    setHoveredPiece(null);
  }, [hoverCapable, activeArmedMove, activeFinishedMove, hookSquareLeave]);

  // Record every completed run in the local attempt history.
  //
  // Keyed on reaching the touchdown phase rather than on submitting, so a run
  // the player declines to put on the board still counts as an attempt — the
  // request was for a history of attempts, and the ones that were not worth
  // submitting are exactly the ones the leaderboard cannot show. Restarting
  // rebuilds the state at 'playing', which re-arms the guard for the next run.
  const attemptRecordedRef = useRef(false);
  // A branching run finishes when every branch is resolved, not when the branch
  // being viewed happens to score — and its probability is the whole run's, not
  // the viewed line's. Recording the viewed line here would file an attempt at a
  // number the leaderboard never sees.
  const runFinished = branchedBoards.complete;
  useEffect(() => {
    if (!runFinished) {
      attemptRecordedRef.current = false;
      return;
    }
    if (attemptRecordedRef.current || !activeScenario) return;
    attemptRecordedRef.current = true;

    const { probability, diceCount } = branchedBoards.hasSplit
      ? { probability: branchedSummary.score, diceCount: branchedSummary.expectedDice }
      : (({ cumulativeProb, diceCount }) => ({ probability: cumulativeProb, diceCount }))(
          summarizeActionLog(state.actionLog));

    recordAttempt(activeScenario.id, {
      at: new Date().toISOString(),
      probability,
      diceCount,
    });
  }, [runFinished, branchedBoards.hasSplit, branchedSummary, state.actionLog, activeScenario]);

  // Submission handler (standalone puzzle mode)
  const handleSubmit = useCallback(async (name: string) => {
    if (!activeScenario) return;
    const { cumulativeProb, diceCount, moves } = summarizeActionLog(state.actionLog);
    setSubmitError(undefined);
    try {
      const entry = await submitScore(activeScenario.id, name, cumulativeProb, diceCount, moves, state.actionLog, idToken);
      rememberLocalScore(activeScenario.id, entry.id);
      setLeaderboardHighlight(entry.id);
      setProgressRefreshKey(k => k + 1);
      setState(s => ({ ...s, phase: 'playing' }));
      setAppMode('leaderboard');
      // Netlify Blobs is not immediately read-consistent after a write, so give
      // it a moment before refetching. See AGENTS.md for the shared pattern.
      await new Promise(res => setTimeout(res, LEADERBOARD_CONSISTENCY_DELAY_MS));
      const entries = await fetchLeaderboard(activeScenario.id);
      setLeaderboardInitialEntries(entries);
      setLeaderboardRefreshKey(k => k + 1);
    } catch (error) {
      // A silently swallowed failure here used to look exactly like success:
      // the player landed on the leaderboard with their score missing and no
      // explanation. Say what happened and let them retry.
      setSubmitError(describeSubmitError(error));
    }
  }, [activeScenario, state.actionLog, setState, idToken]);

  // A branching run submits its whole tree: the score is a sum over the
  // branches that reach a touchdown, so the server recomputes from the tree
  // rather than from one line's rolls. `moves` goes along as display data for
  // the primary line only.
  const handleBranchSubmit = useCallback(async (name: string) => {
    if (!activeScenario) return;
    const { summary, run } = branchedBoards;
    const { moves } = summarizeActionLog(branchedBoards.state.actionLog);
    setSubmitError(undefined);
    try {
      const entry = await submitScore(
        activeScenario.id, name, summary.score, summary.expectedDice,
        moves, branchedBoards.state.actionLog, idToken, toSubmissionTree(run),
      );
      rememberLocalScore(activeScenario.id, entry.id);
      setLeaderboardHighlight(entry.id);
      setProgressRefreshKey(k => k + 1);
      setBranchSummaryDismissed(true);
      setAppMode('leaderboard');
      await new Promise(res => setTimeout(res, LEADERBOARD_CONSISTENCY_DELAY_MS));
      const entries = await fetchLeaderboard(activeScenario.id);
      setLeaderboardInitialEntries(entries);
      setLeaderboardRefreshKey(k => k + 1);
    } catch (error) {
      setSubmitError(describeSubmitError(error));
    }
  }, [activeScenario, branchedBoards, idToken]);

  const handleSkipSubmit = useCallback(() => {
    setState(s => ({ ...s, phase: 'playing' }));
    setAppMode('home');
  }, [setState]);

  const handleRestartTurn = useCallback(() => {
    if (!activeScenario) return;
    setReviewingCompletedBoard(false);
    const s = makeScenarioState(activeScenario);
    resetBoards(s);
    setZoomBounds(computeStartOfPlayZoom(s.pieces, s.activeTeam));
  }, [activeScenario, resetBoards, computeStartOfPlayZoom]);

  // ── Series mode handlers ──────────────────────────────────────────────────
  const startSeries = useCallback(() => {
    if (!identityName.trim()) return;
    const firstScenario = seriesScenarios[0];
    if (!firstScenario) return;
    setSeriesRun({ playerName: identityName, puzzleIndex: 0, results: [] });
    setReviewingCompletedBoard(false);
    setActiveScenario(firstScenario);
    const s = makeScenarioState(firstScenario);
    resetBoards(s);
    setZoomBounds(computeStartOfPlayZoom(s.pieces, s.activeTeam));
    queueTutorialLesson(firstScenario, 1);
    setAppMode('series-puzzle');
  }, [identityName, seriesScenarios, resetBoards, computeStartOfPlayZoom, queueTutorialLesson]);

  // Called when the player continues past a touchdown while in a series run.
  // Submits the puzzle's score to its individual leaderboard, records the
  // result, then either advances to the next puzzle or finalizes the series.
  const handleSeriesContinue = useCallback(async () => {
    if (!activeScenario || !seriesRun) return;
    const flat = summarizeActionLog(state.actionLog);
    const tree = branchedBoards.hasSplit ? toSubmissionTree(branchedBoards.run) : undefined;
    const probability = tree ? branchedBoards.summary.score : flat.cumulativeProb;
    const diceCount = tree ? branchedBoards.summary.expectedDice : flat.diceCount;
    const moves = flat.moves;
    setSubmitError(undefined);

    // Submit to the puzzle's own leaderboard too (best-effort — the series run
    // is the thing being scored, so a failure here must not cost the player
    // their progress. It is surfaced as a non-blocking notice instead).
    try {
      await submitScore(
        activeScenario.id, seriesRun.playerName, probability, diceCount,
        moves, state.actionLog, idToken, tree,
      );
    } catch (error) {
      setSubmitNotice(`This puzzle's individual score wasn't saved (${describeSubmitError(error)}). Your series run continues.`);
    }

    const result: SeriesPuzzleResult = {
      scenarioId: activeScenario.id,
      scenarioName: activeScenario.name,
      probability,
      diceCount,
      moves,
      ...(tree ? { tree } : {}),
    };
    const results = [...seriesRun.results, result];
    const nextIndex = seriesRun.puzzleIndex + 1;

    if (nextIndex < seriesScenarios.length) {
      const nextScenario = seriesScenarios[nextIndex];
      setReviewingCompletedBoard(false);
      setSeriesRun({ ...seriesRun, puzzleIndex: nextIndex, results });
      setActiveScenario(nextScenario);
      const s = makeScenarioState(nextScenario);
      resetBoards(s);
      setZoomBounds(computeStartOfPlayZoom(s.pieces, s.activeTeam));
      queueTutorialLesson(nextScenario, nextIndex + 1);
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
      setReviewingCompletedBoard(false);
      setSeriesRun(null);
      setAppMode('series-leaderboard');
      // The backing store can take a moment to become read-consistent after a
      // write, so wait before re-fetching (mirrors the individual leaderboard).
      await new Promise(res => setTimeout(res, LEADERBOARD_CONSISTENCY_DELAY_MS));
      const entries = await fetchSeriesLeaderboard();
      setSeriesInitialEntries(entries);
      setSeriesRefreshKey(k => k + 1);
    } catch (error) {
      // Keep the run intact so the player can retry the final submit rather
      // than losing every puzzle they just played.
      setSubmitError(describeSubmitError(error));
    }
  }, [activeScenario, seriesRun, seriesScenarios, state.actionLog, branchedBoards.hasSplit,
      branchedBoards.run, branchedBoards.summary, resetBoards, setState, idToken,
      computeStartOfPlayZoom, queueTutorialLesson]);

  const requestLeaveSeries = useCallback(() => {
    setConfirmLeaveSeries(true);
  }, []);

  const confirmLeaveSeriesYes = useCallback(() => {
    setConfirmLeaveSeries(false);
    setReviewingCompletedBoard(false);
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

  const returnToMenuFromTutorial = useCallback(() => {
    setTutorialLesson(null);
    handleBackClick();
  }, [handleBackClick]);

  // ── Render: non-game screens ─────────────────────────────────────────────
  if (!identityReady) {
    return (
      <div className="app app--home app--landing app--playbook">
        <IdentityGate
          authConfigured={authConfigured}
          googleSignedIn={Boolean(currentUser)}
          onGoogleSignIn={signIn}
          onAlias={currentUser ? setGoogleAlias : setGuestAlias}
        />
        <AppFooter />
      </div>
    );
  }

  if (effectiveAppMode === 'home') {
    return (
      <div className="app app--home app--landing app--playbook">
        <ScenarioSelect
          scenarios={scenarioData.scenarios}
          series={scenarioData.series}
          onPlay={startPuzzle}
          onLeaderboard={goLeaderboard}
          onStartSeries={startSeries}
          onSeriesLeaderboard={() => { setSeriesHighlight(undefined); setSeriesInitialEntries(undefined); setAppMode('series-leaderboard'); }}
          onAdmin={() => setAppMode('admin')}
          progress={progress}
          userId={currentUser?.id}
          isAdmin={isAdmin}
          userMenu={accountMenu}
          reportButton={reportButton('header')}
        />
        {notice}
        {reportModal}
        {aboutModal}
        <AppFooter />
      </div>
    );
  }

  if (effectiveAppMode === 'series-leaderboard') {
    if (selectedSeriesEntry) {
      return (
        <div className="app app--home app--archive app--playbook">
          {archiveControls}
          <SeriesScoreSummary
            entry={selectedSeriesEntry}
            onBack={() => setSelectedSeriesEntry(undefined)}
          />
          {notice}
          {reportModal}
          {aboutModal}
          <AppFooter />
        </div>
      );
    }
    return (
      <div className="app app--home app--archive app--playbook">
        {archiveControls}
        <SeriesLeaderboard
          key={seriesRefreshKey}
          onBack={() => { setSeriesInitialEntries(undefined); setAppMode('home'); }}
          highlightId={seriesHighlight}
          initialEntries={seriesInitialEntries}
          onEntriesLoaded={setSeriesInitialEntries}
          onRowClick={setSelectedSeriesEntry}
        />
        {notice}
        {reportModal}
        {aboutModal}
        <AppFooter />
      </div>
    );
  }

  if (effectiveAppMode === 'admin') {
    return (
      <div className="app app--home app--admin app--playbook">
        {accountMenu}
        <PuzzleEditor
          onBack={() => setAppMode('home')}
          onPlay={previewPuzzle}
          previewScenario={editorPreviewScenario}
          idToken={idToken}
        />
        {aboutModal}
        <AppFooter />
      </div>
    );
  }

  if (effectiveAppMode === 'settings') {
    return (
      <div className="app app--home app--archive app--playbook">
        {archiveControls}
        <SettingsScreen
          identityName={identityName}
          isGuest={!currentUser}
          onRename={currentUser ? setGoogleAlias : setGuestAlias}
          avatar={prefs.avatar}
          onAvatarChange={avatar => setPrefs({ avatar })}
          tokenStyle={prefs.tokenStyle ?? 'portrait'}
          onTokenStyleChange={tokenStyle => setPrefs({ tokenStyle })}
          pitchSurface={prefs.pitchSurface ?? 'grass'}
          onPitchSurfaceChange={pitchSurface => setPrefs({ pitchSurface })}
          showCoordinates={prefs.showCoordinates ?? true}
          onShowCoordinatesChange={showCoordinates => setPrefs({ showCoordinates })}
          showTutorialGuidance={prefs.showTutorialGuidance ?? true}
          onShowTutorialGuidanceChange={showTutorialGuidance => setPrefs({ showTutorialGuidance })}
          onBack={() => setAppMode(settingsReturnMode)}
        />
        {notice}
        {reportModal}
        {aboutModal}
        <AppFooter />
      </div>
    );
  }

  if (effectiveAppMode === 'leaderboard' && activeScenario) {
    if (selectedEntry) {
      return (
        <div className="app app--home app--archive app--playbook">
          {archiveControls}
          <ScoreSummary
            entry={selectedEntry}
            scenario={activeScenario}
            onBack={() => setSelectedEntry(undefined)}
          />
          {notice}
          {reportModal}
          {aboutModal}
          <AppFooter />
        </div>
      );
    }
    return (
      <div className="app app--home app--archive app--playbook">
        {archiveControls}
        <Leaderboard
          key={leaderboardRefreshKey}
          scenario={activeScenario}
          onBack={() => { setLeaderboardInitialEntries(undefined); setAppMode('home'); }}
          highlightId={leaderboardHighlight}
          initialEntries={leaderboardInitialEntries}
          onEntriesLoaded={setLeaderboardInitialEntries}
          onRowClick={setSelectedEntry}
        />
        {notice}
        {reportModal}
        {aboutModal}
        <AppFooter />
      </div>
    );
  }

  // ── Game screen ──────────────────────────────────────────────────────────
  const selectedPiece = state.selectedPieceId
    ? state.pieces.find(p => p.id === state.selectedPieceId) ?? null
    : null;
  // One card normally; two while a block, blitz, pass or hand-off is being
  // aimed, so the attacker's stats stay on screen next to the defender's
  // instead of being replaced by them. See playerComparison.ts.
  const { primary: inspectedPiece, secondary: comparisonPiece } =
    playerComparison(state, selectedPiece, hoveredPiece);

  // Only the completed route gets the final decision bar. A touch preview or
  // scoring preview remains on the pitch without presenting confirmation yet.
  const finishedPreview = activeFinishedMove?.destination ?? null;

  // Every piece on the active team has had its go. (This used to inspect only
  // the *first* piece on the team, so the status line was wrong the moment a
  // scenario had more than one.)
  const ownPieces = state.pieces.filter(p => p.team === state.activeTeam);
  const allActivated = ownPieces.length > 0 && ownPieces.every(p => p.activated || p.down);
  const blitzTarget = state.blitzTargetId
    ? state.pieces.find(piece => piece.id === state.blitzTargetId) ?? null
    : null;
  const activationStatus = state.isHandoffTargeting
    ? 'HAND-OFF: Select a receiver. Press Esc to cancel.'
    : state.isPassTargeting
    ? 'PASS: Select a receiver. Press Esc to cancel.'
    : state.isBlockTargeting
    ? (state.pendingBlockIsBlitz
        ? 'BLITZ: Select the target. Press Esc to cancel.'
        : 'BLOCK: Select an adjacent opponent. Press Esc to cancel.')
    : state.pendingBlockResolution
    ? (state.pendingBlockResolution.offerFollowUp
        ? 'PUSH BACK: Choose a square. Defender Down allows a Follow-up.'
        : 'PUSH BACK: Choose a square.')
    : state.pendingHandoff
    ? `HAND-OFF DECLARED: Move up to ${state.remainingMa} MA, then select the receiver. Press Esc to cancel.`
    : state.pendingPass
    ? `PASS DECLARED: Move up to ${state.remainingMa} MA, then select the receiver. Press Esc to cancel.`
    : state.pendingBlock
    ? `BLITZ: Move into contact with ${blitzTarget?.name ?? 'the target'}, then select the target. ${state.remainingMa} MA remaining.`
    : activeFinishedMove
    ? 'MOVE READY: Confirm the whole route or plot it again.'
    : activeArmedMove
    ? 'ROUTE READY: Double-click the preview endpoint when finished.'
    : state.selectedPieceId && state.committedPath.length > 0
    ? `ACTIVATION: ${state.remainingMa} MA remaining. Double-click the route endpoint when finished.`
    : allActivated && !state.selectedPieceId
    ? 'TURN COMPLETE: Every player has been activated. Restart to test another play.'
    : state.selectedPieceId
    ? `ACTIVATION: ${state.remainingMa} MA remaining. Press Esc to cancel.`
    : 'ACTIVATION: Select a player.';

  // Live probability: committed actions × pending rolls not yet committed ×
  // the rolls on the route currently being previewed. The preview factor is
  // new — the odds of a planned line used to appear only after it had been
  // committed, which is the wrong order for a game about weighing risk.
  const lastCommittedProb = state.actionLog.length > 0
    ? state.actionLog[state.actionLog.length - 1].cumulativeProb : 1;
  const previewProb = pathPreviewProb(state.pathPreview, state.dodgeRerollAvailability);
  // Not multiplied by state.pendingProb: that resets per activation and
  // accumulates the same per-step values, so it is always already inside
  // lastCommittedProb. Including it counted the current piece's rolls twice
  // and made the HUD disagree with the score that gets submitted.
  const liveProbPct = Math.round(lastCommittedProb * previewProb * 100);
  // Only meaningful once a dice roll is actually in play — hide the pointless 100% default.
  const showSuccessChance = liveProbPct < 100;

  // Rendered in one place, mounted in one of two. On touch the status line
  // moves out of the HUD to just above the commit bar: it is guidance about
  // what to do next, so it belongs near the thumb, and pulling it out of the
  // header is most of what gets the HUD from 121px down to one row.
  const backLabel = editorPreviewScenario ? 'Designer' : 'Menu';
  // Run progress rides with the HUD readout on a desktop and with the status
  // text on touch, where a 310px control row has no 89px to spare for it.
  const seriesCounter = seriesRun ? (
    <span className="hud__prob-label hud__prob-label--series">
      Puzzle {seriesRun.puzzleIndex + 1} / {seriesScenarios.length}
    </span>
  ) : null;
  const statusLine = (
    <div className="hud__status">
      {compact && seriesCounter && <>{seriesCounter}{': '}</>}
      {activationStatus}
    </div>
  );

  return (
    <div className="app app--game app--playbook">
      <header className="hud">
        <button className="hud__back" onClick={handleBackClick} aria-label={`Back to ${backLabel}`}>
          <span className="hud__btn-icon" aria-hidden="true">←</span>
          <span className="hud__btn-text">{backLabel}</span>
        </button>

        {/* Keep account/Settings/About ahead of the game tools on narrow HUDs. */}
        {accountMenu}

        <div className={`hud__prob${compact && !showSuccessChance ? ' hud__prob--empty' : ''}`}>
          {!compact && seriesCounter && <>{seriesCounter}{': '}</>}
          <SuccessChanceReadout probability={liveProbPct} visible={showSuccessChance} />
        </div>

        {!compact && statusLine}

        {compact ? (
          <GameToolsMenu
            zoomEnabled={zoomEnabled}
            onTutorialBriefing={
              (appMode === 'series-puzzle' || (appMode === 'puzzle' && !editorPreviewScenario))
                ? showCurrentTutorialLesson
                : undefined
            }
            onToggleZoom={() => setZoomOverride(!zoomEnabled)}
            onRestart={handleRestartTurn}
            onReport={() => setReportOpen(true)}
          />
        ) : (
          <>
            <button
              className={`hud__zoom${zoomEnabled ? ' hud__zoom--active' : ''}`}
              onClick={() => setZoomOverride(!zoomEnabled)}
              title="Zoom to legal moves"
              aria-label={zoomEnabled ? 'Zoom on. Show the whole pitch' : 'Zoom to legal moves'}
              aria-pressed={zoomEnabled}
            >
              <span className="hud__btn-icon" aria-hidden="true">🔍</span>
              <span className="hud__btn-text">{zoomEnabled ? 'Zoom On' : 'Zoom'}</span>
            </button>

            <button className="hud__restart" onClick={handleRestartTurn} aria-label="Restart turn">
              <span className="hud__btn-icon" aria-hidden="true">↺</span>
              <span className="hud__btn-text">Restart</span>
            </button>
          </>
        )}

        {/* The key is reference material on every screen size, so it is behind
            this button on every screen size — see LegendMenu. */}
        <LegendMenu
          isPassTargeting={state.isPassTargeting}
          isBlockTargeting={state.isBlockTargeting}
          hasPushTargets={!!state.pendingBlockResolution}
        />

        <ActionLogMenu log={state.actionLog} />

        {!compact && reportButton('hud')}
      </header>

      <BranchStrip
        branches={branchedBoards.strip}
        deadWeight={branchedBoards.summary.deadWeight}
        score={branchedBoards.summary.score}
        onSelect={branchedBoards.handleSelectBranch}
        onConcede={branchedBoards.handleConcedeBranch}
      />

      <div className="game-area">
        <main className="pitch-wrapper">
          <Pitch
            state={state}
            onSquareClick={handleSquareClick}
            onPieceClick={handlePieceClick}
            onSquareHover={handleSquareHover}
            onSquareLeave={handleSquareLeave}
            zoomBounds={zoomEnabled ? zoomBounds : null}
            orientation={pitchOrientation}
            tokenStyle={prefs.tokenStyle ?? 'portrait'}
            pitchSurface={prefs.pitchSurface ?? 'grass'}
            showCoordinates={prefs.showCoordinates ?? true}
            branchGhosts={branchedBoards.ghosts}
          />
        </main>

        {/* Two cards while a two-player action is being aimed. The rail
            scrolls rather than squeezing the board, and the cards go compact
            (see .side-col--comparing) so both usually fit without it. */}
        <div className={`side-col side-col--right${comparisonPiece ? ' side-col--comparing' : ''}`}>
          <PlayerPanel
            piece={inspectedPiece}
            side="right"
            role={comparisonPiece ? 'acting' : undefined}
          />
          {comparisonPiece && (
            <PlayerPanel piece={comparisonPiece} side="right" role="target" />
          )}
        </div>

      </div>

      {/* Both side columns are hidden on touch, so without this the player
          card vanishes on a phone. The roll history that used to share this
          sheet now lives in the toolbar. A sibling of .game-area rather than
          a child, so the landscape grid can move it into the column beside
          the board instead of stacking it under one that has no height. */}
      {compact && (
        <MobileInfoSheet
          piece={inspectedPiece}
          comparisonPiece={comparisonPiece}
          open={mobileInfoOpen}
          onToggle={() => setMobileInfoOpen(value => !value)}
        />
      )}

      {compact && <div className="status-strip">{statusLine}</div>}

      {/* Non-hovering layouts keep an invisible placeholder mounted so the
          final decision never resizes the pitch. Hovering layouts mount it
          only after the route endpoint is double-clicked. */}
      {(!hoverCapable || finishedPreview) && (
        <CommitBar
          destination={finishedPreview}
          probability={liveProbPct}
          showProbability={showSuccessChance}
          onCancel={() => {
            disarm();
            hookSquareLeave();
            handleCancelSelection();
          }}
          onConfirm={() => {
            if (!finishedPreview) return;
            disarm();
            hookSquareClick(finishedPreview.col, finishedPreview.row);
          }}
        />
      )}

      {/* Touchdown — show summary and submit score */}
      {!branchedBoards.hasSplit && branchedBoards.complete && effectiveAppMode === 'series-puzzle' && seriesRun && activeScenario && !reviewingCompletedBoard && (
        <SubmitModal
          scenario={activeScenario}
          actionLog={state.actionLog}
          onSubmit={handleSeriesContinue}
          onDismiss={handleSeriesContinue}
          seriesMode
          onReviewBoard={() => setReviewingCompletedBoard(true)}
          error={submitError}
          continueLabel={
            seriesRun.puzzleIndex + 1 < seriesScenarios.length
              ? `Continue to Puzzle ${seriesRun.puzzleIndex + 2}`
              : 'Finish Series'
          }
        />
      )}
      {branchedBoards.hasSplit && branchedBoards.complete && effectiveAppMode === 'series-puzzle'
        && seriesRun && activeScenario && !reviewingCompletedBoard && (
        <BranchRunSummary
          scenarioName={activeScenario.name}
          scenario={activeScenario}
          run={branchedBoards.run}
          summary={branchedBoards.summary}
          branches={branchedBoards.strip}
          onSubmit={handleSeriesContinue}
          onDismiss={handleSeriesContinue}
          signedInName={seriesRun.playerName}
          error={submitError}
          seriesMode
          onReviewBoard={() => setReviewingCompletedBoard(true)}
          continueLabel={
            seriesRun.puzzleIndex + 1 < seriesScenarios.length
              ? `Continue to Puzzle ${seriesRun.puzzleIndex + 2}`
              : 'Finish Series'
          }
        />
      )}
      {branchedBoards.complete && effectiveAppMode === 'series-puzzle' && seriesRun && reviewingCompletedBoard && (
        <div className="touchdown-review-bar" role="region" aria-label="Completed board review">
          <span>Reviewing the completed board</span>
          <button
            className="btn btn--primary"
            onClick={() => setReviewingCompletedBoard(false)}
            autoFocus
          >
            View Analysis &amp; Continue
          </button>
        </div>
      )}
      {!branchedBoards.hasSplit && state.phase === 'touchdown' && effectiveAppMode === 'puzzle' && activeScenario && (
        <SubmitModal
          scenario={activeScenario}
          actionLog={state.actionLog}
          onSubmit={handleSubmit}
          onDismiss={handleSkipSubmit}
          defaultName={identityName}
          signedInName={identityName}
          error={submitError}
        />
      )}

      {/* Branching runs finish when every branch is resolved, not when one scores. */}
      {branchedBoards.hasSplit && branchedBoards.complete && !branchSummaryDismissed
        && effectiveAppMode === 'puzzle' && activeScenario && (
        <BranchRunSummary
          scenarioName={activeScenario.name}
          scenario={activeScenario}
          run={branchedBoards.run}
          summary={branchedBoards.summary}
          branches={branchedBoards.strip}
          onSubmit={handleBranchSubmit}
          onDismiss={() => setBranchSummaryDismissed(true)}
          defaultName={identityName}
          signedInName={identityName}
          error={submitError}
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
        const canPass    = passActionAvailability(state, menuPiece);
        const { canBlock, canBlitz } = blockActionAvailability(menuPiece, state);
        const menuActions: PieceMenuAction[] = [
          { label: 'Move',     key: 'move' },
          { label: 'Hand-off', key: 'handoff', disabled: !canHandoff },
          { label: 'Pass',     key: 'pass',    disabled: !canPass },
          { label: 'Block',    key: 'block',   disabled: !canBlock },
          { label: 'Blitz',    key: 'blitz',   disabled: !canBlitz },
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

      {/* Declare-time block preview. Progressing creates Parallel Universes for
          every live board the dice can leave behind. */}
      {state.blockChoice && state.selectedPieceId && (() => {
        const { blockChoice } = state;
        const attacker = state.pieces.find(p => p.id === state.selectedPieceId);
        const defender = state.pieces.find(p => p.id === blockChoice.defenderId);
        if (!attacker || !defender) return null;
        return (
          <BlockSplitPanel
            attackerName={attacker.name}
            defenderName={defender.name}
            attackerStrength={attacker.st}
            attackerAssists={blockChoice.attackerAssists}
            defenderStrength={defender.st}
            defenderAssists={blockChoice.defenderAssists}
            diceCount={blockChoice.diceCount}
            picker={blockChoice.picker}
            resolution={blockBoardStates(attacker.skills, defender.skills)}
            onAccept={branchedBoards.handleResolveBlock}
            onReject={handleCancelSelection}
          />
        );
      })()}

      {/* Push-back follow-up choice (Defender Down only) */}
      {pendingPushSquare && (
        <ConfirmDialog
          title="Follow up?"
          message="Move into the square the defender vacated?"
          confirmLabel="Follow Up"
          cancelLabel="Stay"
          onConfirm={() => {
            handlePushChoice(pendingPushSquare.col, pendingPushSquare.row, true);
            setPendingPushSquare(null);
          }}
          onCancel={() => {
            handlePushChoice(pendingPushSquare.col, pendingPushSquare.row, false);
            setPendingPushSquare(null);
          }}
        />
      )}
      {(effectiveAppMode === 'series-puzzle' || effectiveAppMode === 'puzzle') && tutorialLesson && (
        <TutorialLessonDialog
          lesson={tutorialLesson.lesson}
          step={tutorialLesson.step}
          total={TUTORIAL_LESSON_IDS.length}
          onDismiss={dismissTutorialLesson}
          onReturnToMenu={returnToMenuFromTutorial}
        />
      )}
      {notice}
      {reportModal}
      {aboutModal}
    </div>
  );
}
