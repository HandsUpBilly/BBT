import type { Position } from './types';

interface Props {
  destination: Position | null;
  probability: number;
  showProbability: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CommitBar({
  destination, probability, showProbability, onCancel, onConfirm,
}: Props) {
  const isPlaceholder = destination === null;
  const displayDestination = destination ?? { col: 14, row: 25 };

  return (
    <div
      className={`commit-bar${isPlaceholder ? ' commit-bar--placeholder' : ''}`}
      role={isPlaceholder ? undefined : 'group'}
      aria-label={isPlaceholder ? undefined : 'Confirm move'}
      aria-hidden={isPlaceholder}
    >
      <div className="commit-bar__detail">
        <span className="commit-bar__square">
          Move to {String(displayDestination.row)}{String.fromCharCode(65 + displayDestination.col)}
        </span>
        <span className={[
          'commit-bar__prob',
          showProbability ? '' : 'commit-bar__prob--placeholder',
          probability < 50 ? 'commit-bar__prob--risky' : '',
        ].filter(Boolean).join(' ')}>
          {probability}% success
        </span>
      </div>
      <div className="commit-bar__actions">
        <button
          type="button"
          className="btn btn--secondary commit-bar__cancel"
          disabled={isPlaceholder}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary commit-bar__confirm"
          disabled={isPlaceholder}
          onClick={onConfirm}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
