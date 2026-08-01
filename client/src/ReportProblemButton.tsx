import './ReportProblem.css';

interface Props {
  onClick: () => void;
  variant?: 'floating' | 'hud';
}

export function ReportProblemButton({ onClick, variant = 'floating' }: Props) {
  return (
    <button
      className={`report-problem-button report-problem-button--${variant}`}
      type="button"
      onClick={onClick}
    >
      <span aria-hidden="true">⚑</span>
      Report a problem
    </button>
  );
}
