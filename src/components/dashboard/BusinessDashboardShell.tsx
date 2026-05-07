import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { cn } from '../../lib/utils';
import { KnowledgeItem, VoicePersona, VoiceProfile } from '../../types';
import KnowledgeBaseManager from '../KnowledgeBaseManager';
import KnowledgeBaseAnalyzer from '../KnowledgeBaseAnalyzer';
import VoiceCloner from '../VoiceCloner';
import PersonaSelector from '../PersonaSelector';
import IntroManager from '../IntroManager';
import LeadsPanel from './LeadsPanel';
import AppointmentsPanel from './AppointmentsPanel';
import TranscriptsPanel from './TranscriptsPanel';
import BillingCard from './BillingCard';
import DashboardOverview, { type DashboardSectionNav } from './DashboardOverview';

export type OrgRowLite = {
  id: string;
  name: string;
  public_slug: string;
  subscription_status: string;
};

type Section = DashboardSectionNav;

type Props = {
  organizationId: string;
  orgRow: OrgRowLite | null;
  user: User;
  knowledgeItems: KnowledgeItem[];
  setKnowledgeItems: React.Dispatch<React.SetStateAction<KnowledgeItem[]>>;
  intro: string;
  setIntro: React.Dispatch<React.SetStateAction<string>>;
  activePersona: VoicePersona | null;
  setActivePersona: React.Dispatch<React.SetStateAction<VoicePersona | null>>;
  language: 'hindi' | 'english';
  onLanguageChange: (l: 'hindi' | 'english') => void;
  onVoiceProfileUpdate: (p: VoiceProfile | null) => void;
};

const NAV: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'activity', label: 'Activity' },
  { id: 'voice', label: 'Voice & settings' },
];

export default function BusinessDashboardShell({
  organizationId,
  orgRow,
  user,
  knowledgeItems,
  setKnowledgeItems,
  intro,
  setIntro,
  activePersona,
  setActivePersona,
  language,
  onLanguageChange,
  onVoiceProfileUpdate,
}: Props) {
  const [section, setSection] = useState<Section>('overview');

  if (!orgRow) {
    return <p className="text-slate-500">Loading workspace…</p>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 text-slate-900">
          <h2 className="text-3xl font-display font-bold tracking-tight">Business Dashboard</h2>
        </div>
        <nav
          className="flex flex-wrap gap-2 p-1.5 bg-slate-100/90 rounded-xl border border-slate-200/80"
          aria-label="Dashboard sections"
        >
          {NAV.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                section === id
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {section === 'overview' && (
        <DashboardOverview
          organizationId={organizationId}
          orgRow={orgRow}
          user={user}
          intro={intro}
          onNavigate={(s) => setSection(s)}
        />
      )}

      {section === 'knowledge' && (
        <div className="space-y-8">
          <KnowledgeBaseManager organizationId={organizationId} onUpdate={setKnowledgeItems} />
          <KnowledgeBaseAnalyzer knowledgeItems={knowledgeItems} />
        </div>
      )}

      {section === 'activity' && (
        <div className="space-y-8">
          <TranscriptsPanel organizationId={organizationId} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LeadsPanel organizationId={organizationId} />
            <AppointmentsPanel organizationId={organizationId} />
          </div>
        </div>
      )}

      {section === 'voice' && (
        <div className="space-y-8">
          <BillingCard subscriptionStatus={orgRow.subscription_status} publicSlug={orgRow.public_slug} />
          <IntroManager intro={intro} onUpdate={setIntro} />
          <PersonaSelector
            selectedPersona={activePersona}
            onSelect={setActivePersona}
            language={language}
            onLanguageChange={onLanguageChange}
          />
          <VoiceCloner organizationId={organizationId} onUpdate={onVoiceProfileUpdate} />
        </div>
      )}
    </div>
  );
}
