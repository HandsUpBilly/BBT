import { useId } from 'react';
import { useModalFocus } from './useModalFocus';
import './SubmitModal.css';
import './AboutDialog.css';

interface Props {
  version: string;
  onClose: () => void;
}

export function AboutDialog({ version, onClose }: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useModalFocus<HTMLDivElement>(onClose);

  return (
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        className="modal about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <span className="about-dialog__eyebrow">The final turn · Do or die</span>
        <h2 id={titleId} className="modal__title">About Turn 16</h2>
        <p id={descriptionId} className="modal__desc">
          An unofficial, independent Blood Bowl puzzle and risk-training tool.
        </p>
        <p className="about-dialog__version">Version {version}</p>
        <button className="modal__continue-btn" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
