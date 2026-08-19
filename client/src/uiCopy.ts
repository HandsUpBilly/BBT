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
    tagline: 'The final turn',
    landingSubtitle: 'Playbook simulator',
  },
  landing: {
    playModeLabel: 'Play mode',
    seriesTab: 'Series',
    singlePlaysTab: 'Single Plays',
    puzzleCreatorTab: 'Admin',
    seriesEyebrow: '01 Tutorial',
    startSeries: 'Start Series',
    rankings: 'Rankings',
    singlePlaysHeading: 'Free Play',
    singlePlaysPrompt: 'Choose a ranked board.',
    playPrefix: 'Play',
    play: 'Play',
    checkingHistory: 'Checking history...',
    notPlayed: 'Not played',
    notPlayedRanked: (entries: number) => `Not played, ${entries} ranked`,
    best: (percent: string) => `Best ${percent}`,
    bestRank: (percent: string, rank: number) => `Best ${percent}, Rank #${rank}`,
  },
} as const;
