import React, { useState } from 'react';
import { CreditCard, Loader2, ExternalLink } from 'lucide-react';
import { BillingService } from '../../services/billingService';

type Props = {
  subscriptionStatus: string;
  publicSlug: string;
};

export default function BillingCard({ subscriptionStatus, publicSlug }: Props) {
  const [busy, setBusy] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const embedUrl = `${origin}/embed/${publicSlug}`;

  const checkout = async () => {
    setBusy(true);
    try {
      const url = await BillingService.createCheckoutSession();
      window.location.href = url;
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Checkout unavailable. Set Stripe env on Edge Functions.');
    } finally {
      setBusy(false);
    }
  };

  const portal = async () => {
    setBusy(true);
    try {
      const url = await BillingService.createPortalSession();
      window.location.href = url;
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Billing portal unavailable.');
    } finally {
      setBusy(false);
    }
  };

  const copyEmbed = () => {
    void navigator.clipboard.writeText(embedUrl);
    alert('Embed link copied to clipboard.');
  };

  return (
    <div className="p-8 bg-white rounded-3xl border border-slate-200/60 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <CreditCard className="text-indigo-600" size={22} />
        <div>
          <h3 className="text-xl font-display font-bold text-slate-900">Billing & share</h3>
          <p className="text-sm text-slate-500">
            Plan: <span className="font-semibold text-slate-800">{subscriptionStatus}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void checkout()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : null}
          Subscribe
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void portal()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <ExternalLink size={16} />
          Manage billing
        </button>
        <button
          type="button"
          onClick={copyEmbed}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
        >
          Copy public embed link
        </button>
      </div>
      <p className="text-xs text-slate-400 break-all">{embedUrl}</p>
    </div>
  );
}
