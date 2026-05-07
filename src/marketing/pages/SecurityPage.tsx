import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ButtonPrimaryLink } from '../components/Buttons';

const rows = [
  { title: 'Tenant isolation', text: 'Organizations are isolated at the data layer. Public embeds resolve through scoped RPCs.' },
  { title: 'Auth', text: 'Workspaces use Supabase auth with org membership checks on sensitive routes.' },
  { title: 'Audio', text: 'Voice sessions connect over encrypted transports from the client to your model provider (Gemini). We do not store full audio in marketing flows.' },
  { title: 'Payments', text: 'Billing runs through Stripe checkout and webhooks, scoped to the signed-in org.' },
] as const;

export function SecurityPage() {
  return (
    <div className="px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="type-eyebrow">Security</p>
        <h1 className="type-display-md text-ink mt-1">Trust, without theater</h1>
        <p className="type-body text-ink-muted mt-3 text-pretty">
          A straightforward outline of how this codebase approaches isolation and hand-offs. Hardening is an
          ongoing process — if you have a custom DPA, reach out.
        </p>
        <ul className="mt-8 space-y-4 type-body">
          {rows.map((r) => (
            <li key={r.title} className="flex gap-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
              <div>
                <p className="type-body font-medium text-ink">{r.title}</p>
                <p className="type-body text-ink-muted mt-0.5 text-pretty">{r.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="type-body text-ink-muted mt-10 text-pretty">
          For legal terms, read our{' '}
          <Link to="/privacy" className="text-ink underline underline-offset-2">privacy</Link> and{' '}
          <Link to="/terms" className="text-ink underline underline-offset-2">terms</Link>.
        </p>
        <div className="mt-6">
          <ButtonPrimaryLink to="/contact" className="!min-h-11">
            Security question
          </ButtonPrimaryLink>
        </div>
      </div>
    </div>
  );
}
