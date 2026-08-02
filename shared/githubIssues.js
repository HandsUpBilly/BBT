// Server-only half of issue reporting: the GitHub call and the credential.
// Kept out of shared/reporting.js so the browser bundle can import the
// Markdown builders without ever touching process.env.

export class ReportConfigurationError extends Error {}
export class ReportDeliveryError extends Error {}

const ISSUES_URL = 'https://api.github.com/repos/HandsUpBilly/BBT/issues';

export async function createGitHubIssue(
  draft,
  { token = process.env.GITHUB_ISSUES_TOKEN, fetchImpl = fetch } = {},
) {
  if (!token) throw new ReportConfigurationError('Issue reporting is not configured');

  let response;
  try {
    response = await fetchImpl(ISSUES_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title: draft.title, body: draft.body }),
    });
  } catch {
    throw new ReportDeliveryError('Could not reach GitHub');
  }

  if (!response.ok) throw new ReportDeliveryError('GitHub could not create the issue');

  let issue;
  try {
    issue = await response.json();
  } catch {
    throw new ReportDeliveryError('GitHub returned an invalid response');
  }

  if (!Number.isInteger(issue?.number) || typeof issue?.html_url !== 'string') {
    throw new ReportDeliveryError('GitHub returned an incomplete issue response');
  }

  return { number: issue.number, url: issue.html_url };
}
