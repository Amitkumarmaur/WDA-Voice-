import { BarChart3, BookOpen, Mic2, Radio } from 'lucide-react';
import { ButtonPrimaryLink, ButtonSecondaryLink } from '../components/Buttons';
import { MockupVoiceAgent, MockupDashboardInline } from '../components/MockupVoiceAgent';

const pillars = [
  {
    icon: BookOpen,
    title: 'Ground every answer in your content',
    text: 'Upload the PDFs, policies, and FAQs you already maintain. The agent searches your org store—if it is not in your knowledge, it will not invent it for a caller.',
  },
  {
    icon: Radio,
    title: 'Conversational audio, not a script tree',
    text: 'Low-latency live voice means callers can interrupt, clarify, and switch topics. You get a transcript, not a keypad maze.',
  },
  {
    icon: Mic2,
    title: 'Hindi, English, or the mix in between',
    text: 'Pick a persona and default language, then let callers code-switch. Ideal for parent lines, support desks, and regional sales.',
  },
  {
    icon: BarChart3,
    title: 'Revenue and ops in one place',
    text: 'The workspace ties conversations to leads, holds billing state, and exposes embed links—so the phone channel is as measurable as your site.',
  },
] as const;

export function ProductPage() {
  return (
    <div>
      <section className="hero-ambient border-b border-hairline-soft px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <p className="type-eyebrow text-ink">Product</p>
          <h1 className="type-display-lg text-ink mt-2 text-balance">A voice layer you can govern like software</h1>
          <p className="type-body-lg text-ink-muted mt-4 max-w-2xl text-pretty">
            Voicera pairs your documents with Gemini Live: callers hear a natural voice, and your team gets structured
            outcomes in the org workspace. No “black box” answers—if it is not in your content, the agent is trained to
            deflect, capture, and escalate.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            <ButtonPrimaryLink to="/app">Open workspace</ButtonPrimaryLink>
            <ButtonSecondaryLink to="/pricing">View pricing</ButtonSecondaryLink>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <h2 className="type-display-md text-balance">What callers see</h2>
            <p className="type-body text-ink-muted mt-3 text-pretty">
              A clean live session: connection state, an optional technical readout (for your team to demo RAG in a
              sales call), the dialogue, and a single mic control. Marketing stays minimal so the “product” reads as the
              hero in the frame.
            </p>
          </div>
          <div className="flex justify-center">
            <MockupVoiceAgent />
          </div>
        </div>
      </section>

      <section className="border-t border-hairline-soft bg-canvas px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <h2 className="type-display-md text-balance">What you see in the org</h2>
          <p className="type-body text-ink-muted mt-2 max-w-2xl text-pretty">
            A compact dashboard: conversation counts, new leads, bookings, and subscription health—so a founder can
            read health at a glance without an analyst.
          </p>
          <div className="mt-8">
            <MockupDashboardInline />
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <h2 className="type-headline">Design pillars we optimize for</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {pillars.map((p) => (
              <li key={p.title} className="card-interactive rounded-lg p-5">
                <p.icon className="h-5 w-5 text-ink" strokeWidth={1.5} />
                <h3 className="type-body font-medium text-ink mt-2">{p.title}</h3>
                <p className="type-body-sm text-ink-muted mt-1.5 text-pretty">{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
