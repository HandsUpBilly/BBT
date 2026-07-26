import { useState } from 'react';
import './SubmitModal.css'; // shared modal styles

interface Props {
  puzzleCount: number;
  onStart: (name: string) => void;
  onCancel: () => void;
}

export function SeriesNameEntry({ puzzleCount, onStart, onCancel }: Props) {
  const [name, setName] = useState('');

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2 className="modal__title">Start Series</h2>
        <p className="modal__desc">
          Play {puzzleCount} puzzles back-to-back. Your average success chance across
          all {puzzleCount} will be posted to the Series Leaderboard.
        </p>
        <p className="submit-modal__prompt">Enter your name:</p>
        <input
          className="submit-modal__input"
          type="text"
          maxLength={32}
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onStart(name.trim())}
          autoFocus
        />
        <div className="submit-modal__actions">
          <button
            className="modal__roll-btn"
            disabled={!name.trim()}
            onClick={() => onStart(name.trim())}
          >
            Start Series
          </button>
          <button className="modal__continue-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
