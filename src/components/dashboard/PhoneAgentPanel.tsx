import React, { useState, useEffect } from 'react';
import { Phone, Copy, Check, ExternalLink, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getSupabase } from '../../lib/supabase';

interface Props {
  organizationId: string;
  publicSlug: string;
}

const SUPABASE_PROJECT_REF =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)
    ?.replace('https://', '')
    .replace('.supabase.co', '') ?? '<your-project-ref>';

export default function PhoneAgentPanel({ organizationId, publicSlug }: Props) {
  const webhookUrl = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/twilio-voice?slug=${publicSlug}`;

  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [savedPhone, setSavedPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    const supabase = getSupabase();
    supabase
      .from('organizations')
      .select('twilio_phone_number')
      .eq('id', organizationId)
      .single()
      .then(({ data }) => {
        const p = data?.twilio_phone_number ?? '';
        setSavedPhone(p);
        setPhoneNumber(p);
      });
  }, [organizationId]);

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const savePhone = async () => {
    setSaving(true);
    setSaveMsg('');
    const supabase = getSupabase();
    const { error } = await supabase
      .from('organizations')
      .update({ twilio_phone_number: phoneNumber.trim() || null })
      .eq('id', organizationId);
    setSaving(false);
    if (error) {
      setSaveMsg('Save failed: ' + error.message);
    } else {
      setSavedPhone(phoneNumber.trim());
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2500);
    }
  };

  const steps = [
    {
      num: 1,
      title: 'Get a Twilio phone number',
      body: 'Sign up at twilio.com → go to Phone Numbers → Buy a Number. Choose an Indian (+91) or international number.',
    },
    {
      num: 2,
      title: 'Copy your Voicera webhook URL',
      body: 'Use the URL shown above. This is your unique endpoint — it includes your organization slug.',
    },
    {
      num: 3,
      title: 'Set the webhook in Twilio',
      body: 'In Twilio Console → Phone Numbers → your number → Voice & Fax → "A call comes in" → Webhook → paste the URL. Set HTTP to POST.',
    },
    {
      num: 4,
      title: 'Add your GEMINI_API_KEY to Supabase',
      body: 'In Supabase Dashboard → Edge Functions → Secrets → add GEMINI_API_KEY with your Google AI Studio key.',
    },
    {
      num: 5,
      title: 'Test it',
      body: 'Call your Twilio number. Your AI agent will answer using your knowledge base and agent settings.',
    },
  ];

  return (
    <div className="rounded-xl border border-hairline bg-surface-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-hairline">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-canvas">
          <Phone size={18} className="text-ink" strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="type-body font-semibold text-ink">Phone Agent</h3>
          <p className="type-caption text-ink-muted">Let AI answer real phone calls via Twilio</p>
        </div>
        {savedPhone && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 type-caption font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {savedPhone}
          </span>
        )}
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Webhook URL */}
        <div className="space-y-2">
          <label className="type-caption font-medium text-ink-muted uppercase tracking-wide">
            Your Twilio Webhook URL
          </label>
          <div className="flex items-center gap-2 rounded-md border border-hairline bg-canvas px-3 py-2.5">
            <code className="type-mono text-xs text-ink min-w-0 flex-1 truncate">{webhookUrl}</code>
            <button
              type="button"
              onClick={copyWebhook}
              className={cn(
                'shrink-0 flex items-center gap-1.5 rounded px-2.5 py-1.5 type-caption font-medium transition-colors',
                copied
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-surface-2 text-ink-muted hover:text-ink border border-hairline'
              )}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="type-caption text-ink-muted">
            Paste this URL in Twilio under your phone number's Voice webhook (POST).
          </p>
        </div>

        {/* Assigned phone number */}
        <div className="space-y-2">
          <label className="type-caption font-medium text-ink-muted uppercase tracking-wide">
            Your Twilio Phone Number (optional — for display)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+91 98765 43210"
              className="flex-1 rounded-md border border-hairline bg-canvas px-3 py-2 type-body-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
            <button
              type="button"
              onClick={savePhone}
              disabled={saving || phoneNumber === savedPhone}
              className="shrink-0 flex items-center gap-1.5 rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body-sm font-medium text-ink hover:bg-surface-1 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Save
            </button>
          </div>
          {saveMsg && (
            <p className={cn('type-caption', saveMsg.startsWith('Save failed') ? 'text-semantic-error' : 'text-emerald-600')}>
              {saveMsg}
            </p>
          )}
        </div>

        {/* Cost info */}
        <div className="rounded-md border border-hairline bg-surface-2 px-4 py-3 space-y-1">
          <p className="type-body-sm font-medium text-ink">Estimated cost per minute</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 type-caption text-ink-muted">
            <span>Gemini Live: ~₹0.77/min</span>
            <span>Twilio inbound: ~₹0.71/min</span>
            <span>Twilio stream: ~₹0.34/min</span>
            <span className="font-medium text-ink">Total: ~₹1.82/min</span>
          </div>
          <p className="type-caption text-ink-muted">Charge clients ₹12–15/minute for a healthy margin.</p>
        </div>

        {/* Setup guide toggle */}
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="flex w-full items-center justify-between rounded-md border border-hairline px-4 py-3 type-body-sm font-medium text-ink hover:bg-surface-2 transition-colors"
        >
          <span>Setup guide (5 steps)</span>
          {showGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showGuide && (
          <ol className="space-y-4">
            {steps.map((step) => (
              <li key={step.num} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas type-caption font-semibold text-ink">
                  {step.num}
                </span>
                <div>
                  <p className="type-body-sm font-medium text-ink">{step.title}</p>
                  <p className="type-caption text-ink-muted mt-0.5">{step.body}</p>
                </div>
              </li>
            ))}
            <li className="flex gap-3 mt-2">
              <a
                href="https://console.twilio.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 type-body-sm text-ink underline underline-offset-2 hover:text-ink-muted"
              >
                Open Twilio Console <ExternalLink size={13} />
              </a>
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}
