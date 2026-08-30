export declare const CONTACT_LIMITS: {
  name: number;
  email: number;
  message: number;
};

export declare class ContactValidationError extends Error {}

export interface ValidatedContact {
  name: string;
  email: string;
  message: string;
}

export interface ContactEmailContent {
  subject: string;
  text: string;
}

export declare function validateContactPayload(payload: unknown): ValidatedContact;
export declare function buildContactEmail(
  contact: ValidatedContact,
  submittedAt?: string,
): ContactEmailContent;
