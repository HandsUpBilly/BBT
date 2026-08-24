import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTutorialGuide } from './useTutorialGuide';

describe('useTutorialGuide attempts', () => {
  it('starts the same scenario from Step 1 on every new attempt', () => {
    const { result } = renderHook(() => useTutorialGuide());

    act(() => result.current.beginAttempt('scenario-001'));
    act(() => result.current.start());
    act(() => result.current.moreHelp());
    act(() => result.current.skip());

    expect(result.current.progress).toMatchObject({
      scenarioId: 'scenario-001',
      stageIndex: 0,
      tier: 1,
      skipped: true,
    });

    act(() => result.current.beginAttempt('scenario-001'));

    expect(result.current.progress).toMatchObject({
      scenarioId: 'scenario-001',
      stageIndex: 0,
      tier: 0,
      visible: false,
      skipped: false,
      complete: false,
    });
  });
});
