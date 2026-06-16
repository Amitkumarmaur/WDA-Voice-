# Voicera Backend Implementation Guide

Complete step-by-step guide to deploy and verify the Supabase backend for the Voicera voice-agent SaaS platform.

---

## 📋 Pre-Deployment Checklist

### Environment Variables Required
Set these in your Supabase project (Project Settings → Edge Functions → Secrets):

```
GEMINI_API_KEY=sk-...              (from Google AI Studio)
STRIPE_SECRET_KEY=sk_live_...      (from Stripe Dashboard)
STRIPE_PRICE_ID=price_...          (Stripe pricing ID for subscription)
STRIPE_WEBHOOK_SECRET=whsec_...    (from Stripe → Webhook Endpoint)
SITE_URL=https://yourdomain.com    (your production URL)
```

### Database Connection
- Project URL: `https://{project-id}.supabase.co`
- Anon Key: `(from API Settings)`
- Service Role Key: `(from API Settings)` - KEEP PRIVATE

---

## 🚀 Deployment Steps

### Step 1: Apply Database Migrations

Run all migrations in order:

```bash
cd supabase
supabase migration up

# Or individually in order:
supabase migration up --experimental 20260430120000_saas_core
supabase migration up --experimental 20260430120100_storage_kb
supabase migration up --experimental 20260430120200_ensure_org
supabase migration up --experimental 20260501130000_user_profiles
supabase migration up --experimental 20260502113316_contact_submissions
supabase migration up --experimental 20260502140000_platform_admin
supabase migration up --experimental 20260502150000_contact_submissions
supabase migration up --experimental 20260509140000_voice_quota_enforcement
supabase migration up --experimental 20260616120000_leads_appointments_phone_status
supabase migration up --experimental 20260616120100_missing_rpcs_rls_indexes
supabase migration up --experimental 20260616120200_billing_and_contact_fixes
```

**What these create:**
- ✅ Multi-tenant org/membership structure
- ✅ User profiles (denormalized from auth)
- ✅ Knowledge base (tables + storage)
- ✅ Leads & appointments (with phone & status)
- ✅ Transcripts (with duration tracking)
- ✅ Voice profiles & agent settings
- ✅ Contact submissions (marketing)
- ✅ Billing tracking (Stripe metadata)
- ✅ Voice usage accounting & quotas
- ✅ RLS policies & indexes

### Step 2: Deploy Edge Functions

```bash
supabase functions deploy gemini-live-token
supabase functions deploy gemini-generate
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
supabase functions deploy contact-form
supabase functions deploy reset-monthly-usage
```

**Verify deployment:**
```bash
supabase functions list
# Should show all 6 functions with status "Ready"
```

### Step 3: Configure Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Create new endpoint:
   - **URL:** `https://{project-id}.supabase.co/functions/v1/stripe-webhook`
   - **Events:** Select these:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
3. Copy Webhook Signing Secret → Set as `STRIPE_WEBHOOK_SECRET` env var on Supabase

### Step 4: Set Up Monthly Usage Reset (Optional but Recommended)

**Option A: Using pg_cron (Automatic)**
1. Go to Supabase Dashboard → SQL Editor
2. Run this SQL (one-time setup):
   ```sql
   SELECT cron.schedule(
     'reset-monthly-usage',
     '0 5 * * *',
     'SELECT public.reset_monthly_usage()'
   );
   ```
3. This runs daily at 05:00 UTC and resets usage for orgs past their `billing_reset_at`

**Option B: External Cron (Manual)**
1. Use cron-job.org or similar
2. POST to: `https://{project-id}.supabase.co/functions/v1/reset-monthly-usage`
3. Header: `Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}`
4. Schedule: Daily at your preferred time

---

## ✅ Verification Tests

### Test 1: User Signup
```javascript
// Browser console on /auth/signup
// After signup, check Supabase:
// - profiles row created ✓
// - organizations row created ✓
// - organization_members row created (role='owner') ✓
// - agent_settings row created ✓
```

### Test 2: Voice Agent Public Embed
```javascript
// Open /embed/{public_slug} in incognito
// 1. Click "Start Conversation"
// 2. Browser makes request to:
//    POST /functions/v1/gemini-live-token
// 3. Should return JWT token (200 OK)
// 4. WebSocket connects and voice agent responds ✓
```

### Test 3: Lead Capture
```javascript
// During voice agent conversation:
// Agent asks for name/email and says "I'm capturing your info"
// Check transcripts table:
//   - New transcript row created ✓
//   - New lead row created with phone & status='new' ✓
//   - voice_usage_events row logged ✓
//   - organizations.monthly_voice_minutes_used incremented ✓
```

### Test 4: Appointment Scheduling
```javascript
// Agent says "Let me schedule a follow-up"
// After conversation, check appointments table:
//   - New appointment row created ✓
//   - Has phone & status='pending' ✓
//   - date field set correctly ✓
```

### Test 5: Knowledge Base Upload
```javascript
// In dashboard → Knowledge Base:
// Upload a PDF file
// Check:
//   - kb-files storage has the file ✓
//   - knowledge_items table has row ✓
//   - content field has extracted text ✓
```

### Test 6: Billing Integration
```javascript
// In dashboard → Billing:
// Click "Upgrade"
// Should redirect to Stripe checkout
// After payment in Stripe simulator:
//   - checkout.session.completed webhook fires ✓
//   - organizations.stripe_customer_id set ✓
//   - organization_subscriptions row created ✓
//   - organizations.subscription_status = 'active' ✓
//   - organizations.monthly_voice_minutes_limit increased ✓
```

### Test 7: Voice Quota Enforcement
```javascript
// Test org with limit=60 minutes, used=59 minutes
// 1. Try to use voice agent: should work ✓
// 2. Use 2 more minutes (total: 61)
// 3. Try to use voice agent again: should get 402 error ✓
//    Error message: "Monthly voice minutes quota reached for this workspace. Upgrade or wait until usage resets."
```

### Test 8: Admin Dashboard
```javascript
// As platform admin:
// GET /admin
// Should load admin_get_users_directory() and show:
//   - All users with email ✓
//   - Their orgs & subscription status ✓
//   - Usage counts (knowledge, leads, appointments, transcripts) ✓
//   - Click user → see admin_get_user_detail() with deep data ✓
```

### Test 9: Tenant Isolation
```javascript
// As User A logged in:
// Try to read User B's leads:
//   SELECT * FROM leads WHERE organization_id = '{user-b-org-id}'
// Should return: RLS policy violation ✓

// Try to read agent_settings for User B:
//   SELECT * FROM agent_settings WHERE organization_id = '{user-b-org-id}'
// Should return: RLS policy violation ✓
```

### Test 10: Contact Form (Marketing)
```javascript
// On marketing site /contact:
// Submit form with name, email, message
// Check contact_submissions table:
//   - Row created with company field (if provided) ✓
//   - created_at timestamp set ✓
// Honeypot: if website field filled, silently accept but don't insert ✓
```

---

## 🔐 Security Checklist

- [ ] All RLS policies enabled on sensitive tables (leads, appointments, transcripts, etc.)
- [ ] agent_settings has RLS policy (authenticate users can only read own org)
- [ ] organization_subscriptions has RLS policy (authenticated users can only read own org)
- [ ] contact_submissions has RLS disabled (service_role insert only)
- [ ] Stripe webhook secret stored securely (not in code, env var only)
- [ ] Service role key never exposed to browser/client
- [ ] Platform admin flag only set manually by operations team
- [ ] Public embeds use random public_slug (not guessable)
- [ ] Rate limiting on public embed RPCs (if volume expected)
- [ ] CORS headers properly set on Edge Functions

---

## 📊 Monitoring & Operations

### Check Monthly Usage Reset
```sql
-- In Supabase SQL Editor:
-- Verify billing_reset_at is set for all orgs
SELECT id, name, billing_reset_at, monthly_voice_minutes_limit, monthly_voice_minutes_used
FROM public.organizations
ORDER BY billing_reset_at DESC;
```

### View Stripe Webhook Events
```sql
-- See all Stripe events processed:
SELECT stripe_event_id, event_type, organization_id, created_at
FROM public.billing_events
ORDER BY created_at DESC
LIMIT 50;
```

### Check Lead Capture Rate
```sql
-- Count leads captured per day:
SELECT DATE(created_at), COUNT(*) as leads
FROM public.leads
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;
```

### Voice Usage Analysis
```sql
-- See top 10 orgs by usage:
SELECT org.name, org.monthly_voice_minutes_used, org.monthly_voice_minutes_limit,
  ROUND(100.0 * org.monthly_voice_minutes_used / NULLIF(org.monthly_voice_minutes_limit, 0), 1) as usage_pct
FROM public.organizations org
WHERE org.subscription_status IN ('active', 'past_due')
ORDER BY org.monthly_voice_minutes_used DESC
LIMIT 10;
```

---

## 🐛 Troubleshooting

### Issue: "Invalid slug" when using public embed
**Cause:** `resolve_org_by_public_slug` RPC missing  
**Fix:** Ensure migration `20260616120100_missing_rpcs_rls_indexes.sql` is applied

### Issue: Authenticated users can read other orgs' data
**Cause:** Missing RLS policies on `agent_settings` or `organization_subscriptions`  
**Fix:** Ensure migration `20260616120100_missing_rpcs_rls_indexes.sql` is applied

### Issue: "Organization not found" when starting voice agent
**Cause:** User not a member of any org OR ensure_my_organization() failed  
**Fix:** Check organization_members table; run ensure_my_organization() RPC manually

### Issue: Stripe webhook not updating org subscription
**Cause:** Webhook secret mismatch OR service_role key misconfigured  
**Fix:**
1. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
2. Verify `SUPABASE_SERVICE_ROLE_KEY` on function environment
3. Check billing_events table for errors (payload.error field)

### Issue: Voice quota blocking works, but not resetting monthly
**Cause:** pg_cron not set up OR monthly_voice_minutes_limit not set  
**Fix:**
1. Run reset-monthly-usage Edge Function manually (POST with service role bearer token)
2. Ensure all orgs have billing_reset_at set (set manually in SQL if needed)
3. Set up pg_cron schedule (see Step 4 above)

### Issue: Knowledge base upload fails
**Cause:** Storage bucket kb-files not created OR RLS policy issue  
**Fix:**
1. Check kb-files bucket exists in Storage
2. Verify user is in organization_members for that org
3. Check that RLS policies exist on storage.objects for kb-files

### Issue: Admin can't see users directory
**Cause:** User not marked as is_platform_admin OR RPC check failed  
**Fix:**
1. In Supabase SQL Editor, run: `UPDATE public.profiles SET is_platform_admin = true WHERE email = 'admin@example.com'`
2. Logout/login to refresh auth token
3. Verify is_platform_admin() RPC returns true

---

## 📚 API Reference

### Public RPCs (Anon + Authenticated)
```sql
-- Lead capture from public embed
capture_public_lead(p_slug, p_name, p_email, p_interest?, p_conversation_id?, p_phone?)
  Returns: lead UUID

-- Appointment scheduling from public embed
schedule_public_appointment(p_slug, p_name, p_email, p_date, p_notes?, p_phone?)
  Returns: appointment UUID

-- Save transcript from voice call
save_public_transcript(p_slug, p_messages jsonb, p_duration_seconds?)
  Returns: transcript UUID

-- Log voice usage (public embed)
log_public_voice_usage(p_slug, p_transcript_id, p_duration_seconds)
  Returns: void
```

### Authenticated RPCs
```sql
-- Log voice usage (authenticated org)
log_voice_usage(p_organization_id, p_transcript_id, p_duration_seconds)
  Returns: void

-- Get/create user's organization
ensure_my_organization()
  Returns: organization UUID

-- Check if current user is platform admin
is_platform_admin()
  Returns: boolean
```

### Admin RPCs (Security Definer, Admin Only)
```sql
-- Get directory of all users with org info
admin_get_users_directory()
  Returns: jsonb[] (array of user records with org/usage data)

-- Get detailed info on one user
admin_get_user_detail(p_user_id uuid)
  Returns: jsonb { profile, memberships[] }
```

### Service Role RPCs
```sql
-- Reset monthly usage for orgs past billing_reset_at
reset_monthly_usage()
  Returns: integer (count of orgs reset)
```

### Edge Functions
```
POST /functions/v1/gemini-live-token
  Headers: Authorization: Bearer {jwt}
  Body: { public_slug? }  (optional for public embeds)
  Returns: { token, model, voice? }

POST /functions/v1/gemini-generate
  Headers: Authorization: Bearer {jwt}
  Body: { action, mimeType?, data? }
  Returns: { text?, profileJson?, error? }

POST /functions/v1/stripe-checkout
  Headers: Authorization: Bearer {jwt}
  Body: { mode: 'subscription' | 'portal' }
  Returns: { url }

POST /functions/v1/contact-form
  Headers: apikey: {anon_key}
  Body: { name, email, message, website?, company? }
  Returns: { ok, error? }

POST /functions/v1/reset-monthly-usage
  Headers: Authorization: Bearer {service_role_key}
  Returns: { ok, orgs_reset }
```

---

## 📞 Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review Supabase logs: Project → Logs
3. Check Edge Function logs: Functions → {function_name} → Logs
4. Review RLS policies: Auth → Policies

---

**Last Updated:** 2026-06-16  
**Backend Status:** Production Ready (with above deployment steps)
