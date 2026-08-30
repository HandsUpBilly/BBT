import { useState } from 'react';
import { submitContact, CONTACT_LIMITS } from './api';
import { useModalFocus } from './useModalFocus';
import './SubmitModal.css';
import './ReportProblem.css';

interface Props {
  defaultName: string;
  onClose: () => void;
  onResult?: (outcome: 'succeeded' | 'failed') => void;
}

// Limits come from the same module the server validates against, so the
// client can never disagree with it about what fits.
const MAX_NAME = CONTACT_LIMITS.name;
const MAX_EMAIL = CONTACT_LIMITS.email;
const MAX_MESSAGE = CONTACT_LIMITS.message;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactModal({ defaultName, onClose, onResult }: Props) {
  const dialogRef = useModalFocus<HTMLElement>(onClose);
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState('');
  const [noReply, setNoReply] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const input = {
    name: name.trim(),
    email: noReply ? '' : email.trim(),
    message: message.trim(),
  };

  function validate(): string | undefined {
    if (!input.name) return 'Enter your name.';
    if (input.name.length > MAX_NAME) return `Name must be ${MAX_NAME} characters or fewer.`;
    if (!noReply && !input.email) return 'Enter your email address or choose that you don\'t need a reply.';
    if (!noReply && input.email.length > MAX_EMAIL) return `Email must be ${MAX_EMAIL} characters or fewer.`;
    if (!noReply && !EMAIL_PATTERN.test(input.email)) return 'Enter a valid email address.';
    if (!input.message) return 'Enter a message.';
    if (input.message.length > MAX_MESSAGE) return `Message must be ${MAX_MESSAGE} characters or fewer.`;
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
    setSubmitting(true);
    try {
      await submitContact(input);
      setSent(true);
      onResult?.('succeeded');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not send the message');
      onResult?.('failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="modal-backdrop report-problem-backdrop">
        <section ref={dialogRef} className="modal report-problem-modal" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title" tabIndex={-1}>
          <span className="report-problem-modal__eyebrow">Message sent</span>
          <h2 id="contact-modal-title" className="modal__title">Thanks for reaching out</h2>
          <p className="report-problem-modal__copy">
            {input.email ? <>We&rsquo;ll get back to you at {input.email}.</> : 'Your message has been sent.'}
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
      <section ref={dialogRef} className="modal report-problem-modal" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title" tabIndex={-1}>
        <div className="report-problem-modal__header">
          <span className="report-problem-modal__eyebrow">Get in touch</span>
          <h2 id="contact-modal-title" className="modal__title">Contact us</h2>
          <p className="report-problem-modal__copy">Questions, feedback, or anything else — send a message to the Turn 16 team.</p>
        </div>

        <form className="report-problem-form" onSubmit={handleSubmit} noValidate>
          <label className="report-problem-form__field" htmlFor="contact-name">
            Your name
            <input id="contact-name" maxLength={MAX_NAME} value={name} onChange={event => setName(event.target.value)} />
          </label>

          <label className="report-problem-form__field" htmlFor="contact-email">
            Your email <span className="contact-form__optional">(optional)</span>
            <input
              id="contact-email"
              type="email"
              maxLength={MAX_EMAIL}
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="So we can reply"
              disabled={noReply}
            />
          </label>

          <label className="contact-form__reply-option">
            <input
              type="checkbox"
              checked={noReply}
              onChange={event => {
                setNoReply(event.target.checked);
                setError(undefined);
              }}
            />
            I don&rsquo;t need a reply
          </label>

          <label className="report-problem-form__field" htmlFor="contact-message">
            Message
            <textarea
              id="contact-message"
              maxLength={MAX_MESSAGE}
              value={message}
              onChange={event => setMessage(event.target.value)}
              placeholder="What's on your mind?"
              rows={6}
            />
            <span className="report-problem-form__count">{message.length} / {MAX_MESSAGE}</span>
          </label>

          {error && <p className="report-problem-form__error" role="alert">{error}</p>}

          <div className="report-problem-modal__actions">
            <button className="report-problem-modal__secondary" type="button" onClick={onClose} disabled={submitting}>Cancel</button>
            <button className="report-problem-modal__submit" type="submit" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send message'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
