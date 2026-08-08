import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ReportValidationError,
  buildIssueDraft,
  createDownload,
  resolveReporterName,
  validateReportPayload,
} from './reporting.js';
import { ReportConfigurationError, createGitHubIssue } from './githubIssues.js';

const validPayload = {
  type: 'issue',
  title: 'The thrower cannot move',
  description: 'Choosing Move leaves the player in place.',
  reporterName: 'Guest Coach',
  context: { mode: 'puzzle', scenarioId: 'scenario-003', scenarioName: 'Long Bomb' },
};

test('validates a report and keeps the chosen public alias', () => {
  const report = validateReportPayload(validPayload);
  assert.equal(resolveReporterName(report), 'Guest Coach');
});

test('rejects invalid category and missing guest reporter', () => {
  assert.throws(
    () => validateReportPayload({ ...validPayload, type: 'bug' }),
    ReportValidationError,
  );
  const report = validateReportPayload({ ...validPayload, reporterName: '' });
  assert.throws(() => resolveReporterName(report), ReportValidationError);
});

test('escapes user text when building the GitHub issue draft', () => {
  const report = validateReportPayload({
    ...validPayload,
    title: 'A *bold* title',
    description: 'Text with [a link] and # a heading.',
  });
  const draft = buildIssueDraft(report, 'Guest *Coach*', '2026-08-01T00:00:00.000Z');
  assert.equal(draft.title, '[Issue] A *bold* title');
  assert.ok(draft.body.includes('Guest \\*Coach\\*'));
  assert.ok(draft.body.includes('\\[a link\\] and \\# a heading.'));
});

test('creates an issue with the repository-scoped GitHub request', async () => {
  let request;
  const issue = await createGitHubIssue(
    { title: '[Issue] Test', body: 'Test body' },
    {
      token: 'test-token',
      fetchImpl: async (url, options) => {
        request = { url, options };
        return { ok: true, json: async () => ({ number: 42, html_url: 'https://github.com/HandsUpBilly/BBT/issues/42' }) };
      },
    },
  );
  assert.equal(request.url, 'https://api.github.com/repos/HandsUpBilly/BBT/issues');
  assert.equal(request.options.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(request.options.body), { title: '[Issue] Test', body: 'Test body' });
  assert.deepEqual(issue, { number: 42, url: 'https://github.com/HandsUpBilly/BBT/issues/42' });
});

test('requires a configured GitHub credential', async () => {
  await assert.rejects(
    () => createGitHubIssue({ title: '[Issue] Test', body: 'Test body' }, { token: '' }),
    ReportConfigurationError,
  );
});

test('the download fallback reproduces the issue the server would have filed', () => {
  const report = validateReportPayload(validPayload);
  const submittedAt = '2026-08-01T12:34:56.000Z';
  const draft = buildIssueDraft(report, 'Guest Coach', submittedAt);
  const download = createDownload(report, 'Guest Coach', submittedAt);

  assert.equal(download.fileName, 'bbt-issue-2026-08-01.md');
  assert.equal(download.content, `# ${draft.title}\n\n${draft.body}\n`);
});

test('trims whitespace consistently so client and server output match', () => {
  const report = validateReportPayload({
    ...validPayload,
    title: '  spaced   out  title  ',
    description: '  padded description  ',
  });
  const draft = buildIssueDraft(report, '  Padded Coach  ', '2026-08-01T00:00:00.000Z');
  assert.equal(draft.title, '[Issue] spaced out title');
  assert.ok(draft.body.includes('- Reporter: Padded Coach\n'));
  assert.ok(draft.body.includes('padded description'));
});
