import { useId, useState } from 'react';
import { useModalFocus } from './useModalFocus';
import { formatReleaseNoteDate, type ReleaseNote } from './releaseNotes';
import './SubmitModal.css';
import './ReleaseNotesDialog.css';

interface Props {
  notes: readonly ReleaseNote[];
  onClose: () => void;
}

export function ReleaseNotesDialog({ notes, onClose }: Props) {
  const titleId = useId();
  const dialogRef = useModalFocus<HTMLDivElement>(onClose);
  const [index, setIndex] = useState(0);
  const note = notes[index];
  const hasNewer = index > 0;
  const hasOlder = index < notes.length - 1;

  return (
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        className="modal release-notes-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="modal__title">Release Notes</h2>

        {note ? (
          <>
            <nav className="release-notes-dialog__nav" aria-label="Browse release notes by week">
              <button
                type="button"
                className="release-notes-dialog__nav-btn"
                onClick={() => setIndex(current => current - 1)}
                disabled={!hasNewer}
              >
                ← Newer
              </button>
              <span className="release-notes-dialog__week">
                {formatReleaseNoteDate(note.date)}
                <small>{index + 1} of {notes.length}</small>
              </span>
              <button
                type="button"
                className="release-notes-dialog__nav-btn"
                onClick={() => setIndex(current => current + 1)}
                disabled={!hasOlder}
              >
                Older →
              </button>
            </nav>

            <div className="release-notes-dialog__body">
              <h3 className="release-notes-dialog__note-title">{note.title}</h3>
              {note.summary && <p className="modal__desc">{note.summary}</p>}
              {note.categories.length === 0 ? (
                <p className="modal__desc">No changes were recorded for this week.</p>
              ) : (
                note.categories.map(category => (
                  <section key={category.name} className="release-notes-dialog__category">
                    <h4>{category.name}</h4>
                    <ul>
                      {category.items.map((item, itemIndex) => (
                        <li key={itemIndex}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </>
        ) : (
          <p className="modal__desc">No release notes yet — check back soon.</p>
        )}

        <button className="modal__continue-btn" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
