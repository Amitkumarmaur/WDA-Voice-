import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '../../lib/supabase';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Circle,
  ExternalLink,
  LayoutDashboard,
  MessageSquare,
  Mic,
  Users,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type DashboardSectionNav = 'overview' | 'knowledge' | 'activity' | 'voice' | 'embed' | 'phone';

type Props = {
  organizationId: string;
  orgRow: { name: string; public_slug: string };
  user: User;
  intro: string;
  onNavigate: (section: Exclude<DashboardSectionNav, 'overview'>) => void;
};

type Counts = {
  knowledge: number;
  leads: number;
  appointments: number;
  transcripts: number;
};

async function countOrg(
  table: 'knowledge_items' | 'leads' | 'appointments' | 'transcripts',
  organizationId: string
): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId);
  if (error) return 0;
  return count ?? 0;
}

export default function DashboardOverview({ organizationId, orgRow, user, intro, onNavigate }: Props) {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [knowledge, leads, appointments, transcripts] = await Promise.all([
        countOrg('knowledge_items', organizationId),
        countOrg('leads', organizationId),
        countOrg('appointments', organizationId),
        countOrg('transcripts', organizationId),
      ]);
      if (!cancelled) {
        setCounts({ knowledge, leads, appointments, transcripts });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split('@')[0] ||
    'there';

  const introPreview = intro.trim().slice(0, 220) + (intro.trim().length > 220 ? '…' : '');
  const embedUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/embed/${encodeURIComponent(orgRow.public_slug)}`
      : `/embed/${orgRow.public_slug}`;

  const statCards: {
    key: keyof Counts;
    label: string;
    icon: typeof BookOpen;
    section: Exclude<DashboardSectionNav, 'overview'>;
  }[] = [
    { key: 'knowledge', label: 'Knowledge items', icon: BookOpen, section: 'knowledge' },
    { key: 'leads', label: 'Leads', icon: Users, section: 'activity' },
    { key: 'appointments', label: 'Appointments', icon: Calendar, section: 'activity' },
    { key: 'transcripts', label: 'Transcripts', icon: MessageSquare, section: 'activity' },
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-indigo-100 text-indigo-600">
            <LayoutDashboard size={28} />
          </div>
          <div>
            <h3 className="text-2xl font-display font-bold text-slate-900">Welcome back, {displayName}</h3>
            <p className="text-slate-600 mt-1">
              Workspace: <span className="font-semibold text-slate-800">{orgRow.name}</span>
            </p>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl">
              Use the tabs above to manage your knowledge base, review calls and leads, and tune your voice agent.
            </p>
          </div>
        </div>
      </div>

      {counts && counts.knowledge === 0 && counts.transcripts === 0 && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Getting started</p>
            <h4 className="text-lg font-display font-bold text-slate-900 mt-1">Set up your voice agent in 3 steps</h4>
          </div>
          <ul className="space-y-3">
            {[
              { label: 'Write your agent intro', sublabel: 'Tell the AI how to greet callers and what it helps with', section: 'voice' as const },
              { label: 'Add a knowledge document', sublabel: 'Upload a FAQ, pricing sheet, or product doc', section: 'knowledge' as const },
              { label: 'Copy your embed code', sublabel: 'Paste on your website — no server needed', section: 'embed' as const },
            ].map((step, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onNavigate(step.section)}
                  className="w-full text-left flex items-start gap-3 group"
                >
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-indigo-300 group-hover:text-indigo-500 transition-colors" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">{step.label} →</p>
                    <p className="text-xs text-slate-500 mt-0.5">{step.sublabel}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ key, label, icon: Icon, section }) => {
          const n = counts?.[key] ?? '—';
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(section)}
              className={cn(
                'text-left p-5 rounded-2xl border border-slate-200/70 bg-white shadow-sm',
                'hover:border-indigo-200 hover:shadow-md transition-all group'
              )}
            >
              <Icon className="text-indigo-500 mb-3 group-hover:scale-105 transition-transform" size={22} />
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{n}</p>
              <p className="text-sm font-medium text-slate-600 mt-1">{label}</p>
              <p className="text-xs text-indigo-600 mt-2 font-medium">Open section →</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-lg font-display font-bold text-slate-900">Conversation intro</h4>
            <button
              type="button"
              onClick={() => onNavigate('voice')}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <Mic size={16} />
              Edit in Voice & settings
            </button>
          </div>
          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed min-h-[4rem]">
            {introPreview || 'No intro set yet — add one under Voice & settings.'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
          <h4 className="text-lg font-display font-bold text-slate-900">Embed widget</h4>
          <p className="text-sm text-slate-500">
            Add your AI voice agent to any website — as a floating button or inline iframe. No server needed.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <code className="text-xs bg-slate-100 px-3 py-2 rounded-lg break-all text-slate-800 flex-1">{embedUrl}</code>
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 shrink-0 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              <ExternalLink size={16} />
              Preview
            </a>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('embed')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Get embed code →
          </button>
        </div>
      </div>
    </div>
  );
}
