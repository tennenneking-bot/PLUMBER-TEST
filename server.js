// server.js
// This is the main app. It exposes two webhook URLs that you'll paste into
// your Twilio phone number settings:
//
//   POST /webhooks/missed-call   <- Twilio calls this when a call isn't answered
//   POST /webhooks/incoming-sms  <- Twilio calls this whenever a customer texts back
//
// Twilio expects these endpoints to respond with a specific XML format
// (called TwiML) for the missed-call one, and we use the Twilio SDK directly
// to send texts for the SMS one. Both are handled below with comments
// explaining each step.

require('dotenv').config();
const express = require('express');
const twilio = require('twilio');

const db = require('./db');
const { getAIResponse } = require('./ai-brain');
const { sendSMS, notifyOwnerOfNewJob } = require('./sms');
const { bookJobOnCalendar } = require('./calendar');

const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio sends form-encoded data
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ----------------------------------------------------------------------------
// WEBHOOK 1: Missed call
// ----------------------------------------------------------------------------
// How this gets triggered: in your Twilio phone number settings, you set the
// "Call comes in" webhook to point at a small TwiML flow that:
//   1. Tries to forward the call to the owner's real cell phone
//   2. If there's no answer within N seconds, falls back to THIS endpoint
// Twilio's "Studio Flow" or a simple <Dial> with timeout handles step 1-2;
// see SETUP_GUIDE.md for the exact no-code Twilio Console steps.
//
// This endpoint's job: fire off the very first auto-text to the customer.
app.post('/webhooks/missed-call', async (req, res) => {
  const customerPhone = req.body.From;
  console.log(`Missed call from ${customerPhone}`);

  try {
    const businessName = process.env.BUSINESS_NAME || 'us';
    const firstMessage = `Hey! This is ${businessName} — sorry we missed your call, we're probably on a job. What's going on? We'll get right back to you.`;

    // Save this as the start of a new conversation
    db.saveConversation(customerPhone, [
      { role: 'assistant', content: firstMessage },
    ]);

    await sendSMS(customerPhone, firstMessage);
  } catch (err) {
    console.error('Error handling missed call:', err.message);
  }

  // Twilio expects a TwiML (XML) response even though we don't need it to say
  // anything further - an empty <Response/> just tells Twilio "all good, no
  // further call action needed."
  res.type('text/xml');
  res.send('<Response></Response>');
});

// ----------------------------------------------------------------------------
// WEBHOOK 2: Incoming SMS (the customer replying to the auto-text)
// ----------------------------------------------------------------------------
// You set this as the "A message comes in" webhook on your Twilio number.
// This fires every time the customer sends a text - this is where the real
// back-and-forth conversation with the AI happens.
app.post('/webhooks/incoming-sms', async (req, res) => {
  const customerPhone = req.body.From;
  const customerMessage = req.body.Body;
  console.log(`SMS from ${customerPhone}: "${customerMessage}"`);

  try {
    const conversation = db.getConversation(customerPhone);

    // Add the customer's new message to the conversation history
    const messages = [...conversation.messages, { role: 'user', content: customerMessage }];

    // Ask Claude what to say back, and whether a job is now confirmed
    const { replyText, jobStatus } = await getAIResponse(messages);

    // Save the AI's reply into the conversation history too, so next time
    // it remembers what it already said
    const updatedMessages = [...messages, { role: 'assistant', content: replyText }];
    db.saveConversation(customerPhone, updatedMessages, jobStatus.confirmed ? 'booked' : 'active');

    // Text the reply back to the customer
    await sendSMS(customerPhone, replyText);

    // If the AI just confirmed a job, record it, try to book the calendar
    // event, and alert the owner
    if (jobStatus.confirmed) {
      const jobId = db.createJob({
        phoneNumber: customerPhone,
        issueDescription: jobStatus.issue,
        scheduledTime: jobStatus.scheduledTime,
        estimatedPrice: jobStatus.estimatedPrice,
      });
      console.log(`Job #${jobId} created for ${customerPhone}`);

      await bookJobOnCalendar({
        issue: jobStatus.issue,
        scheduledTime: jobStatus.scheduledTime,
        estimatedPrice: jobStatus.estimatedPrice,
        customerPhone,
      });

      await notifyOwnerOfNewJob({
        issue: jobStatus.issue,
        scheduledTime: jobStatus.scheduledTime,
        estimatedPrice: jobStatus.estimatedPrice,
        customerPhone,
      });
    }
  } catch (err) {
    console.error('Error handling incoming SMS:', err.message);
  }

  res.type('text/xml');
  res.send('<Response></Response>');
});

// ----------------------------------------------------------------------------
// Simple dashboard endpoint - lets you see booked jobs without a real UI yet
// ----------------------------------------------------------------------------
app.get('/jobs', (req, res) => {
  const jobs = db.getAllJobs();
  res.json(jobs);
});

// Health check - useful for confirming the server is alive after deploying
app.get('/', (req, res) => {
  res.send('AI Receptionist is running.');
});

app.listen(PORT, () => {
  console.log(`AI Receptionist server listening on port ${PORT}`);
});
