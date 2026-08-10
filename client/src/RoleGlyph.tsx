import { roleGlyphFor } from './rolePresentation';

export function RoleGlyph({ role, fallback }: { role?: string; fallback: string }) {
  const kind = roleGlyphFor(role, fallback);

  return (
    <svg
      className={`piece__role-glyph piece__role-glyph--${kind}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'shield' && (
        <>
          <path d="M12 2.2 20 5v5.8c0 5.2-3.1 8.9-8 11-4.9-2.1-8-5.8-8-11V5l8-2.8Z" />
          <path d="M12 5.2v13.1M6.8 8.2H12" className="piece__role-glyph-detail" />
        </>
      )}
      {kind === 'bolt' && <path d="M14.2 1.8 5.7 13h5.2l-1.3 9.2L18.7 10h-5.3l.8-8.2Z" />}
      {kind === 'ball' && (
        <>
          <ellipse cx="12" cy="12" rx="9" ry="5.6" transform="rotate(-32 12 12)" />
          <path d="m9 7.8 6 8.4M9.8 10.2l4.2-3M11.2 12.2l4.1-3M12.6 14.2l4.1-3" className="piece__role-glyph-detail" />
        </>
      )}
      {kind === 'wing' && (
        <>
          <path d="M21.7 3.2C16.4 4 10.3 6.3 7.6 11.8c-1.2 2.4-2.5 4-5.3 5.8 3.7.2 6.4-.5 8.4-2.2-.8 1.9-2 3.4-3.7 4.8 5.9-1.1 9.2-5.1 10.2-9.1 1.7-2 3.1-4.5 4.5-7.9Z" />
          <path d="M8.1 15.3c3.3-1.5 6.1-3.7 8.5-6.8" className="piece__role-glyph-detail" />
        </>
      )}
      {kind === 'fist' && (
        <path d="M5.1 11.3V7.5c0-1.4 2.1-1.4 2.1 0v2.1-4c0-1.5 2.2-1.5 2.2 0v3.7-4.8c0-1.5 2.3-1.5 2.3 0v4.8-4c0-1.5 2.2-1.5 2.2 0v4.3-2.4c0-1.4 2.1-1.4 2.1 0v5l2.3-2c1.4-1.2 3.1.6 2 2l-4.7 5.2V22H8.1v-3.1l-3.8-4.3c-1.5-1.7-.1-4.1.8-3.3Z" />
      )}
    </svg>
  );
}
