import type { Scenario } from './types';
import { useModalFocus } from './useModalFocus';
import './SubmitModal.css';

interface Props {
  scenario: Scenario;
  onChoose: (showGuidance: boolean) => void;
  onCancel: () => void;
}

export function ReplayGuidanceDialog({ scenario, onChoose, onCancel }: Props) {
  const ref = useModalFocus<HTMLDivElement>(onCancel);
  return (
    <div className="modal-backdrop">
      <section ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="replay-guidance-title" tabIndex={-1}>
        <h2 id="replay-guidance-title" className="modal__title">Replay Tutorial guidance?</h2>
        <p>You have already completed {scenario.name}. Choose whether its contextual teaching should appear again during this replay.</p>
        <div className="submit-modal__actions">
          <button type="button" className="modal__continue-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="modal__continue-btn" onClick={() => onChoose(false)}>Play without guidance</button>
          <button type="button" className="modal__roll-btn" onClick={() => onChoose(true)}>Replay guidance</button>
        </div>
      </section>
    </div>
  );
}
