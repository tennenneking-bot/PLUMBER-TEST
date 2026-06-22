// sms.js
// Small helper for sending text messages via Twilio. Both the auto-reply to
// customers and the "job booked!" alert to the plumber go through this.

const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendSMS(toNumber, body) {
  try {
    const message = await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: toNumber,
      body: body,
    });
    console.log(`SMS sent to ${toNumber}: "${body.slice(0, 50)}..." (sid: ${message.sid})`);
    return message;
  } catch (err) {
    console.error(`Failed to send SMS to ${toNumber}:`, err.message);
    throw err;
  }
}

async function notifyOwnerOfNewJob(jobDetails) {
  const ownerPhone = process.env.OWNER_PHONE_NUMBER;
  const message = `🔧 JOB BOOKED via AI receptionist\nIssue: ${jobDetails.issue}\nTime: ${jobDetails.scheduledTime}\nEst: ${jobDetails.estimatedPrice}\nCustomer: ${jobDetails.customerPhone}`;
  return sendSMS(ownerPhone, message);
}

module.exports = { sendSMS, notifyOwnerOfNewJob };
