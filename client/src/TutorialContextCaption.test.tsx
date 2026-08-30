import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tutorialConceptFor } from './tutorialConcepts';
import { TutorialContextCaption } from './TutorialContextCaption';

afterEach(cleanup);

describe('TutorialContextCaption', () => {
  it('explains a concept, suggests a broad objective, and only offers dismissal', () => {
    const onDismiss = vi.fn();
    render(<TutorialContextCaption concept={tutorialConceptFor('passing')} onDismiss={onDismiss} />);
    expect(screen.getByText('Passing')).toBeTruthy();
    expect(screen.getByText(/^Next:/)).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
