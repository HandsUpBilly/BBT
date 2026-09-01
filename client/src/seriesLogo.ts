import nuffleShuffleLogo from './assets/series/nuffle-shuffle-transparent.webp';

const BUILT_IN_SERIES_LOGOS: Record<string, string> = {
  'nuffle-shuffle': nuffleShuffleLogo,
};

/** Resolves both newly uploaded artwork and legacy built-in logo keys. */
export function seriesLogoSource(logo: string | undefined): string | undefined {
  if (logo?.startsWith('data:image/webp;base64,')) return logo;
  return logo ? BUILT_IN_SERIES_LOGOS[logo] : undefined;
}
