import { useId } from 'react';
import { useModalFocus } from './useModalFocus';
import './SubmitModal.css';
import './AboutDialog.css';

interface Props {
  version: string;
  deployedAt: string;
  onClose: () => void;
}

function formatDeploymentTime(deployedAt: string): string {
  const date = new Date(deployedAt);
  if (Number.isNaN(date.getTime())) return deployedAt;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

export function AboutDialog({ version, deployedAt, onClose }: Props) {
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
        <div className="about-dialog__build">
          <p className="about-dialog__version">Version {version}</p>
          <p className="about-dialog__deployment">
            <span>Last deployed</span>
            <time dateTime={deployedAt} title={deployedAt}>
              {formatDeploymentTime(deployedAt)}
            </time>
          </p>
        </div>
        <button className="modal__continue-btn" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
