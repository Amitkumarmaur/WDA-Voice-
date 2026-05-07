import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ButtonPrimaryLink, ButtonSecondaryLink } from './Buttons';
import { VoiceraLogo } from '../../components/VoiceraLogo';

const nav = [
  { to: '/product', label: 'Product' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/customers', label: 'Customers' },
  { to: '/resources', label: 'Resources' },
  { to: '/security', label: 'Security' },
  { to: '/contact', label: 'Contact' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'type-body-sm rounded-md px-2 py-1.5 transition-ui',
    isActive ? 'text-ink' : 'text-ink-muted hover:text-ink',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'
  );

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-hairline-soft bg-canvas/95 backdrop-blur-[6px] supports-[backdrop-filter]:bg-canvas/80">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center rounded-md text-ink transition-ui hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <VoiceraLogo className="h-9 w-auto sm:h-10" />
        </Link>
        <nav className="hidden items-center gap-1 md:flex lg:gap-2" aria-label="Main">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <ButtonSecondaryLink to="/app" className="!min-h-10">
            Log in
          </ButtonSecondaryLink>
          <ButtonPrimaryLink to="/app">Get started</ButtonPrimaryLink>
        </div>
        <button
          type="button"
          className="min-h-10 min-w-10 rounded-md border border-hairline bg-surface-1/50 transition-ui hover:border-ink/10 hover:bg-surface-1 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="mx-auto h-5 w-5" /> : <Menu className="mx-auto h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-b border-hairline-soft bg-canvas px-4 py-3 md:hidden">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={linkClass}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-hairline-soft pt-3">
              <ButtonSecondaryLink to="/app" onClick={() => setOpen(false)} className="w-full justify-center">
                Log in
              </ButtonSecondaryLink>
              <ButtonPrimaryLink to="/app" onClick={() => setOpen(false)} className="w-full justify-center">
                Get started
              </ButtonPrimaryLink>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
