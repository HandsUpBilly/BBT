export class AuthEmailConfigurationError extends Error {}
export class AuthEmailDeliveryError extends Error {}

export async function sendMagicLinkEmail(
  { email, link },
  {
    apiKey = process.env.RESEND_API_KEY,
    from = process.env.AUTH_EMAIL_FROM ?? process.env.CONTACT_EMAIL_FROM,
    fetchImpl = fetch,
  } = {},
) {
  if (!apiKey || !from) throw new AuthEmailConfigurationError('Email login is not configured');
  let response;
  try {
    response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Your Turn 16 login link',
        text: `Use this link to sign in to Turn 16:\n\n${link}\n\nThis link expires in 15 minutes. If you did not request it, you can ignore this email.`,
      }),
    });
  } catch {
    throw new AuthEmailDeliveryError('Could not reach the email service');
  }
  if (!response.ok) throw new AuthEmailDeliveryError('The email service could not send the login link');
  return response.json();
}
