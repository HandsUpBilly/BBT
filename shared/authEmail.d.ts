export class AuthEmailConfigurationError extends Error {}
export class AuthEmailDeliveryError extends Error {}
export function sendMagicLinkEmail(
  message: { email: string; link: string },
  options?: { apiKey?: string; from?: string; fetchImpl?: typeof fetch },
): Promise<unknown>;
