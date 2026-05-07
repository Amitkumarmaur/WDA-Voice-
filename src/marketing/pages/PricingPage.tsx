import { useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ButtonPrimaryLink } from '../components/Buttons';
import { cn } from '../../lib/utils';

const tiers = [
  {
    name: 'Build',
    desc: 'Try the product with a single org.',
    monthly: 29,
    annual: 24,
    featured: false,
    rows: ['One voice profile', '10 knowledge documents', 'Email support'],
  },
  {
    name: 'Run',
    desc: 'For teams on the phone every day.',
    monthly: 99,
    annual: 79,
    featured: true,
    rows: ['Unlimited minutes (fair use)', 'Embeddable public agent', 'Leads + transcripts', 'Priority support'],
  },
  {
    name: 'Scale',
    desc: 'SSO, audit, and success reviews.',
    monthly: 249,
    annual: 199,
    featured: false,
    rows: ['Everything in Run', 'SSO (coming soon)', 'Data processing terms', 'Dedicated CSM on annual'],
  },
] as const;

const faq = [
  { q: 'Is Voice AI a separate add-on?', a: 'The Voice AI (Gemini Live) feature is included on Run and Scale. Build includes limited trial minutes.' },
  { q: 'Can I use my own documents?', a: 'Yes. Upload PDFs and notes; we chunk and index them for retrieval during calls.' },
  { q: 'What about embedding on my site?', a: 'Run includes a public embed at /embed/{slug} with the same knowledge and voice profile.' },
] as const;

function FaqRow({ q, a, open, onClick }: { q: string; a: string; open: boolean; onClick: () => void }) {
  return (
    <div className="border-b border-hairline-soft">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full min-h-12 items-center justify-between gap-4 rounded-md py-4 text-left type-body transition-ui hover:bg-canvas/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
      >
        {q}
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {open && <p className="type-body text-ink-muted pb-4 pl-0">{a}</p>}
    </div>
  );
}

export function PricingPage() {
  const [tab, setTab] = useState<'monthly' | 'annual'>('monthly');
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  return (
    <div className="px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <p className="type-eyebrow text-ink">Pricing</p>
        <h1 className="type-display-md text-ink mt-1 text-balance">Plans that scale with call volume</h1>
        <p className="type-body-lg text-ink-muted mt-3 max-w-2xl text-pretty">
          Start small, move to daily voice when you are ready. Numbers are illustrative—wire Stripe in your workspace
          for live checkout.
        </p>

        <div className="mt-8 inline-flex min-h-11 rounded-pill border border-hairline bg-canvas p-0.5">
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
              'min-h-10 min-w-28 rounded-pill type-body-sm transition-ui px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
              tab === 'annual' ? 'bg-surface-1 text-ink' : 'text-ink-muted hover:text-ink'
            )}
          >
            Annual
          </button>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((t) => {
            const price = tab === 'monthly' ? t.monthly : t.annual;
            return (
              <div
                key={t.name}
                className={cn(
                  'flex flex-col rounded-lg border p-6 type-body',
                  t.featured
                    ? 'border-ink bg-ink text-on-primary'
                    : 'border-hairline bg-surface-1 text-ink'
                )}
              >
                <p className={t.featured ? 'type-eyebrow text-on-primary/90' : 'type-eyebrow text-ink'}>{t.name}</p>
                {t.name === 'Run' && (
                  <span
                    className="mt-2 w-fit rounded-xs type-caption"
                    style={{ color: t.featured ? '#ffb899' : undefined, background: t.featured ? 'transparent' : undefined }}
                  >
                    {t.featured ? (
                      <span className="text-fin-orange">Voice AI included</span>
                    ) : (
                      <span className="rounded-xs bg-canvas px-1.5 py-0.5 text-fin-orange">Voice AI</span>
                    )}
                  </span>
                )}
                <p
                  className={cn(
                    'type-body text-pretty',
                    t.featured ? 'mt-1 text-on-primary/80' : 'mt-1 text-ink-muted'
                  )}
                >
                  {t.desc}
                </p>
                <p
                  className={cn('mt-4', t.featured ? 'text-on-primary' : 'text-ink')}
                >
                  <span className="text-[2rem] font-medium leading-none tracking-[-0.5px] sm:text-[2.5rem]">
                    ${price}
                  </span>
                  <span className="type-body-sm font-normal"> / mo</span>
                </p>
                <p className={t.featured ? 'type-caption text-on-primary/70' : 'type-caption text-ink-tertiary'}>
                  {tab === 'annual' ? 'Billed annually' : 'Billed monthly'}
                </p>
                <ul
                  className={cn(
                    'mb-5 mt-5 space-y-2.5',
                    t.featured ? 'text-on-primary' : 'text-ink'
                  )}
                >
                  {t.rows.map((r) => (
                    <li key={r} className="flex gap-2 type-body-sm">
                      <Check className="h-4 w-4 shrink-0 opacity-80" />
                      {r}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  {t.featured ? (
                    <ButtonPrimaryLink
                      to="/app"
                      className="w-full justify-center border border-on-primary/30 !bg-surface-1 !text-ink hover:!bg-white/95"
                    >
                      Start with Run
                    </ButtonPrimaryLink>
                  ) : (
                    <ButtonPrimaryLink to="/app" className="w-full justify-center">
                      Select {t.name}
                    </ButtonPrimaryLink>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-center type-caption text-ink-tertiary">Prices are illustrative; connect Stripe in workspace when live.</div>

        <h2 className="type-headline mt-20">FAQ</h2>
        <div className="mt-2 max-w-2xl">
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

        <p className="type-body text-ink-muted mt-12 text-center">
          Custom contracts? <Link to="/contact" className="text-ink underline underline-offset-2">Contact sales</Link>
        </p>
      </div>
    </div>
  );
}
