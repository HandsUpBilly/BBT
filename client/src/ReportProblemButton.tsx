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
      <span className="report-problem-button__icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" focusable="false">
          <path d="M5 17V3m0 1h9l-1.7 3L14 10H5" />
        </svg>
      </span>
      {variant === 'hud' && (
        <span className="report-problem-button__label">Report a problem</span>
      )}
    </button>
  );
}
