import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Phone, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ButtonPrimaryLink } from '../components/Buttons';
import { cn } from '../../lib/utils';

const tiers = [
  {
    name: 'Starter',
    tagline: 'Perfect for getting started',
    monthly: 2999,
    annual: 2399,
    minutesLabel: '500 min / month',
    featured: false,
    badge: null,
    channel: 'Web widget',
    channelIcon: Globe,
    rows: [
      '500 voice minutes / month',
      'Embeddable web widget for any site',
      'Knowledge base (up to 20 docs)',
      'Lead capture & call transcripts',
      '3 AI voice personas',
      'Email support',
    ],
    cta: 'Get started',
    overage: '₹8 / extra minute',
  },
  {
    name: 'Growth',
    tagline: 'For businesses fielding daily calls',
    monthly: 7999,
    annual: 6399,
    minutesLabel: '2,000 min / month',
    featured: true,
    badge: 'Most popular',
    channel: 'Web + Phone',
    channelIcon: Phone,
    rows: [
      '2,000 voice minutes / month',
      'Web widget + Twilio phone agent',
      'Unlimited knowledge documents',
      'Lead capture, appointments & transcripts',
      'All 9 AI voice personas',
      'Hindi & English bilingual support',
      'Priority support',
    ],
    cta: 'Start Growth',
    overage: '₹6 / extra minute',
  },
  {
    name: 'Scale',
    tagline: 'For agencies & high-volume teams',
    monthly: 24999,
    annual: 19999,
    minutesLabel: '5,000 min / month',
    featured: false,
    badge: null,
    channel: 'Web + Phone',
    channelIcon: Phone,
    rows: [
      '5,000 voice minutes / month',
      'Everything in Growth',
      'Custom voice cloning',
      'Multi-client / white-label embed',
      'Dedicated onboarding call',
      'SLA support (< 4 hr response)',
    ],
    cta: 'Talk to us',
    overage: '₹5 / extra minute',
  },
] as const;

const faq = [
  {
    q: 'What counts as a voice minute?',
    a: 'One minute of active AI voice session — from the moment the call or widget session connects until it ends.',
  },
  {
    q: 'How do I embed the voice agent on my website?',
    a: 'Every plan includes an embeddable widget. After signing in, go to your workspace dashboard and copy either the iframe code or the floating-button JavaScript snippet. Paste it on any website — no server required.',
  },
  {
    q: 'Does the phone agent need a Twilio account?',
    a: 'Yes. Growth and Scale plans support inbound phone calls via Twilio. You bring your own Twilio account, and we provide the webhook URL. Twilio call costs (~₹1–2/min) are billed directly by Twilio.',
  },
  {
    q: 'What happens when I exceed my monthly minutes?',
    a: 'We continue serving calls at the overage rate for your plan — no hard cutoffs. You will receive an email alert at 80% usage.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes. Every new workspace gets 120 free voice minutes to test the agent — no credit card required.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Monthly plans can be cancelled any time from your billing portal, effective end of billing period. Annual plans are non-refundable after 14 days.',
  },
] as const;

function FaqRow({ q, a, open, onClick }: { q: string; a: string; open: boolean; onClick: () => void }) {
  return (
    <div className="border-b border-hairline-soft">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full min-h-12 items-center justify-between gap-4 rounded-md py-4 text-left type-body transition-ui hover:bg-canvas/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
      >
        <span className="text-ink font-medium">{q}</span>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-muted" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted" />}
      </button>
      {open && <p className="type-body text-ink-muted pb-5 leading-relaxed">{a}</p>}
    </div>
  );
}

export function PricingPage() {
  const [tab, setTab] = useState<'monthly' | 'annual'>('monthly');
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  return (
    <div className="px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-[1280px]">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="type-eyebrow text-ink">Pricing</p>
          <h1 className="type-display-md text-ink mt-2 text-balance">
            Simple plans. Real voice AI. No surprises.
          </h1>
          <p className="type-body-lg text-ink-muted mt-3 text-pretty">
            Every plan includes your knowledge base, lead capture, and a web widget embed.
            Upgrade to Growth or Scale to also handle inbound phone calls.
          </p>
        </div>

        {/* Free minutes callout */}
        <div className="mt-6 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-1 px-4 py-2 type-body-sm text-ink">
            <Check className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
            New workspaces get <strong className="ml-1">120 free minutes</strong> — no card required
          </div>
        </div>

        {/* Toggle */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex min-h-11 rounded-pill border border-hairline bg-canvas p-0.5">
            <button
              type="button"
              onClick={() => setTab('monthly')}
              className={cn(
                'min-h-10 min-w-28 rounded-pill type-body-sm transition-ui px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
                tab === 'monthly' ? 'bg-surface-1 text-ink' : 'text-ink-muted hover:text-ink'
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setTab('annual')}
              className={cn(
                'min-h-10 rounded-pill type-body-sm transition-ui px-5 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
                tab === 'annual' ? 'bg-surface-1 text-ink' : 'text-ink-muted hover:text-ink'
              )}
            >
              Annual
              <span className="rounded-xs bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 leading-none">
                −20%
              </span>
            </button>
          </div>
        </div>

        {/* Plans grid */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((t) => {
            const price = tab === 'monthly' ? t.monthly : t.annual;
            const ChannelIcon = t.channelIcon;
            return (
              <div
                key={t.name}
                className={cn(
                  'flex flex-col rounded-xl border p-6',
                  t.featured
                    ? 'border-ink bg-ink text-on-primary shadow-xl scale-[1.02]'
                    : 'border-hairline bg-surface-1 text-ink'
                )}
              >
                {t.badge && (
                  <span className="mb-3 w-fit rounded-full bg-white/15 px-3 py-0.5 type-caption font-semibold text-on-primary">
                    {t.badge}
                  </span>
                )}

                <p className={cn('type-eyebrow', t.featured ? 'text-on-primary/80' : 'text-ink')}>{t.name}</p>
                <p className={cn('type-caption mt-0.5', t.featured ? 'text-on-primary/65' : 'text-ink-muted')}>
                  {t.tagline}
                </p>

                {/* Channel tag */}
                <div className={cn(
                  'mt-3 inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 type-caption font-medium',
                  t.featured ? 'bg-white/10 text-on-primary' : 'bg-surface-2 text-ink-muted border border-hairline'
                )}>
                  <ChannelIcon size={11} />
                  {t.channel}
                </div>

                {/* Price */}
                <div className="mt-5">
                  <p className={cn(t.featured ? 'text-on-primary' : 'text-ink')}>
                    <span className="text-[2.25rem] font-bold leading-none tracking-tight">
                      ₹{price.toLocaleString('en-IN')}
                    </span>
                    <span className={cn('type-body-sm font-normal ml-1', t.featured ? 'text-on-primary/70' : 'text-ink-muted')}>
                      / mo
                    </span>
                  </p>
                  <p className={cn('type-caption mt-1', t.featured ? 'text-on-primary/60' : 'text-ink-tertiary')}>
                    {tab === 'annual' ? 'Billed annually' : 'Billed monthly'} · {t.minutesLabel}
                  </p>
                  <p className={cn('type-caption', t.featured ? 'text-on-primary/50' : 'text-ink-tertiary')}>
                    Overage: {t.overage}
                  </p>
                </div>

                {/* Features */}
                <ul className={cn('my-6 space-y-2.5 flex-1', t.featured ? 'text-on-primary' : 'text-ink')}>
                  {t.rows.map((r) => (
                    <li key={r} className="flex gap-2 type-body-sm">
                      <Check className="h-4 w-4 shrink-0 mt-0.5 opacity-75" strokeWidth={2.5} />
                      {r}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  {t.name === 'Scale' ? (
                    <Link
                      to="/contact"
                      className={cn(
                        'flex w-full items-center justify-center rounded-lg border px-4 py-2.5 type-body-sm font-medium transition-colors',
                        'border-hairline bg-surface-1 text-ink hover:bg-surface-2'
                      )}
                    >
                      {t.cta}
                    </Link>
                  ) : t.featured ? (
                    <ButtonPrimaryLink
                      to="/app"
                      className="w-full justify-center border border-on-primary/30 !bg-surface-1 !text-ink hover:!bg-white/95"
                    >
                      {t.cta}
                    </ButtonPrimaryLink>
                  ) : (
                    <ButtonPrimaryLink to="/app" className="w-full justify-center">
                      {t.cta}
                    </ButtonPrimaryLink>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-5 text-center type-caption text-ink-tertiary">
          All prices in Indian Rupees (INR) incl. GST · Twilio call costs billed separately by Twilio
        </p>

        {/* FAQ */}
        <div className="mt-20">
          <h2 className="type-headline text-ink">Frequently asked questions</h2>
          <div className="mt-4 max-w-2xl">
            {faq.map((f, i) => (
              <FaqRow
                key={f.q}
                q={f.q}
                a={f.a}
                open={faqOpen === i}
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
              />
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 rounded-xl border border-hairline bg-surface-1 px-8 py-10 text-center">
          <h2 className="type-headline text-ink text-balance">
            Need a custom plan for your agency or enterprise?
          </h2>
          <p className="type-body text-ink-muted mt-2 max-w-xl mx-auto">
            We offer white-label embeds, bulk minute packs, and dedicated support for agencies
            reselling Voicera to their clients.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <ButtonPrimaryLink to="/contact" className="justify-center">
              Talk to sales
            </ButtonPrimaryLink>
            <Link
              to="/app"
              className="inline-flex items-center justify-center rounded-lg border border-hairline bg-canvas px-5 py-2.5 type-body-sm font-medium text-ink hover:bg-surface-1 transition-colors"
            >
              Start free (120 min)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
