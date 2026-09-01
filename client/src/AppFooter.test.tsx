import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppFooter } from './AppFooter';

afterEach(cleanup);

describe('AppFooter', () => {
  it('uses the horizontal Turn 16 wordmark', () => {
    const { container } = render(<AppFooter />);

    expect(screen.getByRole('contentinfo')).toBeTruthy();
    expect(container.querySelector('.brand-logo--wordmark')).toBeTruthy();
    expect(container.querySelector('.brand-logo--badge')).toBeNull();
  });

  it('separates the brand lockup from the legal notices', () => {
    const { container } = render(<AppFooter />);

    expect(container.querySelector('.app-footer__brand .app-footer__copyright')?.textContent)
      .toBe('© 2026 @HandsUpBilly');
    expect(container.querySelectorAll('.app-footer__legal p')).toHaveLength(2);
    expect(screen.getByText('Turn 16 is an unofficial independent training tool.')).toBeTruthy();
    expect(screen.getByText('Blood Bowl and related intellectual property belong to their respective owners.')).toBeTruthy();
  });
});
