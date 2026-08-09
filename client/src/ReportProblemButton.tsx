import './ReportProblem.css';

interface Props {
  onClick: () => void;
  variant?: 'floating' | 'header' | 'hud';
}

export function ReportProblemButton({ onClick, variant = 'header' }: Props) {
  return (
    <button
      className={`report-problem-button report-problem-button--${variant}`}
      type="button"
      aria-label="Report a problem"
      title="Report a problem"
      onClick={onClick}
    >
      <span aria-hidden="true">⚑</span>
    </button>
  );
}
