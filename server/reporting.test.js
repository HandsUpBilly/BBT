import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ReportConfigurationError,
  ReportValidationError,
  buildIssueDraft,
  createGitHubIssue,
  resolveReporterName,
  validateReportPayload,
} from './reporting.js';

const validPayload = {
  type: 'issue',
  title: 'The thrower cannot move',
  description: 'Choosing Move leaves the player in place.',
  reporterName: 'Guest Coach',
  context: { mode: 'puzzle', scenarioId: 'scenario-003', scenarioName: 'Long Bomb' },
};

test('validates a report and prefers the verified Google name', () => {
  const report = validateReportPayload(validPayload);
  assert.equal(resolveReporterName(report, { name: 'Verified Coach' }), 'Verified Coach');
  assert.equal(resolveReporterName(report, null), 'Guest Coach');
});

test('rejects invalid category and missing guest reporter', () => {
  assert.throws(
    () => validateReportPayload({ ...validPayload, type: 'bug' }),
    ReportValidationError,
  );
  const report = validateReportPayload({ ...validPayload, reporterName: '' });
  assert.throws(() => resolveReporterName(report, null), ReportValidationError);
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
