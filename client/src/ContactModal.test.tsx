import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContactModal } from './ContactModal';
import * as api from './api';

afterEach(cleanup);

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Your email', { exact: false }), { target: { value: 'coach@example.com' } });
  fireEvent.change(screen.getByLabelText('Message', { exact: false }), { target: { value: 'Any plans for a Nurgle team?' } });
}

describe('ContactModal', () => {
  it('prefills the name from the identity and requires an email and message', () => {
    render(<ContactModal defaultName="Endzone Expert" onClose={vi.fn()} />);
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Endzone Expert');

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByRole('alert').textContent).toMatch(/email address/);
  });

  it('rejects a malformed email address', () => {
    render(<ContactModal defaultName="Endzone Expert" onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Your email', { exact: false }), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText('Message', { exact: false }), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByRole('alert').textContent).toMatch(/valid email/);
  });

  it('allows the player to send without a reply address', async () => {
    const submitContact = vi.spyOn(api, 'submitContact').mockResolvedValue({ id: 'no-reply-123' });
    render(<ContactModal defaultName="Endzone Expert" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /I don.t need a reply/ }));
    expect((screen.getByLabelText('Your email', { exact: false }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Message', { exact: false }), { target: { value: 'Just saying thanks.' } });

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(screen.getByText('Your message has been sent.')).toBeTruthy());
    expect(submitContact).toHaveBeenCalledWith({
      name: 'Endzone Expert',
      email: '',
      message: 'Just saying thanks.',
    });
  });

  it('submits the message and shows a confirmation on success', async () => {
    const submitContact = vi.spyOn(api, 'submitContact').mockResolvedValue({ id: 'abc123' });
    const onResult = vi.fn();
    render(<ContactModal defaultName="Endzone Expert" onClose={vi.fn()} onResult={onResult} />);
    fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(screen.getByText('Thanks for reaching out')).toBeTruthy());
    expect(submitContact).toHaveBeenCalledWith({
      name: 'Endzone Expert',
      email: 'coach@example.com',
      message: 'Any plans for a Nurgle team?',
    });
    expect(onResult).toHaveBeenCalledWith('succeeded');
    expect(screen.getByText(/coach@example\.com/)).toBeTruthy();
  });

  it('shows the server error and lets the player retry on failure', async () => {
    vi.spyOn(api, 'submitContact').mockRejectedValue(new api.ContactSubmissionError('Too many messages from this session. Try again later.'));
    const onResult = vi.fn();
    render(<ContactModal defaultName="Endzone Expert" onClose={vi.fn()} onResult={onResult} />);
    fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Too many messages/));
    expect(onResult).toHaveBeenCalledWith('failed');
    expect(screen.queryByText('Thanks for reaching out')).toBeNull();
  });

  it('calls onClose from Cancel', () => {
    const onClose = vi.fn();
    render(<ContactModal defaultName="Endzone Expert" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
