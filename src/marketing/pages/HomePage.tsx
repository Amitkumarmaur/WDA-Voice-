import { ArrowUpRight, Check, Globe2, Headphones, Lock, Mic, Sparkles, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { ButtonFinLink, ButtonPrimaryLink, ButtonSecondaryLink } from '../components/Buttons';
import { MockupVoiceAgent, MockupDashboardInline } from '../components/MockupVoiceAgent';

const trustLogos = [
  { name: 'Summit', note: 'Defence & training' },
  { name: 'Lumen Clinics', note: 'Patient calls' },
  { name: 'Harbor Ed', note: 'Admissions' },
  { name: 'Nimbus SaaS', note: 'B2B support' },
  { name: 'Cedar Legal', note: 'Intake' },
  { name: 'Apex Retail', note: 'Store inquiries' },
];

const stats = [
  { label: 'Time to first reply', value: '<2s', hint: 'typical live session' },
  { label: 'Coverage', value: '24/7', hint: 'no shift planning' },
  { label: 'Knowledge', value: 'Grounded', hint: 'only your documents' },
];

const bento = [
  {
    id: 'kb',
    icon: Sparkles,
    title: 'Answers that stay on-script',
    body: 'Upload PDFs, SOPs, and FAQs. Every reply is retrieved from your org knowledge base—no generic AI filler when facts matter.',
    wide: true,
  },
  {
    id: 'voice',
    icon: Mic,
    title: 'Natural voice, real turns',
    body: 'Gemini Live audio with low-latency back-and-forth. Hindi, English, or the mix your callers use.',
    wide: false,
  },
  {
    id: 'leads',
    icon: Headphones,
    title: 'Leads that land in one workspace',
    body: 'Transcripts, emails, and intent flow into a single org view—ready for your team, not lost in a phone log.',
    wide: false,
  },
  {
    id: 'embed',
    icon: Globe2,
    title: 'Embed on your site in minutes',
    body: 'A public /embed link with the same voice and knowledge as your internal agent. Consistent answers everywhere.',
    wide: true,
  },
] as const;

export function HomePage() {
  return (
    <>
      <section className="hero-ambient border-b border-hairline-soft px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="animate-marketing-enter min-w-0">
              <p className="type-eyebrow text-ink">AI voice for calls that cannot wait</p>
              <h1 className="type-display-xl text-ink mt-3 text-balance">
                Turn every ring into a qualified conversation.
              </h1>
              <p className="type-body-lg text-ink-muted mt-5 max-w-xl text-pretty">
                Voicera is a phone-first voice agent: it speaks with your tone, pulls answers from your documents, and
                hands off leads and bookings to the same workspace your team already uses.
              </p>
              <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1 type-body-sm text-ink-subtle">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-ink" strokeWidth={2.5} /> Live audio (Gemini)
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-ink" strokeWidth={2.5} /> RAG on your files
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-ink" strokeWidth={2.5} /> Embeds + workspace
                </li>
              </ul>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonPrimaryLink to="/app" className="!min-h-11 w-full justify-center sm:w-auto">
                  Start free in workspace
                </ButtonPrimaryLink>
                <ButtonSecondaryLink to="/product" className="w-full justify-center sm:w-auto">
                  How it works
                </ButtonSecondaryLink>
                <Link
                  to="/pricing"
                  className="type-body-sm text-ink-muted transition-ui hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas sm:pl-1"
                >
                  See pricing <ArrowUpRight className="ml-0.5 inline h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-lg transition-ui lg:max-w-none">
                <MockupVoiceAgent />
              </div>
            </div>
          </div>

          <div className="mt-14 grid gap-3 border-t border-hairline-soft pt-10 sm:grid-cols-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="card-interactive rounded-lg px-4 py-3 sm:py-4"
              >
                <p className="type-caption text-ink-subtle">{s.label}</p>
                <p className="type-headline text-ink mt-0.5">{s.value}</p>
                <p className="type-caption text-ink-tertiary mt-0.5">{s.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-[1280px] text-center">
          <p className="type-eyebrow text-ink">Social proof</p>
          <h2 className="type-display-md text-ink mt-1 text-balance">Built for teams where the phone still closes deals</h2>
          <p className="type-body text-ink-muted mx-auto mt-2 max-w-2xl text-pretty">
            From coaching institutes to clinics and B2B support—when callers need trust, not a chatbot wall.
          </p>
          <div className="mt-8 flex flex-wrap items-stretch justify-center gap-2 sm:gap-3">
            {trustLogos.map((l) => (
              <div
                key={l.name}
                className="card-interactive flex min-w-[140px] flex-col items-center rounded-lg px-4 py-3 text-center sm:min-w-[160px]"
              >
                <span className="type-body-sm font-medium text-ink">{l.name}</span>
                <span className="type-caption text-ink-tertiary mt-0.5">{l.note}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="order-2 lg:order-1">
            <MockupDashboardInline />
          </div>
          <div className="order-1 lg:order-2">
            <p className="type-eyebrow text-ink">One workspace</p>
            <h2 className="type-display-md text-ink mt-1 text-balance">Stop copying phone notes into spreadsheets.</h2>
            <p className="type-body text-ink-muted mt-4 text-pretty">
              Every call leaves a trail you can use: full transcript, captured contact details, and what the caller
              wanted next. Your metrics stay in one org—so sales and ops see the same numbers.
            </p>
            <ul className="mt-5 space-y-2.5 type-body text-ink">
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink" strokeWidth={2.2} />
                Leads and appointments in one pipeline
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink" strokeWidth={2.2} />
                Billing and embed health visible to admins
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline-soft bg-canvas px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="text-center">
            <h2 className="type-display-md text-ink text-balance">Why teams pick Voicera</h2>
            <p className="type-body text-ink-muted mx-auto mt-2 max-w-2xl text-pretty">
              Four building blocks: knowledge, real-time audio, handoffs, and embeds—laid out so a busy owner can
              scan in under a minute.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {bento.map((c) => (
              <div
                key={c.id}
                className={cn('card-interactive rounded-lg p-5 sm:p-6', c.wide ? 'lg:col-span-2' : 'lg:col-span-1')}
              >
                <c.icon className="h-6 w-6 text-ink" strokeWidth={1.5} />
                <h3 className="type-card-title mt-3 text-balance">{c.title}</h3>
                <p className="type-body text-ink-muted mt-1.5 text-pretty">{c.body}</p>
                {c.id === 'embed' && (
                  <p className="type-caption text-ink-tertiary mt-3">
                    <Lock className="mb-0.5 mr-1 inline h-3.5 w-3.5" />
                    Public embeds respect org boundaries; same policies as your internal agent.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-inverse-canvas px-4 py-16 text-inverse-ink sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-10 text-center sm:grid-cols-2 sm:gap-8 sm:text-left">
          <div>
            <div className="mb-3 flex justify-center gap-0.5 sm:justify-start" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-inverse-ink text-inverse-ink" />
              ))}
            </div>
            <blockquote className="type-body-lg font-medium text-pretty">
              “We stopped losing callers to voicemail. The agent resolves timetables and only escalates with context.”
            </blockquote>
            <p className="type-body-sm text-inverse-ink-muted mt-4">Director of ops · National training network</p>
          </div>
          <div>
            <div className="mb-3 flex justify-center gap-0.5 sm:justify-start" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-inverse-ink/90 text-inverse-ink" />
              ))}
            </div>
            <blockquote className="type-body-lg font-medium text-pretty">
              “Hindi-English code-switching was the blocker for us before. Now parents get one consistent experience.”
            </blockquote>
            <p className="type-body-sm text-inverse-ink-muted mt-4">Head of admissions · K-12 group</p>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="card-interactive flex flex-col gap-6 rounded-xl p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
            <div>
              <p className="type-eyebrow">Voice AI</p>
              <h3 className="type-headline text-balance">Go live with full-duplex voice when you are ready for real calls.</h3>
              <p className="type-body text-ink-muted mt-2 max-w-2xl text-pretty">
                The orange button starts the Gemini Live experience—fast audio, less robotic turn-taking, and a clear
                path from “try the agent” to “put it in front of customers.”
              </p>
            </div>
            <div className="shrink-0">
              <ButtonFinLink to="/app" className="w-full min-w-[200px] justify-center lg:w-auto">
                Open Voice AI
              </ButtonFinLink>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="card-interactive flex flex-col items-start justify-between gap-5 rounded-xl p-8 sm:flex-row sm:items-center sm:px-10 sm:py-10">
            <div>
              <h2 className="type-headline text-balance">Book a live walkthrough or start in the workspace</h2>
              <p className="type-body text-ink-muted mt-1 max-w-xl">We will help you load your first knowledge pack and set voice language.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[200px]">
              <ButtonPrimaryLink to="/app" className="w-full justify-center">
                Open workspace
              </ButtonPrimaryLink>
              <ButtonSecondaryLink to="/contact" className="w-full justify-center">
                Talk to sales
              </ButtonSecondaryLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
