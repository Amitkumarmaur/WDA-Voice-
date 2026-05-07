import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { MarketingNav } from './components/MarketingNav';
import { MarketingFooter } from './components/MarketingFooter';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function MarketingLayout() {
  return (    <div className="min-h-dvh flex flex-col bg-canvas text-ink">
      <ScrollToTop />
      <MarketingNav />      <main className="flex-1">
        <Outlet />
      </main>
      <MarketingFooter />
    </div>
  );
}
