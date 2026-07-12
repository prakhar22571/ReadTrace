export type TrackedEmail = {
  trackingId: string;
  subject: string;
  sender: string;
  recipients: string;
  isReply: boolean;
  sentAt: string;
  openCount: number;
  lastOpenedAt: string | null;
  clickCount: number;
};

export type RegisterEmailMessage = {
  type: "REGISTER_EMAIL";
  payload: { trackingId: string; subject: string; sender: string; recipients: string; isReply: boolean };
};

export type GetEmailsMessage = { type: "GET_EMAILS" };

export type ExtensionMessage = RegisterEmailMessage | GetEmailsMessage;

export type GetEmailsResponse =
  | { ok: true; emails: TrackedEmail[] }
  | { ok: false; error: string };

export type RegisterEmailResponse =
  | { ok: true }
  | { ok: false; error: string };
