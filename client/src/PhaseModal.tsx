import type { GameState } from './types';
import './SubmitModal.css'; // modal base styles

interface Props {
  state: GameState;
  onContinue: () => void;
}

export function PhaseModal({ state, onContinue }: Props) {
  if (state.phase === 'playing') return null;

  const isGameOver = state.phase === 'game_over';
  const { human, orc } = state.score;

  const title = isGameOver ? 'Full Time!' : 'Half Time!';
  const body = isGameOver
    ? (
      human > orc
        ? 'Human wins!'
        : orc > human
        ? 'Orc wins!'
        : "It's a draw!"
    )
    : `Score: Human ${human} – ${orc} Orc`;
  const btnLabel = isGameOver ? 'Play Again' : 'Start 2nd Half';

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2 className="modal__title">{title}</h2>
        <p className="modal__desc">{body}</p>
        <p className="modal__desc" style={{ fontSize: '1.4rem' }}>
          {human} – {orc}
        </p>
        <button className="modal__roll-btn" onClick={onContinue}>
          {btnLabel}
        </button>
      </div>
    </div>
  );
}
