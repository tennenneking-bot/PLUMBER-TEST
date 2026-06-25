// db.js
// Simple in-memory data store for the AI receptionist MVP.
// NOTE: this resets every time the server restarts/redeploys (no real
// persistence). That's fine for testing — swap this out for a real
// database (Postgres, SQLite, etc.) before going to production with
// real customers, so job history doesn't disappear on every deploy.

// conversations: keyed by customer phone number
// { "+16617131454": { messages: [...], status: "active" | "booked" } }
const conversations = {};

// jobs: simple array, each job gets an incrementing id
const jobs = [];
let nextJobId = 1;

function saveConversation(phoneNumber, messages, status = 'active') {
  conversations[phoneNumber] = {
    messages,
    status,
    updatedAt: new Date().toISOString(),
  };
}

function getConversation(phoneNumber) {
  // If we've never talked to this number before, return a safe empty
  // conversation rather than undefined, so callers don't have to
  // null-check everywhere.
  if (!conversations[phoneNumber]) {
    return { messages: [], status: 'new' };
  }
  return conversations[phoneNumber];
}

function createJob({ phoneNumber, issueDescription, scheduledTime, estimatedPrice }) {
  const job = {
    id: nextJobId++,
    phoneNumber,
    issueDescription,
    scheduledTime,
    estimatedPrice,
    createdAt: new Date().toISOString(),
  };
  jobs.push(job);
  return job.id;
}

function getAllJobs() {
  return jobs;
}

module.exports = {
  saveConversation,
  getConversation,
  createJob,
  getAllJobs,
};
