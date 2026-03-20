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
export const sendSMS = async (
  to: string | string[],
  message: string,
): Promise<ATResponse> => {
  const options: any = {
    to: Array.isArray(to) ? to : [to],
    message,
  };

  // Only set 'from' when a sender ID is configured —
  // passing undefined causes 400/401 errors in sandbox
  if (process.env.AT_SENDER_ID) {
    options.from = process.env.AT_SENDER_ID;
  }

  // sms.send() returns the AT SDK's own SMSMessageData type which doesn't
  // overlap with our ATResponse interface. Cast through unknown first.
  const response = (await sms.send(options)) as unknown as ATResponse;

  console.log("[AT-Client] SMS sent successfully");
  return response;
};
