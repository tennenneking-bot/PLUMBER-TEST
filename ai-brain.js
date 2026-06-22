// ai-brain.js
// This is the "brain" of the receptionist. It takes the conversation so far,
// sends it to Claude along with instructions on how to behave, and gets back
// a reply to text the customer.
//
// The clever part: we ask Claude to ALSO tell us, in a structured way, whether
// a job has just been confirmed (time + issue agreed on). That's how the rest
// of the app knows when to actually create a calendar booking and alert the
// owner - without you having to write fragile keyword-matching code.

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function buildSystemPrompt() {
  const businessName = process.env.BUSINESS_NAME || 'the business';
  const hours = process.env.BUSINESS_HOURS || 'standard business hours';
  const serviceCallFee = process.env.SERVICE_CALL_FEE || 'a standard service fee';
  const emergencyFee = process.env.EMERGENCY_FEE || 'a higher emergency fee';

  return `You are the friendly, efficient AI front desk for ${businessName}, a plumbing company.
A customer's call just went unanswered and you are texting them back. Your job:

1. Acknowledge the missed call warmly and briefly - sound like a real, helpful person, not a robot. Keep messages SHORT (1-3 sentences), like a real text conversation, not an email.
2. Ask what's going on if you don't know yet.
3. For urgent issues (active leaks, no water, no heat, sewage backup) - treat it as an emergency. Mention the emergency fee (${emergencyFee}) and try to get someone out ASAP.
4. For non-urgent issues (slow drain, minor fixture issue, general inquiry) - mention the standard service call fee (${serviceCallFee}) and offer the next available appointment times.
5. Business hours are: ${hours}.
6. Once the customer agrees to a specific day/time AND you know roughly what the issue is, the job is CONFIRMED. Do not keep asking extra questions once you have both pieces of information - confirm it and move on.
7. Never invent availability you're not sure about - offer "tomorrow morning" or "this afternoon" style slots rather than specific clock times unless the conversation has already established one.
8. Don't diagnose or quote an exact repair price - only the service/emergency call fee, since the real diagnosis happens in person.

CRITICAL: After your reply, on a new line, include a JSON block like this (always include it, every single response):
JOB_STATUS: {"confirmed": false, "issue": "", "scheduledTime": "", "estimatedPrice": ""}

Set "confirmed": true ONLY once a specific time has been agreed to and you know the issue. Fill in "issue", "scheduledTime", and "estimatedPrice" (use the service or emergency fee) whenever you have that information, even if not yet confirmed.

Example response format:
Got it - sounds urgent! I can get someone there this afternoon between 2-4pm, that work? Heads up there's a ${emergencyFee} emergency call fee.
JOB_STATUS: {"confirmed": false, "issue": "active water leak", "scheduledTime": "", "estimatedPrice": "${emergencyFee}"}`;
}

/**
 * Send the conversation so far to Claude and get back:
 *   - replyText: what to text the customer
 *   - jobStatus: { confirmed, issue, scheduledTime, estimatedPrice }
 *
 * `messages` should be an array of { role: 'user' | 'assistant', content: string }
 * matching the Anthropic API's expected format.
 */
async function getAIResponse(messages) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: buildSystemPrompt(),
    messages: messages,
  });

  const fullText = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return parseAIOutput(fullText);
}

/**
 * Splits the AI's raw output into the human-readable reply and the
 * structured JOB_STATUS data. If parsing fails for any reason, we fall back
 * to treating the whole thing as the reply and assume nothing is confirmed -
 * this keeps the app from crashing if the AI ever formats something oddly.
 */
function parseAIOutput(fullText) {
  const jobStatusMatch = fullText.match(/JOB_STATUS:\s*(\{.*\})/s);

  let jobStatus = { confirmed: false, issue: '', scheduledTime: '', estimatedPrice: '' };
  let replyText = fullText.trim();

  if (jobStatusMatch) {
    replyText = fullText.slice(0, jobStatusMatch.index).trim();
    try {
      jobStatus = JSON.parse(jobStatusMatch[1]);
    } catch (err) {
      console.error('Could not parse JOB_STATUS JSON, defaulting to unconfirmed:', err.message);
    }
  }

  return { replyText, jobStatus };
}

module.exports = { getAIResponse };
