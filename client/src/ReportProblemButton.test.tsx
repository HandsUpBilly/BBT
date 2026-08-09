import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReportProblemButton } from './ReportProblemButton';

describe('ReportProblemButton', () => {
  it('keeps the compact icon launcher accessible and interactive', () => {
    const onClick = vi.fn();
    render(<ReportProblemButton variant="hud" onClick={onClick} />);

    const button = screen.getByRole('button', { name: 'Report a problem' });
    expect(button.getAttribute('title')).toBe('Report a problem');
    expect(button.textContent).toBe('⚑');
    expect(button.classList.contains('report-problem-button--hud')).toBe(true);

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
