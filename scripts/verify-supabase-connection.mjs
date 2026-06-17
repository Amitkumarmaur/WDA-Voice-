/**
 * Validates local Vite env and probes Supabase REST + Edge Function routes.
 * Usage: node scripts/verify-supabase-connection.mjs
 * Loads .env.local from repo root when present (does not print secret values).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function fail(msg) {
  console.error('✗', msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log('✓', msg);
}

async function main() {
  const envLocal = loadEnvFile(path.join(root, '.env.local'));
  const url = (envLocal.VITE_SUPABASE_URL || '').trim();
  const anon = (envLocal.VITE_SUPABASE_ANON_KEY || '').trim();

  console.log('Supabase connection check\n');

  if (!url || !anon) {
    fail('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
    return;
  }
  if (url.includes('YOUR_PROJECT') || anon.includes('YOUR_ANON_KEY')) {
    fail('Replace placeholders in .env.local (see .env.example)');
    return;
  }
  ok('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set (non-placeholder)');

  console.log('\nSupabase Dashboard → Authentication (required for Google sign-in):');
  console.log('  Site URL: http://localhost:2000');
  console.log('  Redirect URLs: http://localhost:2000/app , http://localhost:2000/**');
  console.log('  Providers → Google: enabled with OAuth Client ID + Secret\n');

  const refMatch = url.match(/https:\/\/([^.]+)\.supabase\.co/i);
  const projectRef = refMatch ? refMatch[1] : '(derive from URL)';
  console.log('Stripe webhook URL (register in Stripe Dashboard):');
  console.log(`  https://${projectRef}.supabase.co/functions/v1/stripe-webhook`);
  console.log('  Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted\n');

  const restHeaders = {
    apikey: anon,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  if (anon.startsWith('eyJ')) {
    restHeaders.Authorization = `Bearer ${anon}`;
  }
  try {
    const r = await fetch(`${url}/rest/v1/rpc/resolve_org_by_public_slug`, {
      method: 'POST',
      headers: restHeaders,
      body: JSON.stringify({ p_slug: '__verify_connection_no_such_slug__' }),
    });
    if (!r.ok) {
      fail(`PostgREST RPC resolve_org_by_public_slug returned HTTP ${r.status}`);
    } else {
      ok('PostgREST reachable (RPC resolve_org_by_public_slug OK)');
    }
  } catch (e) {
    fail(`PostgREST fetch failed: ${e instanceof Error ? e.message : e}`);
    return;
  }

  const fnHeaders = {
    'Content-Type': 'application/json',
    apikey: anon,
  };
  if (anon.startsWith('eyJ')) {
    fnHeaders.Authorization = `Bearer ${anon}`;
  }

  try {
    const r = await fetch(`${url}/functions/v1/gemini-live-token`, {
      method: 'POST',
      headers: fnHeaders,
      body: JSON.stringify({ public_slug: '__no_such_embed_slug__' }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && String(j.error || '').includes('Invalid')) {
      ok('gemini-live-token reachable (invalid slug → 404 as expected)');
    } else if (r.status === 500 && String(j.error || '').includes('GEMINI')) {
      ok('gemini-live-token reachable (set GEMINI_API_KEY secret if voice tokens fail)');
    } else {
      console.log(`  gemini-live-token HTTP ${r.status}:`, j.error || j);
      ok('gemini-live-token responded (verify GEMINI_API_KEY if voice fails)');
    }
  } catch (e) {
    fail(`gemini-live-token fetch failed: ${e instanceof Error ? e.message : e}`);
  }

  try {
    const r = await fetch(`${url}/functions/v1/gemini-generate`, {
      method: 'POST',
      headers: fnHeaders,
      body: JSON.stringify({ action: 'analyze_kb', prompt: 'ping' }),
    });
    if (r.status === 401) {
      ok('gemini-generate reachable (401 without user session — expected)');
    } else {
      const j = await r.json().catch(() => ({}));
      console.log(`  gemini-generate HTTP ${r.status}:`, j.error || '');
      if (r.ok) ok('gemini-generate returned success (unexpected without auth)');
      else ok('gemini-generate responded');
    }
  } catch (e) {
    fail(`gemini-generate fetch failed: ${e instanceof Error ? e.message : e}`);
  }

  try {
    const r = await fetch(`${url}/functions/v1/stripe-checkout`, {
      method: 'POST',
      headers: fnHeaders,
      body: JSON.stringify({}),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) {
      ok('stripe-checkout reachable (401 without user session — expected)');
    } else if (r.status === 500 && String(j.error || '').includes('STRIPE_SECRET_KEY')) {
      ok('stripe-checkout deployed (set STRIPE_SECRET_KEY + STRIPE_PRICE_ID secrets for billing)');
    } else {
      console.log(`  stripe-checkout HTTP ${r.status}:`, j.error || '');
      ok('stripe-checkout responded');
    }
  } catch (e) {
    fail(`stripe-checkout fetch failed: ${e instanceof Error ? e.message : e}`);
  }

  console.log('\nDone. Edge secrets are configured in the Supabase Dashboard (not in .env.local).');
}

main();
