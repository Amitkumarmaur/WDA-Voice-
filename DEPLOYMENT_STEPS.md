# Voicera Deployment Steps

Follow these steps to deploy all migrations and Edge Functions to your Supabase project.

---

## Prerequisites

- ✅ Supabase CLI installed (`npm install -g supabase`)
- ✅ Node.js 18+ installed
- ✅ Git (already using it)
- ✅ Access to your Supabase project

---

## Step 1: Authenticate with Supabase

Run this command:

```bash
supabase login
```

This will:
1. Open a browser to https://app.supabase.com/
2. Generate an access token
3. Copy the token and paste it in your terminal when prompted

**Expected output:**
```
Opening browser...
Paste your token here:
✅ Logged in successfully
```

---

## Step 2: Link to Your Remote Project

```bash
cd "C:\Users\amitm\OneDrive\Desktop\WDA-Voice-"
supabase link --project-ref wda-voice
```

This links your local Supabase config to your remote project.

**Expected output:**
```
Starting link...
Enter your database password: [paste your Supabase password]
✅ Linked to project wda-voice
```

---

## Step 3: Push Migrations to Remote Database

```bash
supabase db push --linked --include-all
```

This applies all local migrations (including the 2 new ones) to your remote database.

**Migrations being applied:**
1. ✅ 20260430120000_saas_core
2. ✅ 20260430120100_storage_kb
3. ✅ 20260430120200_ensure_org
4. ✅ 20260501130000_user_profiles
5. ✅ 20260502113316_contact_submissions
6. ✅ 20260502140000_platform_admin
7. ✅ 20260502150000_contact_submissions
8. ✅ 20260509140000_voice_quota_enforcement
9. ✅ 20260616120000_leads_appointments_phone_status
10. ✅ **20260616120100_missing_rpcs_rls_indexes** (NEW - critical fixes)
11. ✅ **20260616120200_billing_and_contact_fixes** (NEW - additional features)

**Expected output:**
```
Connecting to remote database...
Pushing migrations...
  [20260616120100_missing_rpcs_rls_indexes]
  [20260616120200_billing_and_contact_fixes]
✅ All migrations applied successfully
```

---

## Step 4: Deploy Edge Functions

Deploy each Edge Function to your Supabase project:

```bash
# Change to project directory
cd "C:\Users\amitm\OneDrive\Desktop\WDA-Voice-"

# Deploy all functions
supabase functions deploy gemini-live-token
supabase functions deploy gemini-generate
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
supabase functions deploy contact-form
supabase functions deploy reset-monthly-usage
```

Or use the script to deploy all at once:

```bash
bash DEPLOY.sh
```

**Expected output for each:**
```
Deploying function gemini-live-token...
✅ Function deployed successfully
Endpoint: https://wda-voice.supabase.co/functions/v1/gemini-live-token
```

---

## Step 5: Set Environment Variables

Go to Supabase Dashboard:
1. Click your project → **Settings** (bottom left)
2. Go to **Edge Functions** → **Secrets**
3. Add these environment variables:

```
GEMINI_API_KEY=sk-...              (from Google AI Studio)
STRIPE_SECRET_KEY=sk_live_...      (from Stripe Dashboard)
STRIPE_PRICE_ID=price_...          (Stripe subscription price ID)
STRIPE_WEBHOOK_SECRET=whsec_...    (from Stripe → Webhooks)
SITE_URL=https://yourdomain.com    (your production URL)
```

**How to get each:**

### GEMINI_API_KEY
1. Go to https://aistudio.google.com/app/apikeys
2. Create an API key
3. Copy and paste here

### STRIPE_SECRET_KEY
1. Go to Stripe Dashboard → Developers → API Keys
2. Copy the Secret Key (starts with `sk_live_`)

### STRIPE_PRICE_ID
1. Go to Stripe Dashboard → Products
2. Create a subscription product if you haven't already
3. Copy the Price ID (starts with `price_`)

### STRIPE_WEBHOOK_SECRET
1. Go to Stripe Dashboard → Developers → Webhooks
2. Create a new endpoint (see Step 6 below)
3. Copy the Signing Secret (starts with `whsec_`)

### SITE_URL
Your production domain, e.g., `https://voicera.app`

---

## Step 6: Register Stripe Webhook

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Fill in:
   - **Endpoint URL:** `https://wda-voice.supabase.co/functions/v1/stripe-webhook`
   - **Events:** Select these events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
4. Click **Add endpoint**
5. Click the endpoint → Copy **Signing secret**
6. Paste it as `STRIPE_WEBHOOK_SECRET` in Supabase → Edge Functions → Secrets

---

## Step 7: Verify Deployment

### Check Migrations Applied
```bash
supabase migration list --linked
```

Should show all 11 migrations as "✓ applied"

### Check Edge Functions Deployed
```bash
supabase functions list
```

Should show all 6 functions with status "Ready"

### Test a Simple Call
In browser console:
```javascript
fetch('https://wda-voice.supabase.co/functions/v1/contact-form', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: '{ANON_KEY}' },
  body: JSON.stringify({ name: 'Test', email: 'test@example.com', message: 'Test message' })
})
.then(r => r.json())
.then(d => console.log(d))
```

Should return: `{ ok: true }`

---

## Step 8: Run Verification Tests

See **BACKEND_IMPLEMENTATION_GUIDE.md** for 10 comprehensive verification tests:

1. ✅ User signup → org auto-created
2. ✅ Voice agent → works with quota
3. ✅ Lead capture → saved to DB
4. ✅ Appointment scheduling → saved to DB
5. ✅ Knowledge base upload → text extracted
6. ✅ Voice profile analysis → saved correctly
7. ✅ Billing integration → Stripe checkout
8. ✅ Admin dashboard → loads users
9. ✅ Public embed → works without auth
10. ✅ Tenant isolation → RLS working

---

## Step 9: Set Up Monthly Usage Reset (Optional)

**Option A: Using pg_cron (Automatic)**

1. Go to Supabase Dashboard → **SQL Editor**
2. Click **New query**
3. Paste and run:
   ```sql
   SELECT cron.schedule(
     'reset-monthly-usage',
     '0 5 * * *',
     'SELECT public.reset_monthly_usage()'
   );
   ```
4. This runs daily at 05:00 UTC

**Option B: External Cron (Manual)**

Use a service like cron-job.org:
1. Create new cron job
2. URL: `https://wda-voice.supabase.co/functions/v1/reset-monthly-usage`
3. Header: `Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}`
4. Schedule: Daily at your preferred time

---

## Troubleshooting

### "Access token not provided"
```bash
supabase login
```

### "Failed to push migrations"
1. Check database password is correct
2. Check migrations are valid SQL
3. Try: `supabase db push --linked --dry-run` to see what would be applied

### "Function deploy failed"
1. Check `.env` file for GEMINI_API_KEY (required for test)
2. Check function TypeScript syntax: `supabase functions compile`
3. Check Node.js version: `node --version` (should be 18+)

### "RLS policies not working"
After applying migrations, clear browser cache and logout/login to refresh auth token.

---

## Summary Checklist

- [ ] Ran `supabase login`
- [ ] Ran `supabase link --project-ref wda-voice`
- [ ] Ran `supabase db push --linked --include-all`
- [ ] Deployed all 6 Edge Functions
- [ ] Set 5 environment variables in Supabase
- [ ] Registered Stripe webhook
- [ ] Verified migrations applied (11 total)
- [ ] Verified Edge Functions deployed (6 total)
- [ ] Ran 10 verification tests
- [ ] Set up monthly usage reset cron

---

## Next Steps

1. ✅ **Deployment complete**
2. 🧪 **Run verification tests** (BACKEND_IMPLEMENTATION_GUIDE.md)
3. 🔐 **Security review** (check SUPABASE_AUDIT.md)
4. 📊 **Monitor production** (check billing_events, usage logs)
5. 🚀 **Go live!**

---

**Questions?** See **BACKEND_IMPLEMENTATION_GUIDE.md** for troubleshooting and detailed API reference.

**Last Updated:** 2026-06-16
