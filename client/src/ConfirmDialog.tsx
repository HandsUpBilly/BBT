import './SubmitModal.css'; // shared modal styles

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2 className="modal__title">{title}</h2>
        <p className="modal__desc">{message}</p>
        <div className="submit-modal__actions">
          <button className="modal__roll-btn" onClick={onConfirm}>
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
