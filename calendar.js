// calendar.js
// Creates a calendar event once a job is confirmed.
//
// NOTE: Google Calendar setup requires OAuth, which is the single fiddliest
// part of this whole project for a beginner. To keep you moving fast, this
// file is written so the app WORKS WITHOUT calendar integration on day one -
// if no calendar credentials are present, it just logs the booking instead of
// crashing. You can wire up real Google Calendar later once everything else
// is working and tested. See SETUP_GUIDE.md for the calendar setup steps
// when you're ready for that piece.

const { google } = require('googleapis');

function isCalendarConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

function getCalendarClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Creates a calendar event for the booked job.
 * Falls back to just logging if Google Calendar isn't set up yet.
 *
 * jobDetails: { issue, scheduledTime, estimatedPrice, customerPhone }
 */
async function bookJobOnCalendar(jobDetails) {
  if (!isCalendarConfigured()) {
    console.log('[Calendar not configured yet - skipping real booking] Job details:', jobDetails);
    return { success: false, reason: 'calendar_not_configured' };
  }

  try {
    const calendar = getCalendarClient();

    // NOTE: scheduledTime from the AI is currently a loose phrase like
    // "tomorrow afternoon" rather than an exact ISO timestamp. For a real
    // production version, you'd want the AI prompt to nail down an exact
    // date/time before confirming. For now this creates an all-day-ish
    // placeholder event so nothing breaks - refine this once volume justifies it.
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + 1);
    startTime.setHours(9, 0, 0);
    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + 1);

    const event = {
      summary: `Plumbing Job: ${jobDetails.issue}`,
      description: `Customer: ${jobDetails.customerPhone}\nEstimated: ${jobDetails.estimatedPrice}\nRequested time: ${jobDetails.scheduledTime}`,
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
    };

    const result = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    return { success: true, eventId: result.data.id };
  } catch (err) {
    console.error('Calendar booking failed:', err.message);
    return { success: false, reason: 'api_error', error: err.message };
  }
}

module.exports = { bookJobOnCalendar, isCalendarConfigured };
