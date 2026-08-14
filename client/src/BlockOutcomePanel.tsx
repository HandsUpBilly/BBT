import { useState, useMemo, useId } from 'react';
import type { BlockOutcomeFace } from './types';
import { BLOCK_OUTCOME_FACES, blockCombinedProbability } from './bfs';
import { isBlockOutcomeSelectable } from './blockControls';
import { useModalFocus } from './useModalFocus';
import { BlockDiceGraphic } from './BlockDiceGraphic';
import { BLOCK_FACE_LABELS as FACE_LABELS, BLOCK_FACE_GLYPHS as FACE_ICONS } from './blockFacePresentation';
import './SubmitModal.css'; // shared modal-backdrop/modal styles
import './BlockOutcomePanel.css';

interface Props {
  attackerName: string;
  attackerSkills: string[];
  defenderName: string;
  diceCount: 1 | 2 | 3;
  picker: 'attacker' | 'defender';
  outcomeProbs: Record<BlockOutcomeFace, number>;
  onConfirm: (acceptedFaces: BlockOutcomeFace[], resolvedFace: BlockOutcomeFace) => void;
  onCancel: () => void;
}

function pct(p: number) {
  return `${Math.round(p * 100)}%`;
}

export function BlockOutcomePanel({
  attackerName, attackerSkills, defenderName, diceCount, picker, outcomeProbs, onConfirm, onCancel,
}: Props) {
  const [accepted, setAccepted] = useState<Set<BlockOutcomeFace>>(new Set());
  const [continueAs, setContinueAs] = useState<BlockOutcomeFace | null>(null);
  const titleId = useId();
  // Escape backs out of the block, matching the Cancel button.
  const ref = useModalFocus<HTMLDivElement>(onCancel);

  const acceptedList = useMemo(() => BLOCK_OUTCOME_FACES.filter(f => accepted.has(f)), [accepted]);
  const combinedProb = useMemo(
    () => acceptedList.length > 0 ? blockCombinedProbability(acceptedList, diceCount, picker) : 0,
    [acceptedList, diceCount, picker]
  );

  const toggle = (face: BlockOutcomeFace) => {
    if (!isBlockOutcomeSelectable(face, attackerSkills)) return;
    setAccepted(prev => {
      const next = new Set(prev);
      if (next.has(face)) {
        next.delete(face);
      } else {
        next.add(face);
      }
      return next;
    });
    setContinueAs(null);
  };

  const resolvedFace = acceptedList.length === 1 ? acceptedList[0] : continueAs;
  const canConfirm = acceptedList.length > 0 && resolvedFace !== null;

  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        className="modal block-outcome"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="modal__title">{attackerName} blocks {defenderName}</h2>
        <BlockDiceGraphic count={diceCount} className="block-outcome__dice-graphic" size={40} />
        <p className="modal__desc">
          {diceCount} {diceCount === 1 ? 'die' : 'dice'} · {picker === 'attacker' ? 'Attacker' : 'Defender'} picks —
          check which outcome(s) you'd accept as this block "succeeding"
        </p>

        <div className="block-outcome__rows">
          {BLOCK_OUTCOME_FACES.map(face => {
            const selectable = isBlockOutcomeSelectable(face, attackerSkills);
            const disabledReason = face === 'attacker-down'
              ? 'Attacker Down always ends the play'
              : 'Both Down requires Block or Wrestle';
            return (
              <label
                key={face}
                className={`block-outcome__row${selectable ? '' : ' block-outcome__row--disabled'}`}
                title={selectable ? undefined : disabledReason}
              >
                <input
                  type="checkbox"
                  checked={accepted.has(face)}
                  disabled={!selectable}
                  onChange={() => toggle(face)}
                />
                <span className={`block-die block-die--${face}`} aria-hidden="true">
                  {FACE_ICONS[face]}
                </span>
                <span className="block-outcome__row-label">{FACE_LABELS[face]}</span>
                <span className="block-outcome__row-prob">{pct(outcomeProbs[face])}</span>
              </label>
            );
          })}
        </div>

        {acceptedList.length > 1 && (
          <div className="block-outcome__continue">
            <div className="block-outcome__continue-label">Continue simulating as:</div>
            <div className="block-outcome__continue-options">
              {acceptedList.map(face => (
                <label key={face} className="block-outcome__continue-option">
                  <input
                    type="radio"
                    name="continue-as"
                    checked={continueAs === face}
                    onChange={() => setContinueAs(face)}
                  />
                  {FACE_LABELS[face]}
                </label>
              ))}
            </div>
          </div>
        )}

        {acceptedList.length > 0 && (
          <div className="block-outcome__combined">
            Combined chance: <strong>{pct(combinedProb)}</strong>
          </div>
        )}

        <div className="submit-modal__actions">
          <button
            className="modal__roll-btn"
            disabled={!canConfirm}
            onClick={() => { if (resolvedFace) onConfirm(acceptedList, resolvedFace); }}
          >
            Confirm
          </button>
          <button className="modal__continue-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
