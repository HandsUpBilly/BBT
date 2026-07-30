import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlockOutcomePanel } from './BlockOutcomePanel';
import { clampMenuPosition, isBlockOutcomeSelectable } from './blockControls';
import { blockOutcomeProbabilities } from './bfs';

const baseProps = {
  attackerName: 'Aldric',
  defenderName: 'Grukk',
  diceCount: 1 as const,
  picker: 'attacker' as const,
  outcomeProbs: blockOutcomeProbabilities(1, 'attacker'),
  onConfirm: () => undefined,
  onCancel: () => undefined,
};

describe('PieceMenu viewport placement', () => {
  it('moves a menu opened near the bottom-right fully inside the viewport', () => {
    expect(clampMenuPosition(790, 590, 260, 220, 800, 600)).toEqual({
      left: 532,
      top: 372,
    });
  });

  it('preserves a viewport gap at the top-left', () => {
    expect(clampMenuPosition(-20, -10, 260, 220, 800, 600)).toEqual({
      left: 8,
      top: 8,
    });
  });
});

describe('BlockOutcomePanel', () => {
  it('shows all dice faces but disables unsafe outcomes without Block or Wrestle', () => {
    const { container } = render(<BlockOutcomePanel {...baseProps} attackerSkills={[]} />);

    expect((screen.getByRole('checkbox', { name: /Attacker Down/ }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('checkbox', { name: /Both Down/ }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('checkbox', { name: /Push Back/ }) as HTMLInputElement).disabled).toBe(false);
    expect(container.querySelectorAll('.block-die')).toHaveLength(5);
  });

  it('allows Both Down with either Block or Wrestle', () => {
    expect(isBlockOutcomeSelectable('both-down', ['Block'])).toBe(true);
    expect(isBlockOutcomeSelectable('both-down', ['Wrestle'])).toBe(true);
    expect(isBlockOutcomeSelectable('both-down', [])).toBe(false);
  });
});
