import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RoleGlyph } from './RoleGlyph';
import { roleCodeFor, roleGlyphFor } from './rolePresentation';

afterEach(cleanup);

describe('tactical role presentation', () => {
  it('maps the core positions to distinct, stable symbols', () => {
    expect(roleGlyphFor('lineman', 'lineman')).toBe('shield');
    expect(roleGlyphFor('blitzer', 'lineman')).toBe('bolt');
    expect(roleGlyphFor('thrower', 'lineman')).toBe('ball');
    expect(roleGlyphFor('catcher', 'lineman')).toBe('wing');
    expect(roleGlyphFor('big-un', 'blocker')).toBe('fist');
  });

  it('uses readable codes for compound and big-guy roles', () => {
    expect(roleCodeFor('black-orc', 'blocker')).toBe('BO');
    expect(roleCodeFor('big-un', 'blocker')).toBe('BG');
    expect(roleCodeFor('ogre', 'lineman')).toBe('BG');
  });

  it('renders the mapped SVG class', () => {
    const { container } = render(<RoleGlyph role="thrower" fallback="lineman" />);
    expect(container.querySelector('.piece__role-glyph--ball')).toBeTruthy();
  });

  it('falls back safely for an unknown role', () => {
    expect(roleGlyphFor('future-position', 'lineman')).toBe('shield');
    expect(roleCodeFor('future-position', 'lineman')).toBe('FU');
  });
});
