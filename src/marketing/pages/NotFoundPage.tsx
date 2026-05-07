import { ButtonPrimaryLink, ButtonSecondaryLink } from '../components/Buttons';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="type-display-md">Page not found</h1>
      <p className="type-body text-ink-muted mt-2">The page you are looking for does not exist or moved.</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <ButtonPrimaryLink to="/">Back home</ButtonPrimaryLink>
        <ButtonSecondaryLink to="/app">App</ButtonSecondaryLink>
      </div>
    </div>
  );
}
