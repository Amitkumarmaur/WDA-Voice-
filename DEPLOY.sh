#!/bin/bash
# Complete deployment script for Voicera Supabase backend
# Run this after: supabase login

set -e

echo "🚀 Voicera Supabase Deployment Script"
echo "======================================"
echo ""

cd "$(dirname "$0")" || exit 1

# Step 1: Link to remote project
echo "1️⃣  Linking to Supabase project..."
supabase link --project-ref wda-voice || true
echo "✅ Linked to project"
echo ""

# Step 2: Push migrations to remote
echo "2️⃣  Pushing database migrations to remote..."
echo ""
supabase db push --linked --include-all
echo ""
echo "✅ Migrations pushed successfully"
echo ""

# Step 3: Deploy Edge Functions
echo "3️⃣  Deploying Edge Functions..."
echo ""
supabase functions deploy gemini-live-token
supabase functions deploy gemini-generate
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
supabase functions deploy contact-form
supabase functions deploy reset-monthly-usage
echo ""
echo "✅ All Edge Functions deployed"
echo ""

# Step 4: Summary
echo "======================================"
echo "✅ DEPLOYMENT COMPLETE"
echo "======================================"
echo ""
echo "🎉 Next steps:"
echo "1. Set environment variables in Supabase Project Settings → Edge Functions → Secrets:"
echo "   - GEMINI_API_KEY"
echo "   - STRIPE_SECRET_KEY"
echo "   - STRIPE_PRICE_ID"
echo "   - STRIPE_WEBHOOK_SECRET"
echo "   - SITE_URL"
echo ""
echo "2. Register Stripe webhook in Stripe Dashboard:"
echo "   - URL: https://{project}.supabase.co/functions/v1/stripe-webhook"
echo "   - Events: checkout.session.completed, customer.subscription.updated/deleted, invoice.payment_failed"
echo ""
echo "3. Run verification tests (see BACKEND_IMPLEMENTATION_GUIDE.md)"
echo ""
echo "4. Go live! 🚀"
