export type RoleGlyphKind = 'shield' | 'bolt' | 'ball' | 'wing' | 'fist';

const ROLE_CODES: Record<string, string> = {
  thrower: 'TH', catcher: 'CA', lineman: 'LI', blitzer: 'BL', blocker: 'BL',
  guard: 'GU', tackle: 'TA', 'black-orc': 'BO', 'big-un': 'BG',
  halfling: 'HA', ogre: 'BG', goblin: 'GO', troll: 'BG',
};

const ROLE_GLYPHS: Record<string, RoleGlyphKind> = {
  thrower: 'ball', catcher: 'wing', lineman: 'shield', blitzer: 'bolt',
  blocker: 'fist', guard: 'shield', tackle: 'bolt', 'black-orc': 'fist',
  'big-un': 'fist', halfling: 'shield', ogre: 'fist', goblin: 'wing', troll: 'fist',
};

export function roleCodeFor(role: string | undefined, fallback: string): string {
  if (!role) return ROLE_CODES[fallback] ?? fallback.slice(0, 2).toUpperCase();
  return ROLE_CODES[role] ?? role.slice(0, 2).toUpperCase();
}

export function roleGlyphFor(role: string | undefined, fallback: string): RoleGlyphKind {
  return ROLE_GLYPHS[role ?? fallback] ?? 'shield';
}
