import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ContentExportPanel } from './ContentExportPanel';

const SHA = 'a'.repeat(40);
const payload = {
  configured: true,
  baseSha: SHA,
  items: [
    { kind: 'scenarios', id: 'smoke-test', path: 'client/src/scenarios/smoke-test.json',
      revision: 3, action: 'update', conflictPaths: [], selectable: true },
    { kind: 'scenarios', id: 'private-draft', path: 'client/src/scenarios/private-draft.json',
      revision: 8, action: 'update', conflictPaths: [], selectable: true },
    { kind: 'series', id: 'conflicted', path: 'client/src/series/conflicted.json',
      revision: 5, action: 'none', conflictPaths: ['name'], selectable: false },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('never preselects unpublished content and exports only explicitly checked files', async () => {
  const calls: Array<{ url: string; options?: RequestInit }> = [];
  const mock = vi.fn(async (url: string, options?: RequestInit) => {
    calls.push({ url, options });
    return { ok: true, json: async () => options?.method === 'POST'
      ? { changes: 1, pullRequest: 'https://github.com/HandsUpBilly/BBT/pull/9999' }
      : payload };
  });
  vi.stubGlobal('fetch', mock);
  const onClose = vi.fn();
  const opened = vi.fn();
  vi.stubGlobal('open', opened);
  render(<ContentExportPanel idToken="test-token" onClose={onClose} onStatus={vi.fn()} />);
  await screen.findByText(/0 file\(s\) selected for export/);
  expect(screen.getByRole('button', { name: 'Review selected files in GitHub' })).toHaveProperty('disabled', true);
  const choices = within(screen.getByRole('group', { name: 'Files to include in GitHub pull request' }));
  expect(choices.getAllByRole('checkbox')).toHaveLength(3);
  expect(choices.getAllByRole('checkbox')[2]).toHaveProperty('disabled', true);
  fireEvent.click(choices.getAllByRole('checkbox')[0]);
  expect(screen.getByText(/1 file\(s\) selected for export/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Review selected files in GitHub' }));
  const confirm = screen.getByRole('alertdialog');
  expect(within(confirm).getByText(/smoke-test.json/)).toBeTruthy();
  expect(within(confirm).queryByText(/private-draft.json/)).toBeNull();
  fireEvent.click(within(confirm).getByRole('button', { name: 'Create selected PR' }));
  await waitFor(() => expect(calls.some(call => call.options?.method === 'POST')).toBe(true));
  const posted = calls.find(call => call.options?.method === 'POST')!;
  expect(JSON.parse(String(posted.options?.body))).toEqual({
    baseSha: SHA, items: [{ kind: 'scenarios', id: 'smoke-test', revision: 3 }],
  });
  expect(opened).toHaveBeenCalledWith('https://github.com/HandsUpBilly/BBT/pull/9999',
    '_blank', 'noopener,noreferrer');
  expect(onClose).toHaveBeenCalledOnce();
});

it('refresh clears selections when GitHub changes', async () => {
  let n = 0;
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true, json: async () => ({ ...payload, baseSha: ++n === 1 ? SHA : 'b'.repeat(40) }),
  })));
  render(<ContentExportPanel idToken="test-token" onClose={vi.fn()} onStatus={vi.fn()} />);
  await screen.findByText(/0 file\(s\) selected/);
  const checkbox = screen.getAllByRole('checkbox')[0];
  fireEvent.click(checkbox);
  expect(screen.getByText(/1 file\(s\) selected/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh preview' }));
  await waitFor(() => expect(screen.getByText(/0 file\(s\) selected/)).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Review selected files in GitHub' })).toHaveProperty('disabled', true);
});

it('no pending changes cannot create a PR', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true, json: async () => ({ configured: true, baseSha: SHA, items: [] }),
  })));
  render(<ContentExportPanel idToken="test-token" onClose={vi.fn()} onStatus={vi.fn()} />);
  await screen.findByText('No pending live changes.');
  expect(screen.getByRole('button', { name: 'Review selected files in GitHub' }))
    .toHaveProperty('disabled', true);
});
