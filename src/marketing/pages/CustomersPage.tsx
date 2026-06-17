import { Star } from 'lucide-react';
import { ButtonPrimaryLink } from '../components/Buttons';

const stories = [
  {
    quote:
      'First-line support used to drown in repeat questions. Now the agent deflects timetables and policy—and only hands us calls that need a human.',
    name: 'Asha Mehta',
    title: 'CX Lead · Lumen Health',
  },
  {
    quote:
      'Parents do not want a form—they want a voice. Hindi-English switching “just working” is what made us go live.',
    name: 'Daniel Ko',
    title: 'IT Director · Harbor School Group',
  },
] as const;

const logos = ['Apex', 'Nimbus', 'Cedar', 'Lumen', 'Ridge', 'Nautical'];

export function CustomersPage() {
  return (
    <div className="px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <p className="type-eyebrow">Customers</p>
        <h1 className="type-display-md text-ink mt-1 text-balance">Where Voicera runs today</h1>
        <p className="type-body-lg text-ink-muted mt-3 max-w-2xl text-pretty">
          Coaching, health, B2B support, and admissions: teams that need trust on the line—not a novelty chat
          experience.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          {logos.map((l) => (
            <div
              key={l}
              className="card-interactive rounded-md px-3 py-1.5 type-caption text-ink-muted"
            >
              {l}
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {stories.map((s) => (
            <div
              key={s.name}
              className="card-interactive type-body rounded-xl p-6 sm:p-8"
            >
              <div className="mb-3 flex gap-0.5" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="type-body-lg text-pretty text-ink">{s.quote}</p>
              <p className="type-body-sm text-ink mt-4 font-medium">{s.name}</p>
              <p className="type-caption text-ink-subtle">{s.title}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <ButtonPrimaryLink to="/contact" className="!min-h-11">
            Talk to us
          </ButtonPrimaryLink>
        </div>
      </div>
    </div>
  );
}
