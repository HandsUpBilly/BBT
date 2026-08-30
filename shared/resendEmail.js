// Server-only half of the contact workflow: the Resend API call and the
// credentials. Kept out of shared/contactMessage.js so the browser bundle can
// import the validation/content builder without ever touching process.env.

export class ContactConfigurationError extends Error {}
export class ContactDeliveryError extends Error {}

const RESEND_URL = 'https://api.resend.com/emails';

export async function sendContactEmail(
  contact,
  emailContent,
  {
    apiKey = process.env.RESEND_API_KEY,
    to = process.env.CONTACT_EMAIL_TO,
    from = process.env.CONTACT_EMAIL_FROM,
    fetchImpl = fetch,
  } = {},
) {
  if (!apiKey || !to || !from) throw new ContactConfigurationError('Contact form is not configured');

  let response;
  try {
    response = await fetchImpl(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: contact.email,
        subject: emailContent.subject,
        text: emailContent.text,
      }),
    });
  } catch {
    throw new ContactDeliveryError('Could not reach the email service');
  }

  if (!response.ok) throw new ContactDeliveryError('The email service could not send the message');

  let result;
  try {
    result = await response.json();
  } catch {
    throw new ContactDeliveryError('The email service returned an invalid response');
  }

  if (typeof result?.id !== 'string') {
    throw new ContactDeliveryError('The email service returned an incomplete response');
  }

  return { id: result.id };
}
