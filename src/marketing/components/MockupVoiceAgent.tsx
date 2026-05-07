import { Mic, MessageSquare, Phone, Sparkles, Volume2 } from 'lucide-react';

/** CSS-only “product” frame — no shadows per design system. */
export function MockupVoiceAgent() {
  return (
    <div
      className="card-interactive w-full max-w-2xl rounded-2xl p-6"
      role="img"
      aria-label="Voicera agent interface preview"
    >
      <div className="flex items-center justify-between border-b border-hairline-soft pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-canvas text-ink">
            <Phone className="h-4 w-4" />
          </div>
          <div>
            <p className="type-body-sm font-medium text-ink">Live session</p>
            <p className="type-caption text-ink-subtle">Gemini · Voice</p>
          </div>
        </div>
        <span className="rounded-xs bg-canvas type-caption text-ink-muted">Connected</span>
      </div>
      <div className="mt-4 grid gap-3">
        <div className="rounded-md border border-hairline-soft bg-canvas/80 p-4">
          <p className="type-mono text-ink-muted">session.connect(wss://api)</p>
          <p className="type-mono text-ink mt-1">RAG: 3 chunks · org_kb_v2</p>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            <div className="rounded-sm bg-canvas p-3 type-body-sm text-ink">
              <span className="text-ink-subtle">Caller · </span>
              Hi, I need appointment slots for this week.
            </div>
            <div className="rounded-sm border border-hairline p-3 type-body-sm text-ink">
              <div className="mb-1 flex items-center gap-1 type-caption text-ink-subtle">
                <Sparkles className="h-3 w-3" /> Agent
              </div>
              I can help. We have Thursday 2pm and Friday 10am. Should I book one for you?
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border border-dashed border-hairline p-3">
          <div className="flex items-center gap-2 type-body-sm text-ink-muted">
            <MessageSquare className="h-4 w-4" />
            Leads & transcripts sync to workspace
          </div>
          <Volume2 className="h-4 w-4 text-ink-tertiary" />
        </div>
        <div className="flex items-center justify-center gap-3 py-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-on-primary">
            <Mic className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MockupDashboardInline() {
  return (
    <div className="card-interactive w-full max-w-2xl rounded-2xl p-6" aria-hidden>
      <div className="mb-4 flex gap-1 border-b border-hairline-soft pb-3 type-body-sm text-ink-muted">
        {['Overview', 'Leads', 'Appointments', 'Billing'].map((t) => (
          <span
            key={t}
            className={`rounded-pill px-3 py-1.5 ${
              t === 'Leads' ? 'bg-canvas text-ink' : 'text-ink-muted'
            }`}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Conversations', v: '128', c: 'report-blue' as const },
          { label: 'Leads (7d)', v: '14', c: 'report-pink' as const },
          { label: 'Booked', v: '9', c: 'report-lime' as const },
        ].map((x) => (
          <div key={x.label} className="rounded-lg border border-hairline p-3">
            <p className="type-caption text-ink-subtle">{x.label}</p>
            <p
              className={`type-card-title ${
                x.c === 'report-blue'
                  ? 'text-report-blue'
                  : x.c === 'report-pink'
                    ? 'text-report-pink'
                    : 'text-report-lime'
              }`}
            >
              {x.v}
            </p>
          </div>
        ))}
      </div>
      <p className="type-mono text-ink-tertiary mt-4 border-t border-hairline-soft pt-3">last_sync: ok · stripe active</p>
    </div>
  );
}
