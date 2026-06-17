import { Link } from 'react-router-dom';

function LegalWrapper({ title, lastUpdated, children }: { title: string; lastUpdated: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <p className="type-eyebrow text-ink">Legal</p>
        <h1 className="type-display-md text-ink mt-1 mb-1">{title}</h1>
        <p className="type-caption text-ink-tertiary mb-8">Last updated: {lastUpdated}</p>
        <div className="space-y-6 type-body text-ink-muted leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="type-body font-semibold text-ink mt-8 mb-2">{children}</h2>;
}

export function PrivacyPage() {
  return (
    <LegalWrapper title="Privacy Policy" lastUpdated="June 17, 2026">
      <p>
        Voicera ("we", "us", "our") is committed to protecting your personal information. This
        Privacy Policy explains how we collect, use, and safeguard information when you use our
        platform.
      </p>

      <H2>1. Information we collect</H2>
      <p>
        <strong className="text-ink">Account data:</strong> When you sign in with Google, we receive your name,
        email address, and profile picture from Google OAuth. We store this to identify your account
        and workspace.
      </p>
      <p>
        <strong className="text-ink">Workspace content:</strong> Knowledge documents, agent settings (intro,
        persona, language), and voice profiles you upload or configure are stored in your organisation
        and only accessible by members of that organisation.
      </p>
      <p>
        <strong className="text-ink">Call data:</strong> When a voice session runs, we store the call
        transcript, duration, and any leads or appointments captured during the call. Audio is
        processed by Google Gemini Live in real time and is not stored on our servers.
      </p>
      <p>
        <strong className="text-ink">Billing data:</strong> Payment is handled by Stripe. We store your
        Stripe customer ID and subscription status. We never store raw card numbers.
      </p>
      <p>
        <strong className="text-ink">Usage data:</strong> We log voice minutes used per organisation for
        quota enforcement. We do not use third-party analytics cookies on this site.
      </p>

      <H2>2. How we use your information</H2>
      <ul className="list-disc list-inside space-y-1">
        <li>To provide and operate the Voicera service</li>
        <li>To enforce voice-minute quotas and subscription limits</li>
        <li>To send transactional emails (billing, quota alerts) — no marketing emails without consent</li>
        <li>To improve the service based on aggregate, anonymised usage patterns</li>
      </ul>

      <H2>3. Subprocessors</H2>
      <p>We use the following key subprocessors:</p>
      <ul className="list-disc list-inside space-y-1">
        <li><strong className="text-ink">Supabase</strong> — database, authentication, edge functions (EU/US region)</li>
        <li><strong className="text-ink">Google Gemini Live API</strong> — real-time voice AI model</li>
        <li><strong className="text-ink">Stripe</strong> — payment processing</li>
        <li><strong className="text-ink">Twilio</strong> — phone call routing (Growth / Scale plans only)</li>
      </ul>

      <H2>4. Data retention</H2>
      <p>
        Transcripts, leads, and appointments are retained for as long as your workspace is active.
        You can delete individual records from your dashboard at any time. To delete your entire
        workspace and all associated data, contact us at{' '}
        <Link to="/contact" className="text-ink underline underline-offset-2">our contact page</Link>.
      </p>

      <H2>5. Your rights</H2>
      <p>
        You have the right to access, correct, export, or delete your personal data. To exercise
        these rights, use the data tools in your workspace dashboard or{' '}
        <Link to="/contact" className="text-ink underline underline-offset-2">contact us</Link>.
        We respond to data requests within 30 days.
      </p>

      <H2>6. Cookies</H2>
      <p>
        We use only functional cookies required for authentication (Supabase session). We do not use
        advertising or tracking cookies.
      </p>

      <H2>7. Changes</H2>
      <p>
        We may update this policy from time to time. We will notify you of material changes by email
        or by displaying a notice in your dashboard.
      </p>

      <p className="mt-8">
        Questions? <Link to="/contact" className="text-ink underline underline-offset-2">Contact us</Link>.
      </p>
    </LegalWrapper>
  );
}

export function TermsPage() {
  return (
    <LegalWrapper title="Terms of Service" lastUpdated="June 17, 2026">
      <p>
        By accessing or using Voicera you agree to be bound by these Terms of Service. Please read
        them carefully before using the platform.
      </p>

      <H2>1. The service</H2>
      <p>
        Voicera provides AI-powered voice agent software that allows businesses to handle voice
        interactions via web widgets and phone calls. The service is provided "as is" and relies on
        third-party AI models (Google Gemini) and telephony services (Twilio) that we do not control.
      </p>

      <H2>2. Your account</H2>
      <p>
        You are responsible for keeping your login credentials secure and for all activity that occurs
        under your account. You must be at least 18 years old to use Voicera.
      </p>

      <H2>3. Acceptable use</H2>
      <p>You agree not to use Voicera to:</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Record calls in jurisdictions where doing so is illegal without consent</li>
        <li>Impersonate a human when the caller has clearly asked whether they are speaking to a person or AI</li>
        <li>Transmit spam, fraudulent content, or content that violates applicable laws</li>
        <li>Reverse-engineer, scrape, or abuse the platform or underlying AI APIs</li>
        <li>Use the service for any unlawful purpose</li>
      </ul>

      <H2>4. AI outputs</H2>
      <p>
        Voicera uses AI language models that can produce incorrect or unexpected outputs. You are
        responsible for testing the agent in your context before deploying it to real callers, and for
        monitoring outputs on an ongoing basis. We are not liable for losses arising from incorrect AI
        responses.
      </p>

      <H2>5. Billing and cancellation</H2>
      <p>
        Subscriptions are billed monthly or annually in advance. Overages are billed at the per-minute
        rate for your plan. Monthly plans may be cancelled at any time; cancellation takes effect at
        the end of the current billing period. Annual plans are non-refundable after 14 days from the
        start of the subscription period.
      </p>

      <H2>6. Limitation of liability</H2>
      <p>
        To the maximum extent permitted by law, Voicera shall not be liable for any indirect,
        incidental, special, or consequential damages arising out of your use of the service. Our
        total liability is limited to the fees you paid in the 3 months preceding the claim.
      </p>

      <H2>7. Termination</H2>
      <p>
        We may suspend or terminate your account for violations of these terms, with or without notice.
        You may terminate your account at any time by cancelling your subscription and contacting us
        for workspace deletion.
      </p>

      <H2>8. Governing law</H2>
      <p>
        These terms are governed by the laws of India. Disputes will be subject to the exclusive
        jurisdiction of the courts of India.
      </p>

      <H2>9. Changes</H2>
      <p>
        We may update these terms at any time. Continued use of the service after changes constitutes
        acceptance of the new terms.
      </p>

      <p className="mt-8">
        Questions? <Link to="/contact" className="text-ink underline underline-offset-2">Contact us</Link>.
      </p>
    </LegalWrapper>
  );
}
