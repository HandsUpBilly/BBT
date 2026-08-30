import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BrandLogo } from './BrandLogo';

afterEach(cleanup);

describe('BrandLogo', () => {
  it('names a meaningful wordmark for assistive technology', () => {
    render(<BrandLogo variant="wordmark" />);
    expect(screen.getByRole('img', { name: 'Turn 16' })).toBeTruthy();
  });

  it('keeps repeated decorative marks out of the accessibility tree', () => {
    render(<BrandLogo variant="badge" decorative />);
    expect(screen.queryByRole('img')).toBeNull();
  });
});
