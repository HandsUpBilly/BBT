import { useState } from 'react';
import {
  ReportSubmissionError,
  createReportDownload,
  submitReport,
  REPORT_LIMITS,
} from './api';
import type { ReportContext, ReportDownload, ReportType } from './api';
import { useModalFocus } from './useModalFocus';
import './ReportProblem.css';

interface Props {
  defaultReporterName: string;
  context: ReportContext;
  idToken?: string | null;
  onClose: () => void;
}

// Limits come from the same module the server validates against, so the
// client can never disagree with it about what fits.
const MAX_REPORTER_NAME = REPORT_LIMITS.reporterName;
const MAX_TITLE = REPORT_LIMITS.title;
const MAX_DESCRIPTION = REPORT_LIMITS.description;

function downloadReport(download: ReportDownload) {
  const blob = new Blob([download.content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = download.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking synchronously can race the download in some browsers; defer to
  // the next task so the fetch of the blob has certainly started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ReportProblemModal({ defaultReporterName, context, idToken, onClose }: Props) {
  const dialogRef = useModalFocus<HTMLElement>(onClose);
  const [type, setType] = useState<ReportType>('issue');
  const [reporterName, setReporterName] = useState(defaultReporterName);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string>();
  const [download, setDownload] = useState<ReportDownload>();
  const [submitting, setSubmitting] = useState(false);
  const [submittedIssue, setSubmittedIssue] = useState<{ number: number; url: string }>();

  const input = {
    type,
    reporterName: reporterName.trim(),
    title: title.trim(),
    description: description.trim(),
    context,
  };

  function validate(): string | undefined {
    if (!input.reporterName) return 'Enter your name.';
    if (input.reporterName.length > MAX_REPORTER_NAME) return `Name must be ${MAX_REPORTER_NAME} characters or fewer.`;
    if (!input.title) return 'Enter a short title.';
    if (input.title.length > MAX_TITLE) return `Title must be ${MAX_TITLE} characters or fewer.`;
    if (!input.description) return 'Describe the issue or feature request.';
    if (input.description.length > MAX_DESCRIPTION) return `Description must be ${MAX_DESCRIPTION} characters or fewer.`;
    return undefined;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(undefined);
    setDownload(undefined);
    setSubmitting(true);
    try {
      const issue = await submitReport(input, idToken);
      setSubmittedIssue(issue);
    } catch (submitError) {
      const fallback = submitError instanceof ReportSubmissionError
        ? submitError.download ?? createReportDownload(input)
        : createReportDownload(input);
      setDownload(fallback);
      setError(submitError instanceof Error ? submitError.message : 'Could not submit the report');
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedIssue) {
    return (
      <div className="modal-backdrop report-problem-backdrop">
        <section ref={dialogRef} className="modal report-problem-modal" role="dialog" aria-modal="true" aria-labelledby="report-problem-title" tabIndex={-1}>
          <span className="report-problem-modal__eyebrow">Report filed</span>
          <h2 id="report-problem-title" className="modal__title">Thanks for the report</h2>
          <p className="report-problem-modal__copy">
            <a href={submittedIssue.url} target="_blank" rel="noreferrer">Issue #{submittedIssue.number}</a> was created on GitHub.
          </p>
          <div className="report-problem-modal__actions">
            <button className="report-problem-modal__secondary" type="button" onClick={onClose}>Close</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="modal-backdrop report-problem-backdrop">
      <section className="modal report-problem-modal" role="dialog" aria-modal="true" aria-labelledby="report-problem-title">
        <div className="report-problem-modal__header">
          <span className="report-problem-modal__eyebrow">Coach's note</span>
          <h2 id="report-problem-title" className="modal__title">Report a problem</h2>
          <p className="report-problem-modal__copy">Send an issue or feature request to the BB Tactics team.</p>
        </div>

        <form className="report-problem-form" onSubmit={handleSubmit}>
          <fieldset className="report-problem-form__types">
            <legend>What are you reporting?</legend>
            <label className={`report-problem-form__type${type === 'issue' ? ' report-problem-form__type--selected' : ''}`}>
              <input type="radio" name="report-type" value="issue" checked={type === 'issue'} onChange={() => setType('issue')} />
              Issue
            </label>
            <label className={`report-problem-form__type${type === 'feature' ? ' report-problem-form__type--selected' : ''}`}>
              <input type="radio" name="report-type" value="feature" checked={type === 'feature'} onChange={() => setType('feature')} />
              Feature request
            </label>
          </fieldset>

          <label className="report-problem-form__field" htmlFor="reporter-name">
            Your name
            <input id="reporter-name" maxLength={MAX_REPORTER_NAME} value={reporterName} onChange={event => setReporterName(event.target.value)} />
          </label>

          <label className="report-problem-form__field" htmlFor="report-title">
            Title
            <input id="report-title" maxLength={MAX_TITLE} value={title} onChange={event => setTitle(event.target.value)} placeholder="A short summary" />
          </label>

          <label className="report-problem-form__field" htmlFor="report-description">
            Description
            <textarea id="report-description" maxLength={MAX_DESCRIPTION} value={description} onChange={event => setDescription(event.target.value)} placeholder="What happened, or what would make the game better?" rows={6} />
            <span className="report-problem-form__count">{description.length} / {MAX_DESCRIPTION}</span>
          </label>

          {error && <p className="report-problem-form__error" role="alert">{error}</p>}
          {download && (
            <button className="report-problem-modal__download" type="button" onClick={() => downloadReport(download)}>
              Download report for Ona or GitHub
            </button>
          )}

          <div className="report-problem-modal__actions">
            <button className="report-problem-modal__secondary" type="button" onClick={onClose} disabled={submitting}>Cancel</button>
            <button className="report-problem-modal__submit" type="submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
