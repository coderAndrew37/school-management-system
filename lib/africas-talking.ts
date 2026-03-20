import africastalking from "africastalking";

const AT_API_KEY =
  process.env.AT_API_KEY ||
  ' sandbox           # literally the string "sandbox" for testing';
const AT_USERNAME = process.env.AT_USERNAME || "sandbox";

export const africasTalkingClient = africastalking({
  apiKey: AT_API_KEY,
  username: AT_USERNAME,
});

africasTalkingClient.SMS.send({
  to: "+254725746263", // recipient's phone number
  from: process.env.AT_SENDER_ID || "KIBALI", // your registered sender ID in production
  message: "Hello from Sleeksites Dev Team!",
})
  .then((response) => {
    console.log("SMS sent successfully:", response);
  })
  .catch((error) => {
    console.error("Error sending SMS:", error);
  });
