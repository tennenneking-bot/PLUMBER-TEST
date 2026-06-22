# Setup Guide — AI Receptionist

This walks you through getting this live on a real phone number, start to finish.
No coding experience needed for these steps — you're mostly clicking through
websites and copy-pasting values into a file.

Budget about 2-3 hours for your first setup. It gets fast after that.

---

## What you're building

A phone number that:
1. Forwards real calls to the plumber's actual cell phone
2. If unanswered, automatically texts the customer back
3. Has an AI conversation, figures out the problem, quotes the fee, books a time
4. Texts the owner a summary the moment a job is confirmed

---

## Step 1: Get a Twilio account + phone number (~15 min)

1. Go to **twilio.com** → sign up for a free trial account
2. Once in the console, go to **Phone Numbers → Buy a Number**
3. Pick a number with the plumber's local area code (looks more trustworthy)
4. Cost: about **$1.15/month** per number, plus pennies per text/call — this is the only real recurring cost beyond your AI usage
5. From the main Console dashboard, copy these two values somewhere safe:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click "show" to reveal it)

These go into your `.env` file later as `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.

⚠️ Trial accounts can only text/call numbers you've manually verified in the Twilio console first. To text *any* customer, you need to upgrade to a paid account (just add a card — costs stay tiny at low volume, a few dollars a month).

---

## Step 2: Get an Anthropic API key (~5 min)

1. Go to **console.anthropic.com** → sign up
2. Go to **API Keys** → Create Key
3. Copy the key (starts with `sk-ant-...`) into `.env` as `ANTHROPIC_API_KEY`
4. Add a small amount of credit (a few dollars covers hundreds of conversations using Haiku, the cheap fast model this app already uses)

---

## Step 3: Fill in your `.env` file (~10 min)

1. In the project folder, find `.env.example`
2. Make a copy of it named exactly `.env` (no `.example` at the end)
3. Fill in every value:
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — from Step 1
   - `ANTHROPIC_API_KEY` — from Step 2
   - `OWNER_PHONE_NUMBER` — the plumber's real cell number, format `+19165551234`
   - `BUSINESS_NAME`, `BUSINESS_HOURS`, `SERVICE_CALL_FEE`, `EMERGENCY_FEE` — fill these in per client; this is how you customize the same code for every new business you sign up

**Never share this file or upload it anywhere public** — it contains your real API keys and is effectively the password to your Twilio and Anthropic accounts.

---

## Step 4: Deploy the app so it's live 24/7 (~20 min)

Your computer being on isn't a real option — this needs to run on a server that's always on. The easiest beginner-friendly option:

### Using Railway (recommended for total beginners)
1. Go to **railway.app**, sign up with GitHub
2. Push this project folder to a GitHub repository (GitHub has a simple "upload files" web button if you don't know git commands yet — search "upload files to GitHub without git" if needed)
3. In Railway, click **New Project → Deploy from GitHub repo** → pick your repo
4. Railway will auto-detect it's a Node.js app and deploy it
5. In Railway's project settings, go to **Variables** and paste in every value from your `.env` file (same names, same values)
6. Once deployed, Railway gives you a public URL like `https://your-app.up.railway.app` — **save this URL**, you need it next

Cost: Railway has a free trial credit, then it's usage-based — at this scale, expect single-digit dollars per month.

---

## Step 5: Connect Twilio to your deployed app (~10 min)

This is the step that actually wires the phone number to your code.

1. In the Twilio Console, go to **Phone Numbers → Manage → Active Numbers** → click your number
2. Scroll to **Voice Configuration**:
   - Set "A call comes in" to **Webhook**
   - You'll need a small TwiML Bin or Studio Flow that dials the owner's cell with a timeout, then falls back to your missed-call webhook. The simplest no-code way:
     - Go to **TwiML Bins** in the Twilio console → create a new one
     - Paste this in, replacing the number with the owner's real cell:
       ```xml
       <Response>
         <Dial timeout="20" action="https://your-app.up.railway.app/webhooks/missed-call">
           +19165559999
         </Dial>
       </Response>
       ```
     - This rings the owner's phone for 20 seconds; if no answer, Twilio calls your missed-call webhook automatically
   - Set the phone number's "A call comes in" webhook to point at this TwiML Bin
3. Scroll to **Messaging Configuration**:
   - Set "A message comes in" to **Webhook**
   - Enter: `https://your-app.up.railway.app/webhooks/incoming-sms`
   - Method: **HTTP POST**
4. Save.

---

## Step 6: Test it yourself before going live with a real client

1. Call the Twilio number from your own phone
2. Let it ring without answering (don't pick up on the "owner" side)
3. You should get an auto-text within a few seconds
4. Reply like a customer would ("my water heater is leaking") and have a full back-and-forth
5. Confirm a time — check that you (as the "owner") get the job alert text
6. Check `https://your-app.up.railway.app/jobs` in a browser — you should see the booked job logged as JSON

If something doesn't fire, check Railway's **Deployments → Logs** tab — every step in the code logs what it's doing, which will tell you exactly where it broke.

---

## Calendar booking — optional, do this later

The calendar piece (`calendar.js`) is written to **not break anything** if you skip it — it just logs the booking instead of creating a real calendar event until you set up Google's OAuth credentials. This is the fiddliest part of the whole project. Skip it entirely for your first few clients; the SMS-based job alert to the owner already gets the job done. Come back to real calendar integration once you've validated the core flow works and you want to polish it.

---

## Reusing this for every new client

Everything client-specific lives in `.env`. To onboard a new business:
1. Buy them a new Twilio number (~$1/mo)
2. Copy your `.env` values but swap `BUSINESS_NAME`, `BUSINESS_HOURS`, fees, and `OWNER_PHONE_NUMBER`
3. Deploy a separate Railway project per client (or look into multi-tenant routing once you have 5+ clients and want to consolidate — not worth the complexity yet)

---

## When you get stuck

Paste me the exact error message from Railway's logs or Twilio's debugger (Console → Monitor → Logs → Errors) and I'll help you debug it.
