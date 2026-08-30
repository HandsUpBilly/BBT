import { OBJECTIVE_GUIDANCE } from './objectiveCopy';

/**
 * Player-facing brand and landing-screen copy.
 *
 * Keep scenario names and descriptions in their scenario JSON files: those
 * are also consumed by the editor and leaderboards. This resource owns the
 * surrounding interface language so it has one translation/editing seam.
 */
export const UI_COPY = {
  brand: {
    name: 'Turn 16',
    tagline: 'Just the final turn',
    landingSubtitle: 'Playbook simulator',
  },
  landing: {
    objectiveGuidance: OBJECTIVE_GUIDANCE,
    playModeLabel: 'Play mode',
    utilityNavLabel: 'Site controls',
    seriesTab: 'Series',
    singlePlaysTab: 'Free Play',
    puzzleCreatorTab: 'Admin',
    help: 'Help',
    settings: 'Settings',
    about: 'About',
    heroTitle: 'The Last Drive',
    heroPrompt: OBJECTIVE_GUIDANCE,
    seriesEyebrow: '01 Tutorial',
    startSeries: 'Tutorial',
    rankings: 'Rankings',
    singlePlaysHeading: 'Free Play',
    singlePlaysPrompt: 'These matches can be played individually.',
    freePlayFilterLabel: 'Filter free play matches',
    allMatchesFilter: 'All matches',
    seriesFilter: 'Series',
    specialsFilter: 'Specials',
    tutorialOrigin: 'From the tutorial',
    tutorialFinalPuzzle: 'The final puzzle from the tutorial, with every action available.',
    noSpecials: 'No special matches are available yet.',
    playPrefix: 'Play',
    play: 'Play',
    checkingHistory: 'Checking history...',
    notPlayed: 'Not played',
    notPlayedRanked: (entries: number) => `Not played, ${entries} ranked`,
    best: (percent: string) => `Best ${percent}`,
    bestRank: (percent: string, rank: number) => `Best ${percent}, Rank #${rank}`,
  },
} as const;
