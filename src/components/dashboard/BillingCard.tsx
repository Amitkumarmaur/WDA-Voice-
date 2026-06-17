import React, { useState } from 'react';
import { CreditCard, Loader2, ExternalLink } from 'lucide-react';
import { BillingService } from '../../services/billingService';

type Props = {
  subscriptionStatus: string;
  publicSlug: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  free:     { label: 'Free (120 min trial)', color: 'text-ink-muted' },
  active:   { label: 'Active',               color: 'text-emerald-600' },
  past_due: { label: 'Past due',             color: 'text-amber-600' },
  canceled: { label: 'Cancelled',            color: 'text-semantic-error' },
};

export default function BillingCard({ subscriptionStatus }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusMeta = STATUS_LABELS[subscriptionStatus] ?? { label: subscriptionStatus, color: 'text-ink-muted' };

  const checkout = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = await BillingService.createCheckoutSession();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout unavailable. Configure STRIPE_SECRET_KEY and STRIPE_PRICE_ID in Supabase Edge Function secrets.');
    } finally {
      setBusy(false);
    }
  };

  const portal = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = await BillingService.createPortalSession();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Billing portal unavailable.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-surface-1 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-hairline">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-canvas">
          <CreditCard size={18} className="text-ink" strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="type-body font-semibold text-ink">Billing</h3>
          <p className="type-caption text-ink-muted">
            Plan: <span className={`font-medium ${statusMeta.color}`}>{statusMeta.label}</span>
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        <div className="flex flex-wrap gap-3">
          {subscriptionStatus !== 'active' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void checkout()}
              className="inline-flex items-center gap-2 rounded-md border border-hairline bg-ink px-4 py-2 type-body-sm font-medium text-on-primary hover:bg-ink/90 disabled:opacity-50 transition-colors"
            >
              {busy ? <Loader2 className="animate-spin" size={15} /> : null}
              Upgrade plan
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void portal()}
            className="inline-flex items-center gap-2 rounded-md border border-hairline bg-surface-2 px-4 py-2 type-body-sm font-medium text-ink hover:bg-surface-1 disabled:opacity-50 transition-colors"
          >
            <ExternalLink size={14} />
            Manage billing
          </button>
        </div>

        {error && (
          <p className="type-caption text-semantic-error rounded-md border border-semantic-error/20 bg-semantic-error/5 px-3 py-2">
            {error}
          </p>
        )}

        <p className="type-caption text-ink-tertiary">
          Powered by Stripe · Cancel anytime from billing portal · Prices in INR incl. GST
        </p>
      </div>
    </div>
  );
}
