import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { VoiceraLogo } from '../../components/VoiceraLogo';

const groups = [
  {
    title: 'Product',
    links: [
      { to: '/product', label: 'Overview' },
      { to: '/pricing', label: 'Pricing' },
      { to: '/security', label: 'Security' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/customers', label: 'Customers' },
      { to: '/resources', label: 'Resources' },
      { to: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy' },
      { to: '/terms', label: 'Terms' },
    ],
  },
];

const linkClass = 'type-caption text-ink-subtle transition-ui hover:text-ink rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';

export function MarketingFooter() {
  return (
    <footer className="border-t border-hairline-soft bg-canvas px-4 py-12 sm:px-6 sm:px-8 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-10 flex flex-col gap-4 border-b border-hairline-soft pb-10 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/"
            className="flex w-fit items-center rounded-md text-ink transition-ui hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <VoiceraLogo variant="full" className="h-8 w-auto sm:h-9" />
          </Link>
          <p className="type-caption max-w-md text-ink-subtle sm:text-right">
            Voice that carries your knowledge, your tone, and your data boundaries—so the phone line stays an asset, not
            a liability.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="type-caption font-medium text-ink-muted">{g.title}</p>
              <ul className="mt-2 space-y-1.5">
                {g.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className={linkClass}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="col-span-2 sm:col-span-1">
            <p className="type-caption font-medium text-ink-muted">Launch</p>
            <Link to="/app" className={cn(linkClass, 'mt-2 inline-block')}>
              Open workspace
            </Link>
          </div>
        </div>
        <p className="type-caption mt-10 text-ink-tertiary">© {new Date().getFullYear()} Voicera. All rights reserved.</p>
      </div>
    </footer>
  );
}
