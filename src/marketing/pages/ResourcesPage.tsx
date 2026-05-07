import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, FileText } from 'lucide-react';
import { ButtonPrimaryLink, ButtonSecondaryLink } from '../components/Buttons';

const items = [
  { title: 'Set up your first knowledge base', k: 'Guide', t: '8 min' },
  { title: 'Embed a public voice agent on your site', k: 'Recipe', t: '5 min' },
  { title: 'Map leads from voice to your CRM', k: 'Post', t: '6 min' },
] as const;

export function ResourcesPage() {
  return (
    <div className="px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <p className="type-eyebrow">Resources</p>
        <h1 className="type-display-md text-ink mt-1 text-balance">Practical playbooks, not blog filler</h1>
        <p className="type-body-lg text-ink-muted mt-3 max-w-2xl text-pretty">
          Short how-tos for knowledge setup, public embed, and handoff to sales—written for operators shipping voice in
          production.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <ButtonPrimaryLink to="/app">Start in app</ButtonPrimaryLink>
          <ButtonSecondaryLink to="/contact">Ask a question</ButtonSecondaryLink>
        </div>

        <ul className="mt-12 space-y-2">
          {items.map((it) => (
            <li key={it.title}>
              <div className="flex min-h-14 items-center justify-between gap-3 rounded-md border-b border-hairline-soft py-3 type-body">
                <div className="flex min-w-0 items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-tertiary" />
                  <div>
                    <p className="type-body text-ink">{it.title}</p>
                    <p className="type-caption text-ink-tertiary">
                      {it.k} · {it.t} read
                    </p>
                  </div>
                </div>
                <Link
                  to="/contact"
                  className="shrink-0 type-body-sm text-ink-muted transition-ui hover:text-ink rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  title="Request full doc"
                >
                  <span className="inline-flex items-center gap-0.5">
                    Draft <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex items-start gap-2 rounded-lg border border-hairline bg-surface-1 p-5 type-body sm:p-6">
          <BookOpen className="mt-0.5 h-5 w-5 text-ink" />
          <div>
            <p className="type-body font-medium">Workspace documentation</p>
            <p className="type-body text-ink-muted mt-1">Deep dive lives in-app next to the tools you use.</p>
            <ButtonSecondaryLink to="/app" className="mt-3 !inline-flex min-h-10 !px-4 !py-2 !text-ink">
              Open /app
            </ButtonSecondaryLink>
          </div>
        </div>
      </div>
    </div>
  );
}
