import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import PublicEmbedPage from './components/PublicEmbedPage.tsx';
import { MarketingLayout } from './marketing/MarketingLayout';
import { HomePage } from './marketing/pages/HomePage';
import { PricingPage } from './marketing/pages/PricingPage';
import { ProductPage } from './marketing/pages/ProductPage';
import { CustomersPage } from './marketing/pages/CustomersPage';
import { ResourcesPage } from './marketing/pages/ResourcesPage';
import { ContactPage } from './marketing/pages/ContactPage';
import { SecurityPage } from './marketing/pages/SecurityPage';
import { PrivacyPage, TermsPage } from './marketing/pages/LegalPages';
import { NotFoundPage } from './marketing/pages/NotFoundPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/embed/:slug" element={<PublicEmbedPage />} />
        <Route path="/app/*" element={<App />} />
        {/*
          Single layout at `/` with relative child paths. Pathless + absolute `path="/pricing"`
          can fail to match in React Router 7, causing a blank app.
        */}
        <Route path="/" element={<MarketingLayout />}>
          <Route index element={<HomePage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="product" element={<ProductPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
