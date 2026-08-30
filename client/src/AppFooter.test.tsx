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
});
