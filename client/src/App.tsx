import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { makeEmptyState, makeScenarioState, pathPreviewProb, passActionAvailability } from './useGameState';
import { useBranchRun } from './useBranchRun';
import { BranchStrip } from './BranchStrip';
import { BranchRunSummary } from './BranchRunSummary';
import { toSubmissionTree } from './branchRun';
import { Pitch } from './Pitch';
import type { PitchOrientation } from './Pitch';
import { PieceMenu } from './PieceMenu';
import type { PieceMenuAction } from './PieceMenu';
import type { MenuAnchor } from './menuPosition';
import { PlayerPanel } from './PlayerPanel';
import { ScenarioSelect } from './ScenarioSelect';
import { SubmitModal } from './SubmitModal';
import { RunOutcomeDialog } from './RunOutcomeDialog';
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
import { SuccessChanceReadout } from './SuccessChanceReadout';
import { ReportProblemButton } from './ReportProblemButton';
import { ReportProblemModal } from './ReportProblemModal';
import { ContactModal } from './ContactModal';
import { AboutDialog } from './AboutDialog';
import { ReleaseNotesDialog } from './ReleaseNotesDialog';
import { releaseNotes } from './releaseNotes';
import { BrandLogo } from './BrandLogo';
import { SettingsScreen } from './SettingsScreen';
import { HelpScreen } from './HelpScreen';
import { TutorialObjectiveCard } from './TutorialObjectiveCard';
import { attacksTopEndZone } from './teamPresentation';
import { TutorialContextCaption } from './TutorialContextCaption';
import { TutorialConceptGuideDialog } from './TutorialConceptGuideDialog';
import { ParallelUniversesIntroDialog } from './ParallelUniversesIntroDialog';
import { ReplayGuidanceDialog } from './ReplayGuidanceDialog';
import { TutorialPuzzleChooser } from './TutorialPuzzleChooser';
import { upsertSeriesPuzzleResult } from './seriesResults';
import { TUTORIAL_LESSON_IDS, tutorialLessonFor } from './tutorialLessons';
import type { TutorialLesson } from './tutorialLessons';
import { tutorialActionSequence } from './tutorialRecap';
import type { TutorialDrillRecap } from './tutorialRecap';
import {
  tutorialConceptFor,
  tutorialConceptsForScenario,
  type TutorialConceptId,
  type TutorialConceptProgress,
} from './tutorialConcepts';
import { submitScore, fetchLeaderboard, submitSeriesScore, fetchSeriesLeaderboard, fetchProgress, recordLogin, ApiError } from './api';
import type { ProgressData } from './api';
import { recordAttempt } from './attemptStore';
import { summarizeActionLog } from './riskyMoves';
import { isScoringRunStalled, unfinishedBranches } from './runOutcome';
import { readAllPrefs, readPrefs, writePrefs, GUEST_PREFS_KEY } from './prefs';
import type { PlayerPrefs } from './prefs';
import { fetchOwnProfile, playerAvatarUrl, saveOwnProfile } from './playerProfile';
import type { PlayerProfilePatch } from './playerProfile';
import { playerComparison } from './playerComparison';
import { resolveSeriesScenarios } from './series';
import { loadScenarioData } from './scenarios/runtime';
import type { ScenarioData } from './scenarios/runtime';
import { scenarios as staticScenarios } from './scenarios';
import { allSeries as staticSeries } from './series';
import { PuzzleEditor } from './editor/PuzzleEditor';
import { useAuth } from './auth';
import { useAdminAccess } from './useAdminAccess';
import type {
  AppMode, GameState, PlayerPiece, Position, Scenario, LeaderboardEntry,
  PublicPlayerProfile, SeriesDefinition, SeriesLeaderboardEntry, SeriesPuzzleResult,
} from './types';
import { key } from './bfs';
import { useCompactLayout, useHoverCapable, usePhoneToolbarLayout, usePortraitViewport } from './useMediaQuery';
import {
  initializeAnalytics,
  newAnalyticsId,
  setActiveAnalyticsAttempt,
  trackAnalytics,
} from './analytics';
import './App.css';
import './PlaybookTheme.css';

const LOCAL_SCORE_KEY = 'bbt.localScores.v1';
const GUEST_NAME_KEY = 'bbt.guestName.v1';
const GOOGLE_ALIASES_KEY = 'bbt.googleAliases.v1';

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
  seriesId: string;
  playerName: string;
  puzzleIndex: number;           // 0-based index into the active series
  results: SeriesPuzzleResult[]; // one entry per completed puzzle so far
}

interface IdentityGateProps {
  authConfigured: boolean;
  googleSignedIn: boolean;
  mountGoogleSignInButton: (container: HTMLElement) => Promise<void>;
  onAlias: (alias: string) => void;
}

function IdentityGate({ authConfigured, googleSignedIn, mountGoogleSignInButton, onAlias }: IdentityGateProps) {
  const [guestMode, setGuestMode] = useState(false);
  const [alias, setAlias] = useState('');
  const [googleSignInFailed, setGoogleSignInFailed] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = googleButtonRef.current;
    if (!authConfigured || !container || googleSignedIn) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const actions = container.parentElement;

    void mountGoogleSignInButton(container)
      .then(() => {
        if (cancelled) return;
        const iframe = container.querySelector('iframe');
        if (!iframe) return;

        const syncActionWidth = () => {
          const style = window.getComputedStyle(iframe);
          const horizontalMargins = (Number.parseFloat(style.marginLeft) || 0)
            + (Number.parseFloat(style.marginRight) || 0);
          const googleVisibleWidth = iframe.getBoundingClientRect().width + horizontalMargins;
          const containerWidth = container.getBoundingClientRect().width;
          actions?.style.setProperty(
            '--identity-action-width',
            `${Math.round(Math.max(containerWidth, googleVisibleWidth))}px`,
          );
        };

        syncActionWidth();
        resizeObserver = new ResizeObserver(syncActionWidth);
        resizeObserver.observe(iframe);
      })
      .catch(() => {
        if (!cancelled) setGoogleSignInFailed(true);
      });
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      actions?.style.removeProperty('--identity-action-width');
      container.replaceChildren();
    };
  }, [authConfigured, googleSignedIn, mountGoogleSignInButton]);

  function submitAlias() {
    const trimmed = alias.trim();
    if (!trimmed) return;
    onAlias(trimmed);
  }

  const showAliasEntry = googleSignedIn || guestMode;

  return (
    <div className="identity-gate">
      <div className="identity-gate__shell">
        <h1 className="identity-gate__title">Turn 16</h1>
        <div className={`identity-gate__panel${showAliasEntry ? ' identity-gate__panel--alias' : ''}`}>
          {!googleSignedIn && (
            <div className="identity-gate__actions">
              {authConfigured && !googleSignInFailed
                ? <div ref={googleButtonRef} className="identity-gate__google-button" />
                : <button className="btn btn--primary" disabled>Google Login Unavailable</button>}
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
    </div>
  );
}

export default function App() {
  useEffect(() => initializeAnalytics(), []);
  const { currentUser, idToken, sessionExpired, isConfigured: authConfigured, mountSignInButton, signOut } = useAuth();
  // Forced on everywhere except the real production deploy — see
  // __BBT_FORCE_ADMIN_NAV__ in vite.config.ts. This only affects nav
  // visibility; the server still enforces the actual admin allowlist on
  // every /api/editor/* call, staging included.
  const confirmedAdmin = useAdminAccess(idToken);
  const isAdmin = __BBT_FORCE_ADMIN_NAV__ || confirmedAdmin;
  // Scenario/series data starts as the build-time static bundle (immediate,
  // no loading flash) and is replaced by the currently enabled set fetched
  // from /api/scenarios once that resolves — see scenarios/runtime.ts.
  const [scenarioData, setScenarioData] = useState<ScenarioData>(() => ({
    scenarios: staticScenarios,
    series: staticSeries,
  }));
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
  const [profileState, setProfileState] = useState<{
    userId: string;
    profile: PublicPlayerProfile;
  } | null>(null);
  useEffect(() => {
    if (!currentUser || !idToken) return;
    let cancelled = false;
    void fetchOwnProfile(idToken).then(profile => {
      if (!cancelled) setProfileState({ userId: currentUser.id, profile });
    }).catch(() => {
      // Public profile decoration is optional. A failed read must not block
      // gameplay or erase the existing local-avatar migration fallback.
    });
    return () => { cancelled = true; };
  }, [currentUser, idToken]);
  const publicProfile = currentUser && profileState?.userId === currentUser.id
    ? profileState.profile
    : undefined;
  const publicAvatar = currentUser && publicProfile?.avatarVersion
    ? playerAvatarUrl(currentUser.id, publicProfile.avatarVersion)
    : undefined;
  const avatar = publicAvatar ?? prefs.avatar;
  const avatarIsLocalOnly = Boolean(currentUser && !publicAvatar && prefs.avatar);
  const updatePublicProfile = useCallback(async (patch: PlayerProfilePatch) => {
    if (!currentUser || !idToken) throw new Error('Sign in with Google to update your public profile.');
    const profile = await saveOwnProfile(patch, idToken);
    setProfileState({ userId: currentUser.id, profile });
    if (Object.hasOwn(patch, 'avatar')) setPrefs({ avatar: undefined });
  }, [currentUser, idToken, setPrefs]);
  const tutorialConceptProgress = prefs.tutorialConceptProgress as TutorialConceptProgress | undefined;
  const updateTutorialConcepts = useCallback((conceptIds: readonly TutorialConceptId[], status: 'introduced' | 'used') => {
    const mergeProgress = (current: Record<string, 'introduced' | 'used'>) => {
      const next = { ...current };
      let changed = false;
      for (const conceptId of conceptIds) {
        const currentStatus = current[conceptId];
        if (currentStatus === 'used' || currentStatus === status) continue;
        next[conceptId] = status;
        changed = true;
      }
      return changed ? next : current;
    };

    // Persist outside the React state updater: Strict Mode may invoke updater
    // functions more than once, so they must remain side-effect free.
    const storedProgress = readPrefs(identityKey).tutorialConceptProgress ?? {};
    const nextStoredProgress = mergeProgress(storedProgress);
    if (nextStoredProgress !== storedProgress) {
      writePrefs(identityKey, { tutorialConceptProgress: nextStoredProgress });
    }

    setAllPrefs(all => {
      const currentPrefs = all[identityKey] ?? {};
      const currentProgress = currentPrefs.tutorialConceptProgress ?? {};
      const nextProgress = mergeProgress(currentProgress);
      if (nextProgress === currentProgress) return all;
      const nextPrefs = { ...currentPrefs, tutorialConceptProgress: nextProgress };
      return { ...all, [identityKey]: nextPrefs };
    });
  }, [identityKey]);
  // Which screen "Back" returns to from Settings — it can be opened from the
  // game HUD, so it must not always land on home, and mid-puzzle game state
  // lives above appMode and survives the round trip untouched.
  const [settingsReturnMode, setSettingsReturnMode] = useState<AppMode>('home');
  const [helpReturnMode, setHelpReturnMode] = useState<AppMode>('home');
  const [appMode, setAppMode] = useState<AppMode>('home');
  // Re-fetch whenever the player lands on the home/select screen (including on
  // first load) so a scenario saved while this tab was open — or before
  // this tab was ever opened — shows up without a hard refresh. Cheap no-op if
  // nothing changed since /api/scenarios falls back to the static bundle on
  // failure and the fetch itself is a single small JSON payload.
  useEffect(() => {
    if (appMode !== 'home') return;
    let cancelled = false;
    void loadScenarioData({ admin: confirmedAdmin, idToken }).then(data => { if (!cancelled) setScenarioData(data); });
    return () => { cancelled = true; };
  }, [appMode, confirmedAdmin, idToken]);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [leaderboardHighlight, setLeaderboardHighlight] = useState<string | undefined>();
  const [leaderboardReturnMode, setLeaderboardReturnMode] = useState<'home' | 'series-select'>('home');
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
  const activeSeries = useMemo(
    () => scenarioData.series.find(item => item.id === seriesRun?.seriesId) ?? scenarioData.series[0],
    [scenarioData.series, seriesRun?.seriesId],
  );
  const seriesScenarios = useMemo(
    () => activeSeries ? resolveSeriesScenarios(activeSeries, scenarioData.scenarios) : [],
    [activeSeries, scenarioData.scenarios],
  );
  const [seriesHighlight, setSeriesHighlight] = useState<string | undefined>();
  const [seriesRefreshKey, setSeriesRefreshKey] = useState(0);
  const [seriesInitialEntries, setSeriesInitialEntries] = useState<SeriesLeaderboardEntry[] | undefined>();
  const [selectedSeriesEntry, setSelectedSeriesEntry] = useState<SeriesLeaderboardEntry | undefined>();
  const [confirmLeaveSeries, setConfirmLeaveSeries] = useState(false);
  const [reviewingCompletedBoard, setReviewingCompletedBoard] = useState(false);
  const [tutorialRecaps, setTutorialRecaps] = useState<Record<string, TutorialDrillRecap>>({});
  const [pendingTutorialReplay, setPendingTutorialReplay] = useState<Scenario | null>(null);
  const [replayLearnedConcepts, setReplayLearnedConcepts] = useState(false);
  const [tutorialLesson, setTutorialLesson] = useState<{ lesson: TutorialLesson; step: number } | null>(null);
  const [tutorialConceptGuideOpen, setTutorialConceptGuideOpen] = useState(false);
  const [dismissedTutorialConcepts, setDismissedTutorialConcepts] = useState<Set<TutorialConceptId>>(() => new Set());
  const [parallelUniversesIntroOpen, setParallelUniversesIntroOpen] = useState(false);
  const [parallelUniversesSpotlight, setParallelUniversesSpotlight] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  // Blocking failure on the touchdown submit — keeps the SubmitModal open so
  // the player can retry rather than silently losing the run.
  const [submitError, setSubmitError] = useState<string | undefined>();
  // Non-blocking notice (e.g. a best-effort individual submit failed mid-series).
  const [submitNotice, setSubmitNotice] = useState<string | undefined>();

  // Tutorial attempts start with orientation rather than a scripted sequence.
  // The compact objective disappears after play begins; persistent concept
  // progress decides which contextual captions are genuinely new.
  const beginTutorialAttempt = useCallback((scenario: Scenario, step: number, showAutomatic = true, replayGuidance = false) => {
    const lesson = tutorialLessonFor(scenario.id);
    const guidanceEnabled = (prefs.showTutorialGuidance ?? true) && showAutomatic;
    setTutorialLesson(lesson && guidanceEnabled ? { lesson, step } : null);
    setDismissedTutorialConcepts(new Set());
    setParallelUniversesIntroOpen(false);
    setParallelUniversesSpotlight(false);
    setReplayLearnedConcepts(replayGuidance);
    setTutorialConceptGuideOpen(false);
    if (lesson && guidanceEnabled) trackAnalytics('interaction', { name: 'tutorial-guide', outcome: 'objective-shown', scenarioId: scenario.id });
  }, [prefs.showTutorialGuidance]);

  const dismissTutorialLesson = useCallback(() => {
    if (!tutorialLesson) return;
    trackAnalytics('interaction', { name: 'tutorial-guide', outcome: 'objective-dismissed' });
    setTutorialLesson(null);
  }, [tutorialLesson]);

  const showCurrentTutorialGuidance = useCallback(() => {
    const isPlayablePuzzle = appMode === 'series-puzzle' || appMode === 'puzzle';
    if (!isPlayablePuzzle || !activeScenario || editorPreviewScenario) return;
    setTutorialConceptGuideOpen(true);
    trackAnalytics('interaction', { name: 'tutorial-guide', outcome: 'opened', scenarioId: activeScenario.id });
  }, [activeScenario, appMode, editorPreviewScenario]);

  // ── Viewport shape ───────────────────────────────────────────────────────
  // Three separate questions — see useMediaQuery.ts for why none of them is a
  // proxy for the others.
  //   compact  — is there room for the side columns?  (size)
  //   hover    — can the preview follow a cursor?     (input capability)
  //
  // The third, pointer precision, decides hit-target sizes and is answered
  // entirely in CSS — no component needs to branch on it.
  const compact = useCompactLayout();
  const phoneToolbar = usePhoneToolbarLayout();
  const hoverCapable = useHoverCapable();
  const portraitViewport = usePortraitViewport();
  // Rotating the board is worth it whenever the viewport is tall and narrow,
  // whatever is pointing at it — a narrow desktop window benefits just as
  // much as a phone. In landscape the pitch's own shape already fits.
  const pitchOrientation: PitchOrientation =
    compact && portraitViewport ? 'portrait' : 'landscape';

  // Parallel Universes is the standard game model. Before the first block it
  // contains one line and behaves like the ordinary one-board game.
  const branchedBoards = useBranchRun(makeEmptyState());
  const game = branchedBoards;
  const branchedSummary = branchedBoards.summary;

  const { state, setState, handleSquareClick: hookSquareClick, handleSquareHover: hookSquareHover,
          handleSquareLeave: hookSquareLeave, handleCancelSelection, handleResetMovement,
          handleHandoffAction, handleHandoffTarget,
          handlePassAction, handlePassTarget,
          handleBlockAction, handleBlockTarget, handlePushChoice } = game;

  const setBranchedState = branchedBoards.setState;
  // `phase: 'touchdown'` marks one branch scoring, not the run finishing, so
  // the branching summary needs its own dismissal flag rather than borrowing
  // the single-board trick of rewinding the phase.
  const [branchSummaryDismissed, setBranchSummaryDismissed] = useState(false);
  const [acknowledgedBranchTouchdowns, setAcknowledgedBranchTouchdowns] = useState<Set<string>>(
    () => new Set(),
  );
  const analyticsSplitRecordedRef = useRef(false);
  const resetBoards = useCallback((next: GameState) => {
    setBranchedState(next);
    setBranchSummaryDismissed(false);
    setAcknowledgedBranchTouchdowns(new Set());
  }, [setBranchedState]);

  const analyticsAttemptIdRef = useRef<string | null>(null);
  const analyticsAttemptEngagedRef = useRef(false);
  const analyticsActionLogLengthRef = useRef(0);
  const analyticsSeriesRunIdRef = useRef<string | null>(null);

  const beginAnalyticsAttempt = useCallback((scenario: Scenario, mode: 'standalone' | 'series', seriesPosition?: number) => {
    const attemptId = newAnalyticsId();
    analyticsAttemptIdRef.current = attemptId;
    analyticsAttemptEngagedRef.current = false;
    analyticsActionLogLengthRef.current = 0;
    setActiveAnalyticsAttempt(attemptId);
    trackAnalytics('puzzle-started', {
      attemptId, scenarioId: scenario.id, scenarioName: scenario.name, mode,
      ...(seriesPosition ? { seriesPosition } : {}),
    });
  }, []);

  const engageAnalyticsAttempt = useCallback(() => {
    const attemptId = analyticsAttemptIdRef.current;
    if (!attemptId || analyticsAttemptEngagedRef.current) return;
    analyticsAttemptEngagedRef.current = true;
    trackAnalytics('puzzle-engaged', { attemptId });
  }, []);

  const endAnalyticsAttempt = useCallback((outcome: 'completed' | 'restarted' | 'left-puzzle' | 'left-series' | 'replaced', detail: Record<string, unknown> = {}) => {
    const attemptId = analyticsAttemptIdRef.current;
    if (!attemptId) return;
    trackAnalytics('puzzle-ended', { attemptId, outcome, ...detail });
    analyticsAttemptIdRef.current = null;
    analyticsAttemptEngagedRef.current = false;
    setActiveAnalyticsAttempt(null);
  }, []);

  useEffect(() => {
    if (state.actionLog.length < analyticsActionLogLengthRef.current) {
      analyticsActionLogLengthRef.current = 0;
    }
    const fresh = state.actionLog.slice(analyticsActionLogLengthRef.current);
    if (fresh.length === 0 || !analyticsAttemptIdRef.current) return;
    engageAnalyticsAttempt();
    for (const entry of fresh) {
      const attemptId = analyticsAttemptIdRef.current;
      if (!attemptId) break;
      if (entry.kind === 'move') {
        trackAnalytics('puzzle-action', { attemptId, action: 'move' });
        if (entry.dodgeTarget) trackAnalytics('puzzle-action', { attemptId, action: 'dodge' });
        if (entry.isGfi) trackAnalytics('puzzle-action', { attemptId, action: 'rush' });
        if (entry.pickupTarget) trackAnalytics('puzzle-action', { attemptId, action: 'pickup' });
      } else if (entry.kind === 'handoff') {
        trackAnalytics('puzzle-action', { attemptId, action: 'handoff' });
      } else if (entry.kind === 'pass') {
        trackAnalytics('puzzle-action', { attemptId, action: 'pass' });
      } else if (entry.kind === 'pass-catch') {
        trackAnalytics('puzzle-action', { attemptId, action: 'catch' });
      } else if (entry.kind === 'block') {
        trackAnalytics('puzzle-action', { attemptId, action: 'block' });
        if (entry.isBlitz) trackAnalytics('puzzle-action', { attemptId, action: 'blitz' });
      }
    }
    analyticsActionLogLengthRef.current = state.actionLog.length;
  }, [state.actionLog, engageAnalyticsAttempt]);

  useEffect(() => {
    if (!branchedBoards.hasSplit) {
      analyticsSplitRecordedRef.current = false;
      return;
    }
    if (analyticsSplitRecordedRef.current || !analyticsAttemptIdRef.current) return;
    analyticsSplitRecordedRef.current = true;
    trackAnalytics('puzzle-action', {
      attemptId: analyticsAttemptIdRef.current, action: 'universe-split',
    });
  }, [branchedBoards.hasSplit]);

  const identityName = currentUser ? googleAliases[currentUser.id] ?? '' : guestAlias;
  const identityReady = Boolean(identityName.trim());
  // Records one login per app session/mount, not on every alias edit — see
  // shared/loginTracking.js. Fires the moment identity is ready, whether that
  // is immediate (a returning player's stored alias) or after the first-time
  // IdentityGate submission below.
  const loginRecordedRef = useRef(false);
  useEffect(() => {
    if (!identityReady || loginRecordedRef.current) return;
    loginRecordedRef.current = true;
    void recordLogin(identityName, idToken);
  }, [identityReady, identityName, idToken]);
  // Defense in depth: render home if stale client state somehow points at the
  // editor before the server has confirmed access for the current identity.
  const effectiveAppMode = appMode === 'admin' && !isAdmin ? 'home' : appMode;
  useLayoutEffect(() => {
    if (effectiveAppMode !== 'puzzle' && effectiveAppMode !== 'series-puzzle'
      && effectiveAppMode !== 'series-select') return;
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
  const openReport = () => {
    trackAnalytics('interaction', { name: 'report-dialog', outcome: 'opened' });
    setReportOpen(true);
  };
  // A lapsed Google session still shows the player as signed in, but writes
  // would 401. Offer the fix before they lose a run to it.
  const expiredBanner = sessionExpired && (
    <div className="app__notice app__notice--warning" role="status">
      <span>SIGN-IN EXPIRED: Scores cannot be saved until you sign in again.</span>
      <button type="button" className="app__notice-action" onClick={signOut}>
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
      onClose={() => {
        trackAnalytics('interaction', { name: 'report-dialog', outcome: 'closed' });
        setReportOpen(false);
      }}
      onResult={(outcome, type) => {
        trackAnalytics('interaction', { name: 'report-submit', outcome, value: type });
      }}
    />
  );
  const aboutModal = aboutOpen && (
    <AboutDialog
      version={__BBT_VERSION__}
      deployedAt={__BBT_DEPLOYED_AT__}
      onClose={() => {
        trackAnalytics('interaction', { name: 'about', outcome: 'closed' });
        setAboutOpen(false);
      }}
      onOpenReleaseNotes={() => {
        trackAnalytics('interaction', { name: 'release-notes', outcome: 'opened' });
        setAboutOpen(false);
        setReleaseNotesOpen(true);
      }}
    />
  );
  const releaseNotesModal = releaseNotesOpen && (
    <ReleaseNotesDialog
      notes={releaseNotes}
      onClose={() => {
        trackAnalytics('interaction', { name: 'release-notes', outcome: 'closed' });
        setReleaseNotesOpen(false);
      }}
    />
  );
  const contactModal = contactOpen && (
    <ContactModal
      defaultName={identityName}
      onClose={() => {
        trackAnalytics('interaction', { name: 'contact-dialog', outcome: 'closed' });
        setContactOpen(false);
      }}
      onResult={outcome => {
        trackAnalytics('interaction', { name: 'contact-submit', outcome });
      }}
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
    trackAnalytics('interaction', { name: 'settings', outcome: 'opened' });
    setSettingsReturnMode(current => (appMode === 'settings' ? current : appMode));
    setAppMode('settings');
  }, [appMode]);

  const openHelp = useCallback(() => {
    trackAnalytics('interaction', { name: 'help', outcome: 'opened' });
    setHelpReturnMode(current => (appMode === 'help' ? current : appMode));
    setAppMode('help');
  }, [appMode]);

  const accountMenu = (
    <UserMenu
      name={identityName}
      avatar={avatar}
      country={publicProfile?.country}
      onHelp={openHelp}
      onSettings={openSettings}
      onAbout={() => {
        trackAnalytics('interaction', { name: 'about', outcome: 'opened' });
        setAboutOpen(true);
      }}
      onContact={() => {
        trackAnalytics('interaction', { name: 'contact-dialog', outcome: 'opened' });
        setContactOpen(true);
      }}
      onReport={openReport}
      onSignOut={handleSignOut}
    />
  );

  const archiveControls = (
    <div className="app__account-controls">
      {accountMenu}
    </div>
  );

  const startPuzzle = useCallback((scenario: Scenario) => {
    setLeaderboardReturnMode('home');
    setEditorPreviewScenario(null);
    setActiveScenario(scenario);
    const s = makeScenarioState(scenario);
    resetBoards(s);
    const lessonIndex = TUTORIAL_LESSON_IDS.indexOf(scenario.id);
    beginTutorialAttempt(scenario, lessonIndex + 1);
    beginAnalyticsAttempt(scenario, 'standalone');
    setAppMode('puzzle');
  }, [resetBoards, beginTutorialAttempt, beginAnalyticsAttempt]);

  const previewPuzzle = useCallback((scenario: Scenario) => {
    setTutorialLesson(null);
    setTutorialConceptGuideOpen(false);
    setEditorPreviewScenario(scenario);
    setActiveScenario(scenario);
    const s = makeScenarioState(scenario);
    resetBoards(s);
    setAppMode('puzzle');
  }, [resetBoards]);

  const goLeaderboard = useCallback((scenario: Scenario, returnMode: 'home' | 'series-select' = 'home') => {
    setActiveScenario(scenario);
    setLeaderboardHighlight(undefined);
    setLeaderboardReturnMode(returnMode);
    setAppMode('leaderboard');
  }, []);

  // Push-back square choice: if the resolution offers a follow-up (Defender
  // Down only), remember the chosen square and ask Yes/No before finalizing;
  // otherwise resolve immediately with followUp: false.
  const [pendingPushSquare, setPendingPushSquare] = useState<{ col: number; row: number } | null>(null);

  // ── Plot the route, then confirm once ─────────────────────────────────────
  // Intermediate waypoints commit provisionally so the player can keep shaping
  // the route. Clicking the already-plotted route tip marks the move finished;
  // only then does the final Confirm Move / Plot Again choice appear.
  const [armedMove, setArmedMove] = useState<{
    context: string;
    destination: Position;
  } | null>(null);
  const [finishedMove, setFinishedMove] = useState<{
    context: string;
    destination: Position;
  } | null>(null);
  // Passing and handing off used to execute as soon as a receiver was tapped.
  // Keep that target provisional until the same red/green pitch decision used
  // for movement has been answered.
  const [pendingTransfer, setPendingTransfer] = useState<{
    kind: 'pass' | 'handoff';
    position: Position;
  } | null>(null);
  const movementContext = state.selectedPieceId
    ? `${state.selectedPieceId}:${state.walkedSquares.length}`
    : null;
  const activeArmedMove = armedMove?.context === movementContext ? armedMove : null;
  const activeFinishedMove = finishedMove?.context === movementContext ? finishedMove : null;
  const activeTransfer = pendingTransfer
    && ((pendingTransfer.kind === 'pass'
      && state.isPassTargeting
      && state.passReceiverKeys.has(key(pendingTransfer.position)))
    || (pendingTransfer.kind === 'handoff'
      && state.isHandoffTargeting
      && state.handoffTargets.has(key(pendingTransfer.position))))
    ? pendingTransfer
    : null;
  // Which player's card the side panel / bottom sheet is showing. Follows the
  // cursor on a mouse and the last tapped square on touch.
  const [hoveredPiece, setHoveredPiece] = useState<PlayerPiece | null>(null);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);

  const disarm = useCallback(() => {
    setArmedMove(null);
    setFinishedMove(null);
    setPendingTransfer(null);
  }, []);

  const finishMove = useCallback((
    context: string,
    destination: Position,
  ) => {
    setArmedMove(null);
    setFinishedMove({ context, destination });
  }, []);

  /**
   * Touch still needs its preview-first tap. Hover-capable pointers commit
   * ordinary waypoints immediately; a scoring destination remains previewed
   * until clicking that already-previewed endpoint opens final confirmation.
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
      && Boolean(selected && (attacksTopEndZone(selected.team) ? row === 0 : row === 25));
    const samePreview = activeArmedMove && key(activeArmedMove.destination) === k;

    if (samePreview) {
      // A touchdown must never slip through as an ordinary waypoint. Even a
      // repeat tap leaves it staged as the route endpoint and exposes the
      // final decision without committing the touchdown first.
      if (scores) {
        finishMove(movementContext, destination);
        return true;
      }
      if (!hoverCapable) {
        setArmedMove(null);
        return false;
      }
    }

    if (hoverCapable && !scores) return false;

    setArmedMove({ context: movementContext, destination });
    hookSquareHover(col, row);
    const piece = state.pieces.find(p => key(p.position) === k);
    setHoveredPiece(piece ?? null);
    return true;
  }, [movementContext, state.reachableKeys, state.pieces, state.selectedPieceId,
      state.ballPosition, state.pathPreview, activeArmedMove, hoverCapable,
      finishMove, hookSquareHover]);

  // Route square clicks: targeting modes take priority over normal movement
  const handleSquareClick = useCallback((col: number, row: number) => {
    if (state.isHandoffTargeting) {
      if (state.handoffTargets.has(key({ col, row }))) {
        setPendingTransfer({ kind: 'handoff', position: { col, row } });
      }
    } else if (state.isPassTargeting) {
      if (state.passReceiverKeys.has(key({ col, row }))) {
        setPendingTransfer({ kind: 'pass', position: { col, row } });
      }
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
        finishMove(movementContext, routeTip);
        return;
      }
      if (previewBeforeCommit(col, row)) return;
      setArmedMove(null);
      hookSquareClick(col, row);
    }
  }, [state.isHandoffTargeting, state.handoffTargets, state.isPassTargeting, state.passReceiverKeys,
      state.isBlockTargeting, state.pendingBlockResolution,
      state.pushTargetKeys, state.committedPath, state.pendingBlock, movementContext,
      handleBlockTarget, handlePushChoice,
      hookSquareClick, previewBeforeCommit, finishMove]);

  // Escape cancels the current activation. Dialogs handle their own Escape via
  // useModalFocus and stop propagation, so this only fires on the board.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (activeTransfer) {
        setPendingTransfer(null);
        return;
      }
      if (analyticsAttemptIdRef.current && state.selectedPieceId) {
        trackAnalytics('puzzle-action', {
          attemptId: analyticsAttemptIdRef.current, action: 'action-cancel',
        });
      }
      disarm();
      handleCancelSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTransfer, disarm, handleCancelSelection, state.selectedPieceId]);

  // Context menu state
  const [pieceMenu, setPieceMenu] = useState<{ piece: PlayerPiece; anchor: MenuAnchor } | null>(null);

  const handlePieceClick = useCallback((col: number, row: number, anchor: MenuAnchor) => {
    const k = key({ col, row });
    const piece = state.pieces.find(p => key(p.position) === k);
    if (!piece) return;

    // The opening card is orientation, not a recurring coach step. Once the
    // player starts inspecting the board it stays collapsed for this attempt.
    setTutorialLesson(null);

    // Touch has no hover, so a tap is the only way the player card can learn
    // which player to show — including opponents, whose skills are exactly
    // what you need before deciding whether to block them.
    if (!hoverCapable) setHoveredPiece(piece);
    if (compact) setMobileInfoOpen(true);

    // During handoff targeting, clicking a highlighted receiver stages it for confirmation.
    if (state.isHandoffTargeting) {
      if (state.handoffTargets.has(k)) {
        setPendingTransfer({ kind: 'handoff', position: { col, row } });
      } else {
        setPendingTransfer(null);
        handleCancelSelection();
      }
      return;
    }

    // During pass targeting, clicking a highlighted receiver stages it for confirmation.
    if (state.isPassTargeting) {
      if (state.passReceiverKeys.has(k)) {
        setPendingTransfer({ kind: 'pass', position: { col, row } });
      } else {
        setPendingTransfer(null);
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

    // With movement plotted, clicking either the route-tip ghost or the
    // original token opens the one final confirmation. Before any movement,
    // clicking the selected player again cancels the provisional activation:
    // it must not spend that player's turn merely because the player backed
    // out of Move + Pass (or another declared action).
    if (piece.id === state.selectedPieceId) {
      const routeTip = state.committedPath[state.committedPath.length - 1];
      if (movementContext && routeTip) {
        finishMove(movementContext, routeTip);
        return;
      }
      disarm();
      handleCancelSelection();
      return;
    }

    // Own unactivated piece — show context menu
    if (piece.team === state.activeTeam && !piece.activated) {
      if (compact) setMobileInfoOpen(false);
      setPieceMenu({ piece, anchor });
      return;
    }

    // Anything else (opponent, activated piece) — fall through to normal click
    hookSquareClick(col, row);
  }, [state.pieces, state.selectedPieceId, state.reachableKeys, state.activeTeam,
      state.isHandoffTargeting, state.handoffTargets, state.isPassTargeting, state.passReceiverKeys,
      state.isBlockTargeting, state.blockTargets, state.pendingBlockIsBlitz, state.blitzTargetId,
      state.committedPath, movementContext,
      hookSquareClick, handleBlockTarget, handleCancelSelection,
      previewBeforeCommit, finishMove, disarm, hoverCapable, compact]);

  const handleMenuAction = useCallback((actionKey: string, moveFirst: boolean) => {
    if (!pieceMenu) return;
    if (!editorPreviewScenario && activeScenario && tutorialConceptsForScenario(activeScenario.id).length > 0) {
      const used: TutorialConceptId[] = [];
      if (actionKey === 'move') used.push('movement');
      if (actionKey === 'handoff') used.push('handoff');
      if (actionKey === 'pass') used.push('passing');
      if (actionKey === 'block' || actionKey === 'blitz') used.push('blocks-blitzes');
      if (activeScenario.id === 'scenario-005') used.push('activation-order');
      updateTutorialConcepts(used, 'used');
    }
    setPendingTransfer(null);
    engageAnalyticsAttempt();
    if (analyticsAttemptIdRef.current) {
      trackAnalytics('puzzle-action', { attemptId: analyticsAttemptIdRef.current, action: 'select' });
    }
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
  }, [activeScenario, compact, editorPreviewScenario, engageAnalyticsAttempt, handleBlockAction,
      handleHandoffAction, handlePassAction, hookSquareClick, pieceMenu, updateTutorialConcepts]);

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
  const unresolvedBranchList = useMemo(
    () => unfinishedBranches(branchedBoards.strip),
    [branchedBoards.strip],
  );
  const viewedBranchId = branchedBoards.run.viewedId;
  const showStalledRunDialog = isScoringRunStalled(state);
  const showUnfinishedBranchesDialog = branchedBoards.hasSplit
    && state.phase === 'touchdown'
    && unresolvedBranchList.length > 0
    && !acknowledgedBranchTouchdowns.has(viewedBranchId);
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
    endAnalyticsAttempt('completed', {
      probability,
      diceCount,
      activatedPieces: state.pieces.filter(piece => piece.team === state.activeTeam && piece.activated).length,
      committedActions: state.actionLog.length,
      lastAction: state.actionLog.at(-1)?.kind === 'pass-catch' ? 'catch' : state.actionLog.at(-1)?.kind,
    });
  }, [runFinished, branchedBoards.hasSplit, branchedSummary, state.actionLog, state.pieces,
      state.activeTeam, activeScenario, endAnalyticsAttempt]);

  // Submission handler (standalone puzzle mode)
  const handleSubmit = useCallback(async (name: string) => {
    if (!activeScenario) return;
    const { cumulativeProb, diceCount, moves } = summarizeActionLog(state.actionLog);
    setSubmitError(undefined);
    trackAnalytics('interaction', { name: 'score-submit', outcome: 'attempted' });
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
      trackAnalytics('interaction', { name: 'score-submit', outcome: 'succeeded' });
    } catch (error) {
      // A silently swallowed failure here used to look exactly like success:
      // the player landed on the leaderboard with their score missing and no
      // explanation. Say what happened and let them retry.
      setSubmitError(describeSubmitError(error));
      trackAnalytics('interaction', { name: 'score-submit', outcome: 'failed' });
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
    trackAnalytics('interaction', { name: 'score-submit', outcome: 'attempted' });
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
      trackAnalytics('interaction', { name: 'score-submit', outcome: 'succeeded' });
    } catch (error) {
      setSubmitError(describeSubmitError(error));
      trackAnalytics('interaction', { name: 'score-submit', outcome: 'failed' });
    }
  }, [activeScenario, branchedBoards, idToken]);

  const handleSkipSubmit = useCallback(() => {
    trackAnalytics('interaction', { name: 'score-submit', outcome: 'skipped' });
    setState(s => ({ ...s, phase: 'playing' }));
    setAppMode('home');
  }, [setState]);

  const handleRestartTurn = useCallback(() => {
    if (!activeScenario) return;
    endAnalyticsAttempt('restarted', {
      activatedPieces: state.pieces.filter(piece => piece.team === state.activeTeam && piece.activated).length,
      committedActions: state.actionLog.length,
    });
    setReviewingCompletedBoard(false);
    const s = makeScenarioState(activeScenario);
    resetBoards(s);
    const lessonIndex = TUTORIAL_LESSON_IDS.indexOf(activeScenario.id);
    beginTutorialAttempt(activeScenario, appMode === 'series-puzzle'
      ? (seriesRun?.puzzleIndex ?? 0) + 1
      : lessonIndex + 1);
    beginAnalyticsAttempt(activeScenario, appMode === 'series-puzzle' ? 'series' : 'standalone',
      appMode === 'series-puzzle' ? (seriesRun?.puzzleIndex ?? 0) + 1 : undefined);
  }, [activeScenario, state.pieces, state.activeTeam, state.actionLog.length, resetBoards,
      beginAnalyticsAttempt, endAnalyticsAttempt, appMode, seriesRun,
      beginTutorialAttempt]);

  const handleExitFailedPuzzle = useCallback(() => {
    endAnalyticsAttempt('left-puzzle', {
      activatedPieces: state.pieces.filter(piece =>
        piece.team === state.activeTeam && piece.activated).length,
      committedActions: state.actionLog.length,
      reason: 'activated-ball-carrier',
    });
    setReviewingCompletedBoard(false);
    setAcknowledgedBranchTouchdowns(new Set());
    setActiveScenario(null);
    setTutorialLesson(null);
    setTutorialConceptGuideOpen(false);
    setPieceMenu(null);
    if (editorPreviewScenario) {
      setAppMode('admin');
      return;
    }
    setAppMode(appMode === 'series-puzzle' && seriesRun ? 'series-select' : 'home');
  }, [appMode, editorPreviewScenario, endAnalyticsAttempt, seriesRun,
      state.actionLog.length, state.activeTeam, state.pieces]);

  const handleContinueUnfinishedBranches = useCallback(() => {
    setAcknowledgedBranchTouchdowns(current => {
      const next = new Set(current);
      next.add(viewedBranchId);
      return next;
    });
    const nextBranch = unresolvedBranchList[0];
    if (nextBranch) branchedBoards.handleSelectBranch(nextBranch.id);
  }, [branchedBoards, unresolvedBranchList, viewedBranchId]);

  // ── Series mode handlers ──────────────────────────────────────────────────
  const startSeries = useCallback((selectedSeries: SeriesDefinition) => {
    if (!identityName.trim()) return;
    if (resolveSeriesScenarios(selectedSeries, scenarioData.scenarios).length === 0) return;
    setSeriesRun({ seriesId: selectedSeries.id, playerName: identityName, puzzleIndex: 0, results: [] });
    const analyticsRunId = newAnalyticsId();
    analyticsSeriesRunIdRef.current = analyticsRunId;
    trackAnalytics('series-started', { runId: analyticsRunId, seriesId: selectedSeries.id });
    setReviewingCompletedBoard(false);
    setTutorialRecaps({});
    setPendingTutorialReplay(null);
    setActiveScenario(null);
    setTutorialLesson(null);
    setTutorialConceptGuideOpen(false);
    setAppMode('series-select');
  }, [identityName, scenarioData.scenarios]);

  const chooseSeriesPuzzle = useCallback((scenario: Scenario, replayGuidance = false) => {
    if (!seriesRun) return;
    const puzzleIndex = seriesScenarios.findIndex(item => item.id === scenario.id);
    if (puzzleIndex < 0) return;
    setSeriesRun({ ...seriesRun, puzzleIndex });
    setReviewingCompletedBoard(false);
    setSubmitError(undefined);
    setActiveScenario(scenario);
    const s = makeScenarioState(scenario);
    resetBoards(s);
    beginTutorialAttempt(scenario, puzzleIndex + 1, replayGuidance || !seriesRun.results.some(result => result.scenarioId === scenario.id), replayGuidance);
    beginAnalyticsAttempt(scenario, 'series', seriesRun.results.length + 1);
    setAppMode('series-puzzle');
  }, [seriesRun, seriesScenarios, resetBoards,
      beginTutorialAttempt, beginAnalyticsAttempt]);

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
    setTutorialRecaps(current => ({
      ...current,
      [activeScenario.id]: {
        actions: tutorialActionSequence(state.actionLog),
        probability,
      },
    }));
    setSubmitError(undefined);
    trackAnalytics('interaction', { name: 'series-score-submit', outcome: 'attempted' });

    // Submit to the puzzle's own leaderboard too (best-effort — the series run
    // is the thing being scored, so a failure here must not cost the player
    // their progress. It is surfaced as a non-blocking notice instead).
    try {
      await submitScore(
        activeScenario.id, seriesRun.playerName, probability, diceCount,
        moves, state.actionLog, idToken, tree,
      );
      trackAnalytics('interaction', { name: 'series-score-submit', outcome: 'succeeded' });
    } catch (error) {
      setSubmitNotice(`This puzzle's individual score wasn't saved (${describeSubmitError(error)}). Your series run continues.`);
      trackAnalytics('interaction', { name: 'series-score-submit', outcome: 'failed' });
    }

    const result: SeriesPuzzleResult = {
      scenarioId: activeScenario.id,
      scenarioName: activeScenario.name,
      probability,
      diceCount,
      moves,
      ...(tree ? { tree } : {}),
    };
    const results = upsertSeriesPuzzleResult(seriesRun.results, result);
    const completionPosition = results.length;
    if (analyticsSeriesRunIdRef.current) {
      trackAnalytics('series-advanced', {
        runId: analyticsSeriesRunIdRef.current,
        scenarioId: activeScenario.id,
        position: completionPosition,
      });
    }

    if (results.length < seriesScenarios.length) {
      setReviewingCompletedBoard(false);
      setSeriesRun({ ...seriesRun, results });
      setActiveScenario(null);
      setTutorialLesson(null);
      setTutorialConceptGuideOpen(false);
      setState(s => ({ ...s, phase: 'playing' }));
      setAppMode('series-select');
      return;
    }

    if (analyticsSeriesRunIdRef.current) {
      trackAnalytics('series-ended', { runId: analyticsSeriesRunIdRef.current, outcome: 'completed' });
      analyticsSeriesRunIdRef.current = null;
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
      branchedBoards.run, branchedBoards.summary, setState, idToken]);

  const requestLeaveSeries = useCallback(() => {
    setConfirmLeaveSeries(true);
  }, []);

  const confirmLeaveSeriesYes = useCallback(() => {
    endAnalyticsAttempt('left-series', {
      activatedPieces: state.pieces.filter(piece => piece.team === state.activeTeam && piece.activated).length,
      committedActions: state.actionLog.length,
    });
    if (analyticsSeriesRunIdRef.current) {
      trackAnalytics('series-ended', { runId: analyticsSeriesRunIdRef.current, outcome: 'left' });
      analyticsSeriesRunIdRef.current = null;
    }
    setConfirmLeaveSeries(false);
    setReviewingCompletedBoard(false);
    setSeriesRun(null);
    setActiveScenario(null);
    setTutorialLesson(null);
    setTutorialConceptGuideOpen(false);
    setAppMode('home');
  }, [endAnalyticsAttempt, state.pieces, state.activeTeam, state.actionLog.length]);

  const confirmLeaveSeriesNo = useCallback(() => {
    setConfirmLeaveSeries(false);
  }, []);

  const handleBackClick = useCallback(() => {
    if (appMode === 'series-puzzle') {
      requestLeaveSeries();
    } else if (editorPreviewScenario) {
      setAppMode('admin');
    } else {
      endAnalyticsAttempt('left-puzzle', {
        activatedPieces: state.pieces.filter(piece => piece.team === state.activeTeam && piece.activated).length,
        committedActions: state.actionLog.length,
      });
      setAppMode('home');
    }
  }, [appMode, editorPreviewScenario, requestLeaveSeries, endAnalyticsAttempt,
      state.pieces, state.activeTeam, state.actionLog.length]);

  // ── Render: non-game screens ─────────────────────────────────────────────
  if (!identityReady) {
    return (
      <div className="app app--home app--landing app--playbook">
        <IdentityGate
          authConfigured={authConfigured}
          googleSignedIn={Boolean(currentUser)}
          mountGoogleSignInButton={mountSignInButton}
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
          onHelp={openHelp}
          onSettings={openSettings}
          onAbout={() => {
            trackAnalytics('interaction', { name: 'about', outcome: 'opened' });
            setAboutOpen(true);
          }}
          progress={progress}
          userId={currentUser?.id}
          isAdmin={isAdmin}
          userMenu={accountMenu}
        />
        {notice}
        {reportModal}
        {aboutModal}
        {releaseNotesModal}
        {contactModal}
        <AppFooter />
      </div>
    );
  }

  if (effectiveAppMode === 'series-select' && seriesRun) {
    const completedScenarioIds = new Set(seriesRun.results.map(result => result.scenarioId));
    return (
      <div className="app app--home app--archive app--playbook">
        {archiveControls}
        <TutorialPuzzleChooser
          seriesName={activeSeries?.name ?? 'Series'}
          scenarios={seriesScenarios}
          completedScenarioIds={completedScenarioIds}
          recaps={tutorialRecaps}
          onChoose={scenario => {
            if (completedScenarioIds.has(scenario.id)) setPendingTutorialReplay(scenario);
            else chooseSeriesPuzzle(scenario);
          }}
          onLeaderboard={scenario => goLeaderboard(scenario, 'series-select')}
          onLeave={requestLeaveSeries}
        />
        {pendingTutorialReplay && (
          <ReplayGuidanceDialog
            scenario={pendingTutorialReplay}
            onChoose={showGuidance => {
              const scenario = pendingTutorialReplay;
              setPendingTutorialReplay(null);
              chooseSeriesPuzzle(scenario, showGuidance);
            }}
            onCancel={() => setPendingTutorialReplay(null)}
          />
        )}
        {confirmLeaveSeries && (
          <ConfirmDialog
            title="Leave tutorial series?"
            message="Your completed drills in this series run will be lost."
            confirmLabel="Leave"
            cancelLabel="Keep Choosing"
            onConfirm={confirmLeaveSeriesYes}
            onCancel={confirmLeaveSeriesNo}
          />
        )}
        {notice}
        {reportModal}
        {aboutModal}
        {releaseNotesModal}
        {contactModal}
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
          {releaseNotesModal}
          {contactModal}
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
        {releaseNotesModal}
        {contactModal}
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
          onReport={openReport}
          previewScenario={editorPreviewScenario}
          idToken={idToken}
        />
        {reportModal}
        {aboutModal}
        {releaseNotesModal}
        {contactModal}
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
          avatar={avatar}
          avatarIsLocalOnly={avatarIsLocalOnly}
          googleAvatarAvailable={Boolean(currentUser?.picture)}
          onAvatarUpload={async dataUrl => {
            await updatePublicProfile({ avatar: { source: 'upload', dataUrl } });
            trackAnalytics('interaction', { name: 'setting-avatar', outcome: 'changed', value: 'upload' });
          }}
          onUseGoogleAvatar={async () => {
            await updatePublicProfile({ avatar: { source: 'google' } });
            trackAnalytics('interaction', { name: 'setting-avatar', outcome: 'changed', value: 'google' });
          }}
          onRemoveAvatar={async () => {
            await updatePublicProfile({ avatar: null });
            trackAnalytics('interaction', { name: 'setting-avatar', outcome: 'changed', value: false });
          }}
          country={publicProfile?.country ?? ''}
          onCountryChange={async country => {
            await updatePublicProfile({ country });
            trackAnalytics('interaction', { name: 'setting-country', outcome: 'changed', value: Boolean(country) });
          }}
          tokenStyle={prefs.tokenStyle ?? 'portrait'}
          onTokenStyleChange={tokenStyle => {
            trackAnalytics('interaction', { name: 'setting-token-style', outcome: 'changed', value: tokenStyle });
            setPrefs({ tokenStyle });
          }}
          pitchSurface={prefs.pitchSurface ?? 'grass'}
          onPitchSurfaceChange={pitchSurface => {
            trackAnalytics('interaction', { name: 'setting-pitch-surface', outcome: 'changed', value: pitchSurface });
            setPrefs({ pitchSurface });
          }}
          boardSize={prefs.boardSize ?? 'medium'}
          onBoardSizeChange={boardSize => {
            trackAnalytics('interaction', { name: 'setting-board-size', outcome: 'changed', value: boardSize });
            setPrefs({ boardSize });
          }}
          showCoordinates={prefs.showCoordinates ?? true}
          onShowCoordinatesChange={showCoordinates => {
            trackAnalytics('interaction', { name: 'setting-coordinates', outcome: 'changed', value: showCoordinates });
            setPrefs({ showCoordinates });
          }}
          showTutorialGuidance={prefs.showTutorialGuidance ?? true}
          onShowTutorialGuidanceChange={showTutorialGuidance => {
            trackAnalytics('interaction', { name: 'setting-tutorial-guidance', outcome: 'changed', value: showTutorialGuidance });
            setPrefs({ showTutorialGuidance });
          }}
          onBack={() => {
            trackAnalytics('interaction', { name: 'settings', outcome: 'closed' });
            setAppMode(settingsReturnMode);
          }}
        />
        {notice}
        {reportModal}
        {aboutModal}
        {releaseNotesModal}
        {contactModal}
        <AppFooter />
      </div>
    );
  }

  if (effectiveAppMode === 'help') {
    return (
      <div className="app app--home app--archive app--playbook">
        {archiveControls}
        <HelpScreen
          onBack={() => {
            trackAnalytics('interaction', { name: 'help', outcome: 'closed' });
            setAppMode(helpReturnMode);
          }}
        />
        {notice}
        {reportModal}
        {aboutModal}
        {releaseNotesModal}
        {contactModal}
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
          {releaseNotesModal}
          {contactModal}
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
          onBack={() => { setLeaderboardInitialEntries(undefined); setAppMode(leaderboardReturnMode); }}
          highlightId={leaderboardHighlight}
          initialEntries={leaderboardInitialEntries}
          onEntriesLoaded={setLeaderboardInitialEntries}
          onRowClick={setSelectedEntry}
        />
        {notice}
        {reportModal}
        {aboutModal}
        {releaseNotesModal}
        {contactModal}
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
  const activationStatus = activeTransfer?.kind === 'handoff'
    ? 'HAND-OFF READY: Confirm the receiver or choose another.'
    : activeTransfer?.kind === 'pass'
    ? 'PASS READY: Confirm the receiver or choose another.'
    : state.isHandoffTargeting
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
    ? `ROUTE READY: ${state.remainingMa} MA remaining. Click the preview endpoint when finished.`
    : state.selectedPieceId && state.committedPath.length > 0
    ? `ACTIVATION: ${state.remainingMa} MA remaining. Click the route endpoint when finished.`
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
      Series progress {seriesRun.results.length} / {seriesScenarios.length} complete
    </span>
  ) : null;
  const completedSeriesPuzzlesAfterCurrent = seriesRun
    ? seriesRun.results.length + (activeScenario
      && !seriesRun.results.some(result => result.scenarioId === activeScenario.id) ? 1 : 0)
    : 0;
  const statusLine = (
    <div className="hud__status">
      {compact && seriesCounter && <>{seriesCounter}{' '}</>}
      {activationStatus}
    </div>
  );
  const activeTutorialConcepts = activeScenario ? tutorialConceptsForScenario(activeScenario.id) : [];
  const objectiveVisible = Boolean(
    tutorialLesson
    && !pieceMenu
    && !state.selectedPieceId
    && state.actionLog.length === 0,
  );
  const guidanceEnabled = !editorPreviewScenario && (prefs.showTutorialGuidance ?? true);
  const conceptIsAvailable = (id: TutorialConceptId) => activeTutorialConcepts.some(concept => concept.id === id);
  const conceptCanIntroduce = (id: TutorialConceptId) => conceptIsAvailable(id)
    && (replayLearnedConcepts || !tutorialConceptProgress?.[id])
    && !dismissedTutorialConcepts.has(id);
  let activeTutorialCaptionId: TutorialConceptId | undefined;
  if (guidanceEnabled && !objectiveVisible && !tutorialConceptGuideOpen && !parallelUniversesIntroOpen) {
    if (activeScenario?.id === 'scenario-005' && state.selectedPieceId && conceptCanIntroduce('activation-order')) {
      activeTutorialCaptionId = 'activation-order';
    } else if (pieceMenu && activeScenario?.id === 'scenario-003' && conceptCanIntroduce('passing')) {
      activeTutorialCaptionId = 'passing';
    } else if (pieceMenu && activeScenario?.id === 'scenario-006' && conceptCanIntroduce('blocks-blitzes')) {
      activeTutorialCaptionId = 'blocks-blitzes';
    } else if (pieceMenu && activeScenario?.id === 'scenario-001' && conceptCanIntroduce('movement')) {
      activeTutorialCaptionId = 'movement';
    } else if (activeFinishedMove && conceptCanIntroduce('route-confirmation')) {
      activeTutorialCaptionId = 'route-confirmation';
    } else if (previewProb < 1 && conceptCanIntroduce('cumulative-probability')) {
      activeTutorialCaptionId = 'cumulative-probability';
    }
  }
  const activeTutorialCaption = activeTutorialCaptionId ? tutorialConceptFor(activeTutorialCaptionId) : undefined;
  const tutorialGuidanceAvailable = !editorPreviewScenario && activeTutorialConcepts.length > 0;

  return (
    <div className={`app app--game app--playbook${compact ? ' app--compact' : ''}`}>
      <header className="hud">
        <button className="hud__back" onClick={handleBackClick} aria-label={`Back to ${backLabel}`}>
          <span className="hud__btn-icon" aria-hidden="true">←</span>
          <span className="hud__btn-text">{backLabel}</span>
        </button>

        {!compact && <BrandLogo variant="wordmark" className="hud__brand" decorative />}

        {/* Keep account/Settings/About ahead of the game tools on narrow HUDs. */}
        {accountMenu}

        <div className={`hud__prob${!showSuccessChance && (compact || !seriesCounter) ? ' hud__prob--empty' : ''}`}>
          {!compact && seriesCounter}
          {showSuccessChance && <SuccessChanceReadout probability={liveProbPct} visible />}
        </div>

        {!compact && statusLine}

        {compact ? (
          <GameToolsMenu
            onTutorialGuide={
              tutorialGuidanceAvailable
                ? showCurrentTutorialGuidance
                : undefined
            }
            onRestart={handleRestartTurn}
            onReport={phoneToolbar ? openReport : undefined}
          />
        ) : (
          <>
            {tutorialGuidanceAvailable && (
              <button
                className="hud__guide"
                onClick={showCurrentTutorialGuidance}
                title="Tutorial guide"
                aria-label="Tutorial guide"
              >
                <span className="hud__btn-icon" aria-hidden="true">?</span>
                <span className="hud__btn-text">Guide</span>
              </button>
            )}

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

        {!phoneToolbar && <ReportProblemButton variant="hud" onClick={openReport} />}
      </header>

      <BranchStrip
        branches={branchedBoards.strip}
        tree={branchedBoards.tree}
        deadWeight={branchedBoards.summary.deadWeight}
        score={branchedBoards.summary.score}
        spotlight={parallelUniversesSpotlight}
        onDismissSpotlight={() => setParallelUniversesSpotlight(false)}
        onSelect={id => {
          setParallelUniversesSpotlight(false);
          branchedBoards.handleSelectBranch(id);
        }}
        onReset={branchedBoards.handleResetBranch}
        onResetToBranchPoint={branchedBoards.handleResetBranchToPoint}
        onConcede={id => {
          if (analyticsAttemptIdRef.current) {
            trackAnalytics('puzzle-action', {
              attemptId: analyticsAttemptIdRef.current, action: 'universe-give-up',
            });
          }
          branchedBoards.handleConcedeBranch(id);
        }}
      />

      <div className="game-area">
        <main className={`pitch-wrapper${(prefs.boardSize ?? 'medium') !== 'medium' ? ` pitch-wrapper--${prefs.boardSize}` : ''}`}>
          <Pitch
            state={state}
            onSquareClick={handleSquareClick}
            onPieceClick={handlePieceClick}
            onSquareHover={handleSquareHover}
            onSquareLeave={handleSquareLeave}
            orientation={pitchOrientation}
            tokenStyle={prefs.tokenStyle ?? 'portrait'}
            pitchSurface={prefs.pitchSurface ?? 'grass'}
            showCoordinates={prefs.showCoordinates ?? true}
            teams={activeScenario?.teams}
            branchGhosts={branchedBoards.ghosts}
            moveDecision={activeTransfer ? {
              position: activeTransfer.position,
              probability: null,
              ariaLabel: activeTransfer.kind === 'pass' ? 'Confirm pass' : 'Confirm hand-off',
              cancelLabel: 'Choose Another Receiver',
              confirmLabel: activeTransfer.kind === 'pass' ? 'Confirm Pass' : 'Confirm Hand-off',
              onCancel: () => setPendingTransfer(null),
              onConfirm: () => {
                const transfer = activeTransfer;
                setPendingTransfer(null);
                updateTutorialConcepts(['route-confirmation'], 'used');
                if (transfer.kind === 'pass') {
                  handlePassTarget(transfer.position.col, transfer.position.row);
                } else {
                  handleHandoffTarget(transfer.position.col, transfer.position.row);
                }
              },
            } : finishedPreview ? {
              position: finishedPreview,
              probability: showSuccessChance ? liveProbPct : null,
              onCancel: () => {
                disarm();
                hookSquareLeave();
                handleResetMovement();
              },
              onConfirm: () => {
                const usedConcepts: TutorialConceptId[] = ['movement', 'route-confirmation'];
                if (previewProb < 1) usedConcepts.push('cumulative-probability');
                if (state.pathPreview.some(step => step.dodgeTarget !== null)) {
                  usedConcepts.push('tackle-zones', 'dodging');
                }
                if (state.pathPreview.some(step => step.pickupTarget !== null)) usedConcepts.push('pickup');
                updateTutorialConcepts(usedConcepts, 'used');
                disarm();
                hookSquareClick(finishedPreview.col, finishedPreview.row);
              },
            } : undefined}
          />
        </main>

        {/* Two cards while a two-player action is being aimed. The rail
            scrolls rather than squeezing the board, and the cards go compact
            (see .side-col--comparing) so both usually fit without it. */}
        <div className={`side-col side-col--right${comparisonPiece ? ' side-col--comparing' : ''}`}>
          {comparisonPiece ? (
            <div
              className="player-matchup"
              role="group"
              aria-label={`${inspectedPiece?.name ?? 'Acting player'} versus ${comparisonPiece.name}`}
            >
              <PlayerPanel piece={inspectedPiece} side="right" role="acting" />
              <div className="player-matchup__divider" aria-hidden="true">VS</div>
              <PlayerPanel piece={comparisonPiece} side="right" role="target" />
            </div>
          ) : (
            <PlayerPanel piece={inspectedPiece} side="right" />
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
            completedSeriesPuzzlesAfterCurrent < seriesScenarios.length
              ? 'Choose Next Tutorial'
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
            completedSeriesPuzzlesAfterCurrent < seriesScenarios.length
              ? 'Choose Next Tutorial'
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

      {showStalledRunDialog && (
        <RunOutcomeDialog
          variant="failed"
          onRestart={handleRestartTurn}
          onExit={handleExitFailedPuzzle}
        />
      )}

      {showUnfinishedBranchesDialog && (
        <RunOutcomeDialog
          variant="unfinished-branches"
          remainingBranches={unresolvedBranchList.length}
          onContinue={handleContinueUnfinishedBranches}
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
        const emphasizedActions = !editorPreviewScenario && activeScenario
          ? tutorialLessonFor(activeScenario.id)?.emphasizedActions
          : undefined;
        // A piece can Hand Off / Pass if it already carries the ball, or if the
        // ball is currently loose on the pitch — in the latter case the player
        // is expected to move this piece onto the ball's square first (a pickup
        // roll), then hand off/pass with the ball it just picked up.
        const canHandoff = (menuPiece.hasBall || state.ballPosition !== null) && !state.passUsed && !menuPiece.activated;
        const canPass    = passActionAvailability(state, menuPiece);
        const { canBlock, canBlitz } = blockActionAvailability(menuPiece, state);
        const menuActions: PieceMenuAction[] = [
          { label: 'Move',     key: 'move', emphasized: emphasizedActions?.includes('move') },
          { label: 'Hand-off', key: 'handoff', disabled: !canHandoff, emphasized: emphasizedActions?.includes('handoff') },
          { label: 'Pass',     key: 'pass',    disabled: !canPass, emphasized: emphasizedActions?.includes('pass') },
          { label: 'Block',    key: 'block',   disabled: !canBlock, emphasized: emphasizedActions?.includes('block') },
          { label: 'Blitz',    key: 'blitz',   disabled: !canBlitz, emphasized: emphasizedActions?.includes('blitz') },
        ];
        return (
          <PieceMenu
            piece={menuPiece}
            anchor={pieceMenu.anchor}
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
            onAccept={() => {
              const shouldIntroduceUniverses = guidanceEnabled
                && conceptIsAvailable('parallel-universes')
                && (replayLearnedConcepts || !tutorialConceptProgress?.['parallel-universes'])
                && !dismissedTutorialConcepts.has('parallel-universes');
              updateTutorialConcepts(
                shouldIntroduceUniverses ? ['blocks-blitzes'] : ['blocks-blitzes', 'parallel-universes'],
                'used',
              );
              if (shouldIntroduceUniverses) setParallelUniversesIntroOpen(true);
              branchedBoards.handleResolveBlock();
            }}
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
      {(effectiveAppMode === 'series-puzzle' || effectiveAppMode === 'puzzle') && objectiveVisible && tutorialLesson && (
        <TutorialObjectiveCard
          lesson={tutorialLesson.lesson}
          objective={activeScenario?.description ?? 'Complete the stated objective with the strongest probability you can find.'}
          onDismiss={dismissTutorialLesson}
        />
      )}
      {activeTutorialCaption && !confirmLeaveSeries && !reportOpen && !aboutOpen && !contactOpen && !releaseNotesOpen
        && !parallelUniversesIntroOpen && !tutorialConceptGuideOpen && (
        <TutorialContextCaption
          concept={activeTutorialCaption}
          menuAnchor={pieceMenu?.anchor}
          onDismiss={() => {
            setDismissedTutorialConcepts(current => new Set(current).add(activeTutorialCaption.id));
            updateTutorialConcepts([activeTutorialCaption.id], 'introduced');
            trackAnalytics('interaction', { name: 'tutorial-guide', outcome: 'concept-dismissed', stageId: activeTutorialCaption.id });
          }}
        />
      )}
      {tutorialConceptGuideOpen && activeScenario && (
        <TutorialConceptGuideDialog
          drillTitle={tutorialLessonFor(activeScenario.id)?.title ?? activeScenario.name}
          concepts={activeTutorialConcepts}
          progress={tutorialConceptProgress ?? {}}
          state={state}
          onIntroduce={conceptId => {
            updateTutorialConcepts([conceptId], 'introduced');
            trackAnalytics('interaction', { name: 'tutorial-guide', outcome: 'concept-opened', scenarioId: activeScenario.id, stageId: conceptId });
          }}
          onClose={() => setTutorialConceptGuideOpen(false)}
        />
      )}
      {parallelUniversesIntroOpen && activeScenario && !confirmLeaveSeries && !reportOpen && !aboutOpen && !contactOpen && !releaseNotesOpen && (
        <ParallelUniversesIntroDialog
          concept={tutorialConceptFor('parallel-universes')}
          state={state}
          onContinue={() => {
            updateTutorialConcepts(['parallel-universes'], 'used');
            setDismissedTutorialConcepts(current => new Set(current).add('parallel-universes'));
            setParallelUniversesIntroOpen(false);
            setParallelUniversesSpotlight(true);
            trackAnalytics('interaction', { name: 'tutorial-guide', outcome: 'concept-used', scenarioId: activeScenario.id, stageId: 'parallel-universes' });
          }}
        />
      )}
      {notice}
      {reportModal}
      {aboutModal}
      {releaseNotesModal}
      {contactModal}
    </div>
  );
}
