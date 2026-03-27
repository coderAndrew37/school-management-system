import "dotenv/config";
import africastalking from "africastalking";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ATRecipient {
  number: string;
  status: string;
  cost: string;
  messageId: string;
  statusCode: number;
}

export interface ATResponse {
  SMSMessageData: {
    Message: string;
    Recipients: ATRecipient[];
  };
}

// ── Client ────────────────────────────────────────────────────────────────────

const at = africastalking({
  apiKey: process.env.AT_API_KEY ?? "",
  username: process.env.AT_USERNAME ?? "sandbox",
});

const sms = at.SMS;

/**
 * Sends a single or bulk SMS via Africa's Talking.
 * @param to      - Phone number string or array e.g. "+254712345678"
 * @param message - Text content to send
 */
// at-client.ts refinement for demo
export const sendSMS = async (
  to: string | string[],
  message: string,
): Promise<ATResponse> => {
  const options: any = {
    to: Array.isArray(to) ? to : [to],
    message,
  };

  // Switch to the shared ID for demoing
  // If AT_SENDER_ID is missing in .env, AT defaults to "AFRICASTKNG"
  if (process.env.AT_SENDER_ID) {
    options.from = process.env.AT_SENDER_ID;
  }

  const response = (await sms.send(options)) as unknown as ATResponse;
  return response;
};
