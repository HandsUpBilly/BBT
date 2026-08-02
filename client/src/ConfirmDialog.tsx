import { useId } from 'react';
import { useModalFocus } from './useModalFocus';
import './SubmitModal.css'; // shared modal styles

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * Marks the confirm action as destructive (delete, discard) so it reads as a
   * warning rather than the default primary action.
   */
  destructive?: boolean;
}

export function ConfirmDialog({
  title, message, confirmLabel, cancelLabel, onConfirm, onCancel, destructive,
}: Props) {
  const titleId = useId();
  const messageId = useId();
  // Escape cancels — the same as the explicit Cancel button.
  const ref = useModalFocus<HTMLDivElement>(onCancel);

  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="modal__title">{title}</h2>
        <p id={messageId} className="modal__desc">{message}</p>
        <div className="submit-modal__actions">
          <button
            className={`modal__roll-btn${destructive ? ' modal__roll-btn--danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel ?? 'Leave'}
          </button>
          <button className="modal__continue-btn" onClick={onCancel}>
            {cancelLabel ?? 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
