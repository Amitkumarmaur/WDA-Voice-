import { useRef, useState } from 'react';
import { ButtonPrimary, ButtonSecondary } from '../components/Buttons';
import { submitContactForm } from '../../services/contactService';
import { isSupabaseEnvConfigured } from '../../lib/supabase';

export function ContactPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const [phase, setPhase] = useState<'form' | 'success'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const configured = isSupabaseEnvConfigured();

  return (
    <div className="px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <p className="type-eyebrow">Contact</p>
        <h1 className="type-display-md text-ink mt-1">Talk to the team</h1>
        <p className="type-body text-ink-muted mt-2 text-pretty">
          Sales, partnerships, and implementation questions. Messages are saved securely so we can reply by email.
        </p>

        {!configured ? (
          <p className="type-body-sm mt-6 rounded-md border border-hairline bg-surface-2/80 px-4 py-3 text-ink-muted">
            Contact submissions need Supabase in this environment. Add{' '}
            <code className="type-mono rounded bg-surface-1 px-1 py-0.5 text-ink">VITE_SUPABASE_URL</code> and{' '}
            <code className="type-mono rounded bg-surface-1 px-1 py-0.5 text-ink">VITE_SUPABASE_ANON_KEY</code> to{' '}
            <code className="type-mono rounded bg-surface-1 px-1 py-0.5 text-ink">.env.local</code>, deploy the{' '}
            <code className="type-mono rounded bg-surface-1 px-1 py-0.5 text-ink">contact-form</code> Edge Function, and run
            migrations.
          </p>
        ) : null}

        {phase === 'success' ? (
          <div className="mt-8 space-y-4">
            <p className="type-body rounded-md border border-hairline bg-surface-1 p-4 text-ink">
              Thanks — your message was sent. We will follow up at the email address you provided.
            </p>
            <button
              type="button"
              className="type-body-sm text-ink-muted underline underline-offset-2 transition-ui hover:text-ink rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              onClick={() => {
                setPhase('form');
                setErrorMsg(null);
              }}
            >
              Send another message
            </button>
          </div>
        ) : (
          <form
            ref={formRef}
            className="mt-8 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void (async () => {
                setErrorMsg(null);
                const form = e.currentTarget;
                const fd = new FormData(form);
                const name = String(fd.get('name') ?? '').trim();
                const email = String(fd.get('email') ?? '').trim();
                const message = String(fd.get('message') ?? '').trim();
                const website = String(fd.get('website') ?? '').trim();

                if (!configured) {
                  setErrorMsg('Supabase is not configured on this deployment.');
                  return;
                }

                setSubmitting(true);
                try {
                  await submitContactForm({ name, email, message, website });
                  setPhase('success');
                  form.reset();
                } catch (err) {
                  setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
                } finally {
                  setSubmitting(false);
                }
              })();
            }}
          >
            {/* Honeypot — leave hidden; bots often fill it */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
            />

            <label className="block type-body-sm">
              <span className="text-ink-muted">Name</span>
              <input
                required
                name="name"
                disabled={submitting || !configured}
                className="type-body mt-1 w-full min-h-11 rounded-md border border-hairline bg-surface-1 px-3.5 py-2.5 text-ink placeholder:text-ink-tertiary disabled:opacity-60"
                placeholder="Jules Chen"
                autoComplete="name"
                maxLength={200}
              />
            </label>
            <label className="block type-body-sm">
              <span className="text-ink-muted">Work email</span>
              <input
                required
                name="email"
                type="email"
                disabled={submitting || !configured}
                className="type-body mt-1 w-full min-h-11 rounded-md border border-hairline bg-surface-1 px-3.5 py-2.5 text-ink disabled:opacity-60"
                autoComplete="email"
                maxLength={320}
              />
            </label>
            <label className="block type-body-sm">
              <span className="text-ink-muted">Message</span>
              <textarea
                name="message"
                rows={5}
                required
                disabled={submitting || !configured}
                className="type-body mt-1 w-full rounded-md border border-hairline bg-surface-1 px-3.5 py-2.5 text-ink disabled:opacity-60"
                placeholder="Tell us about call volume, languages, and go-live target."
                maxLength={10000}
              />
            </label>

            {errorMsg ? (
              <p className="type-body-sm rounded-md border border-semantic-error/30 bg-surface-1 px-3 py-2 text-semantic-error" role="alert">
                {errorMsg}
              </p>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-2">
              <ButtonPrimary type="submit" disabled={submitting || !configured}>
                {submitting ? 'Sending…' : 'Send message'}
              </ButtonPrimary>
              <ButtonSecondary
                type="button"
                disabled={submitting}
                onClick={() => {
                  formRef.current?.reset();
                  setErrorMsg(null);
                }}
              >
                Clear
              </ButtonSecondary>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
