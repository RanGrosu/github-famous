import { HttpError, TaggedError } from '../utils/logging';

export interface ResendEmailPayload {
  subject: string;
  from: string;
  to: string;
  html?: string;
  text?: string;
  reply_to?: string;
}

export class ResendClient {
  public static readonly baseUrl = 'https://api.resend.com/emails';
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    if (!apiKey) throw new TaggedError('config', 'RESEND_API_KEY required');
    this.apiKey = apiKey;
  }

  async sendEmail(email: ResendEmailPayload): Promise<{ id: string }> {
    const res = await fetch(ResendClient.baseUrl, {
      method: 'POST',
      body: JSON.stringify(email),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new HttpError('resend', 'email sending failed', res);
    }

    const json = await res.json();
    if (!json.id) {
      throw new HttpError('resend', 'send returned no ID', res);
    }

    return { id: json.id };
  }
}
