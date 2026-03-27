// at-test.js
const africastalking = require("africastalking");

// 🔍 1. MANUALLY PLUG IN YOUR CREDENTIALS HERE FOR THE TEST
const credentials = {
  apiKey: "your-at-api-key", // your AT API key or 'sandbox'
  username: "kibali", // your AT username or 'sandbox'
};

const AT = africastalking(credentials);
const sms = AT.SMS;

async function sendTestSms() {
  console.log("🚀 Starting AT Test...");
  console.log(`Using Username: ${credentials.username}`);

  const options = {
    to: ["+254746577838"], // 👈 YOUR ACTUAL PHONE NUMBER
    message: "Kibali Academy Demo: If you see this, the API works!",
    enqueue: true,
    // from: 'KIBALI'       // ❌ LEAVE COMMENTED OUT UNLESS APPROVED
  };

  try {
    const response = await sms.send(options);
    console.log("✅ RAW RESPONSE FROM AT:");
    console.log(JSON.stringify(response, null, 2));

    const recipients = response.SMSMessageData.Recipients;
    if (recipients.length > 0) {
      const status = recipients[0].status;
      const code = recipients[0].statusCode;
      console.log(`\n📊 Result: ${status} (Code: ${code})`);

      if (code === 101 || code === 100) {
        console.log("🔥 SUCCESS! Check your phone.");
      } else {
        console.log(
          "⚠️ AT accepted the request but delivery failed (Check balance/DND).",
        );
      }
    }
  } catch (error) {
    console.error("❌ FATAL ERROR:");
    console.error(error);
  }
}

sendTestSms();
