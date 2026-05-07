import { Link } from 'react-router-dom';

function LegalWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-2xl type-body text-ink">
        <p className="type-eyebrow">Legal</p>
        <h1 className="type-display-md text-ink mt-1 mb-4">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalWrapper title="Privacy">
      <div className="space-y-3 text-ink-muted">
        <p>
          We collect the minimum data needed to run the service: account, organization membership, and
          content you choose to store for retrieval.
        </p>
        <h2 className="type-body font-medium text-ink">Subprocessors</h2>
        <p>Typical subsystems include your Supabase project, the Gemini / Google model APIs you enable, and Stripe for billing.</p>
        <h2 className="type-body font-medium text-ink">Retention</h2>
        <p>Configure retention in your deployment. Marketing pages do not set cookies for analytics in this build.</p>
        <h2 className="type-body font-medium text-ink">Your rights</h2>
        <p>
          Request export or deletion through your org owner. <Link to="/contact" className="text-ink underline underline-offset-2">Contact</Link> us for
          requests.
        </p>
      </div>
    </LegalWrapper>
  );
}

export function TermsPage() {
  return (
    <LegalWrapper title="Terms of use">
      <div className="space-y-3 text-ink-muted">
        <p>By using Voicera you accept these informational terms. Replace with counsel-reviewed text for production.</p>
        <h2 className="type-body font-medium text-ink">Acceptable use</h2>
        <p>No reverse engineering of third-party model APIs, no abuse of telephony, no unlawful recording where prohibited.</p>
        <h2 className="type-body font-medium text-ink">Liability</h2>
        <p>Software is provided as-is. Model outputs can be wrong; you are responsible for testing in your context.</p>
      </div>
    </LegalWrapper>
  );
}
