import { useId } from 'react';
import { blockStateProbabilities, type BlockResolution } from './blockBranching';
import { BOARD_STATE_LABELS } from './branchRun';
import { useModalFocus } from './useModalFocus';
import { BlockDiceGraphic } from './BlockDiceGraphic';
import './SubmitModal.css'; // shared modal-backdrop/modal styles
import './BlockSplitPanel.css';

interface Props {
  attackerName: string;
  defenderName: string;
  diceCount: 1 | 2 | 3;
  picker: 'attacker' | 'defender';
  resolution: BlockResolution;
  onAccept: () => void;
  onReject: () => void;
}

function pct(p: number): string {
  if (p > 0 && p < 0.005) return '<1%';
  return `${Math.round(p * 100)}%`;
}

/**
 * Declare-time preview for a branching block: no more checklist, but the
 * player still sees the dice before rolling them — same as a dodge target
 * shows before you click into it.
 *
 * The split below isn't a promise. It's computed by treating every live board
 * state as equally worth having (nothing has been authored below any of them
 * yet, so nothing else is knowable) — which is exactly the split the branch
 * strip itself will show the instant you accept. Once you start playing out
 * the branches, better continuations pull weight toward themselves and this
 * exact number moves; the caption says so rather than letting the split look
 * like a fixed quote.
 */
export function BlockSplitPanel({
  attackerName, defenderName, diceCount, picker, resolution, onAccept, onReject,
}: Props) {
  const titleId = useId();
  const ref = useModalFocus<HTMLDivElement>(onReject);

  const { states, deadFaceCount } = resolution;
  const { probabilities, deadProbability } = blockStateProbabilities(
    resolution, states.map(() => 1), diceCount, picker,
  );

  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        className="modal block-outcome block-split"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="modal__title">{attackerName} blocks {defenderName}</h2>
        <BlockDiceGraphic
          count={diceCount} favor={picker}
          className="block-split__dice-graphic" size={40}
        />
        <p className="modal__desc">
          {diceCount} {diceCount === 1 ? 'die' : 'dice'} ·{' '}
          {picker === 'attacker' ? 'you pick which one counts' : 'the defender picks which one counts'}
        </p>

        <div className="block-split__rows">
          {states.map((state, i) => (
            <div key={state.kind} className="block-split__row">
              <span className="block-split__row-label">{BOARD_STATE_LABELS[state.kind]}</span>
              <span className="block-split__row-prob">{pct(probabilities[i])}</span>
            </div>
          ))}
          {deadFaceCount > 0 && (
            <div className="block-split__row block-split__row--dead">
              <span className="block-split__row-label">Turnover — drive ends here</span>
              <span className="block-split__row-prob">{pct(deadProbability)}</span>
            </div>
          )}
        </div>

        <p className="block-split__note">
          This split assumes every result is equally useful to you. Once you play a
          result out, the weights shift toward whichever one you can actually use.
        </p>

        <div className="submit-modal__actions">
          <button className="modal__roll-btn" onClick={onAccept}>Roll the Dice</button>
          <button className="modal__continue-btn" onClick={onReject}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
