// app/_components/communications/SmsCounter.tsx

import { SMS_MAX_PARTS, SMS_MULTI, SMS_SINGLE } from "./constants";

export function SmsCounter({ length }: { length: number }) {
  const parts = length <= SMS_SINGLE ? 1 : Math.ceil(length / SMS_MULTI);
  const limit = parts <= 1 ? SMS_SINGLE : SMS_MULTI * SMS_MAX_PARTS;
  const over = length > limit;
  return (
    <div
      className={`flex items-center justify-between text-[10px] ${over ? "text-rose-400" : "text-white/25"}`}
    >
      <span>{parts > 1 ? `${parts} SMS parts` : "1 SMS"}</span>
      <span className={over ? "text-rose-400 font-bold" : ""}>
        {length}/{limit}
        {over ? " — too long" : ""}
      </span>
    </div>
  );
}