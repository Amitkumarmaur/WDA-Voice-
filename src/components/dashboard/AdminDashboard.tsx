import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdminContactSubmission,
  AdminDirectoryRow,
  AdminLead,
  AdminOverview,
  AdminPlan,
  AdminPlatformStats,
  AdminService,
  AdminTranscript,
  AdminUserDetail,
  AdminMembershipDetail,
  PlanName,
  SubscriptionStatus,
} from '../../services/adminService';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Inbox,
  LayoutGrid,
  Loader2,
  Mail,
  MessageSquare,
  Mic,
  Package,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  TrendingUp,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';

function n(v: number | null | undefined): number {
  return typeof v === 'number' ? v : 0;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function fmtMins(v: number | null | undefined): string {
  const m = typeof v === 'number' ? v : 0;
  return m.toFixed(1) + ' min';
}

type OrgQuotaRow = {
  organization_id: string;
  org_name: string | null;
  public_slug: string | null;
  twilio_phone_number?: string | null;
  subscription_status: string | null;
  plan_name: string | null;
  monthly_voice_minutes_used: number;
  monthly_voice_minutes_limit: number;
};

function aggregateOrgQuotas(rows: AdminDirectoryRow[]): OrgQuotaRow[] {
  const map = new Map<string, OrgQuotaRow>();
  for (const r of rows) {
    if (!r.organization_id) continue;
    if (!map.has(r.organization_id)) {
      map.set(r.organization_id, {
        organization_id: r.organization_id,
        org_name: r.org_name,
        public_slug: r.public_slug,
        subscription_status: r.subscription_status,
        plan_name: null,
        monthly_voice_minutes_used: n(r.monthly_voice_minutes_used),
        monthly_voice_minutes_limit: Math.max(0, n(r.monthly_voice_minutes_limit)),
      });
    }
  }
  return [...map.values()].sort((a, b) => a.org_name?.localeCompare(b.org_name ?? '') ?? 0);
}

function quotaPct(used: number, limit: number): number {
  if (limit <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, (used / limit) * 100);
}

type AdminView = 'overview' | 'users' | 'workspaces' | 'leads' | 'transcripts' | 'contact' | 'plans';

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  successMessage?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
};

const PLAN_OPTIONS: PlanName[] = ['free', 'starter', 'pro', 'enterprise'];
const STATUS_OPTIONS: SubscriptionStatus[] = ['free', 'active', 'past_due', 'canceled'];

// ─────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────
export default function AdminDashboard({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<AdminDirectoryRow[]>([]);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [platformStats, setPlatformStats] = useState<AdminPlatformStats | null>(null);
  const [contacts, setContacts] = useState<AdminContactSubmission[]>([]);
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [transcripts, setTranscripts] = useState<AdminTranscript[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adminView, setAdminView] = useState<AdminView>('overview');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [directory, stats, submissions, allLeads, allTranscripts, allPlans, pStats] = await Promise.all([
        AdminService.getUsersDirectory(),
        AdminService.getOverview(),
        AdminService.getContactSubmissions(100),
        AdminService.getAllLeads(300),
        AdminService.getAllTranscripts(150),
        AdminService.getPlans(),
        AdminService.getPlatformStats(),
      ]);
      setRows(directory);
      setOverview(stats);
      setContacts(submissions);
      setLeads(allLeads);
      setTranscripts(allTranscripts);
      setPlans(allPlans);
      setPlatformStats(pStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const reloadDetail = useCallback(async (userId: string) => {
    setDetailLoading(true);
    try {
      const d = await AdminService.getUserDetail(userId);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedUserId) { setDetail(null); return; }
    void reloadDetail(selectedUserId);
  }, [selectedUserId, reloadDetail]);

  const runAction = useCallback(async (fn: () => Promise<void>, successMsg: string) => {
    setActionBusy(true);
    setError(null);
    setActionMessage(null);
    try {
      await fn();
      setActionMessage(successMsg);
      await loadAll();
      if (selectedUserId) await reloadDetail(selectedUserId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy(false);
      setConfirm(null);
    }
  }, [loadAll, reloadDetail, selectedUserId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (r.email || '').toLowerCase().includes(q) ||
        (r.full_name || '').toLowerCase().includes(q) ||
        (r.org_name || '').toLowerCase().includes(q) ||
        (r.public_slug || '').toLowerCase().includes(q);
    });
  }, [rows, query]);

  const uniqueUsers = useMemo(() => {
    const map = new Map<string, AdminDirectoryRow>();
    for (const r of filtered) { if (!map.has(r.user_id)) map.set(r.user_id, r); }
    return [...map.values()];
  }, [filtered]);

  const orgQuotas = useMemo(() => aggregateOrgQuotas(rows), [rows]);

  const quotaFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgQuotas;
    return orgQuotas.filter((o) =>
      (o.org_name || '').toLowerCase().includes(q) ||
      (o.public_slug || '').toLowerCase().includes(q) ||
      o.organization_id.toLowerCase().includes(q)
    );
  }, [orgQuotas, query]);

  const leadsFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      l.name.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      (l.org_name || '').toLowerCase().includes(q) ||
      (l.interest || '').toLowerCase().includes(q)
    );
  }, [leads, query]);

  const transcriptsFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transcripts;
    return transcripts.filter((t) =>
      (t.org_name || '').toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
    );
  }, [transcripts, query]);

  const contactFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      c.email.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.message.toLowerCase().includes(q) ||
      (c.company ?? '').toLowerCase().includes(q)
    );
  }, [contacts, query]);

  const tabs: { id: AdminView; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview',    label: 'Overview',     icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { id: 'users',       label: 'Users',        icon: <Users className="w-3.5 h-3.5" />,       count: overview?.users_count },
    { id: 'workspaces',  label: 'Workspaces',   icon: <Building2 className="w-3.5 h-3.5" />,   count: overview?.organizations_count },
    { id: 'leads',       label: 'Leads',        icon: <TrendingUp className="w-3.5 h-3.5" />,  count: leads.length },
    { id: 'transcripts', label: 'Transcripts',  icon: <MessageSquare className="w-3.5 h-3.5" />, count: transcripts.length },
    { id: 'contact',     label: 'Contact',      icon: <Inbox className="w-3.5 h-3.5" />,       count: contacts.length },
    { id: 'plans',       label: 'Plans',        icon: <Package className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900">Admin Control Center</h2>
            <p className="text-sm text-slate-500">Full platform control — users, workspaces, billing, leads, transcripts.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-slate-50/80 p-0.5 flex-wrap gap-0.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setAdminView(t.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
                  adminView === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {t.icon}
                {t.label}
                {t.count != null && t.count > 0 && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                    adminView === t.id ? 'bg-violet-100 text-violet-700' : 'bg-slate-200 text-slate-600'
                  )}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading || actionBusy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {error}
        </div>
      )}
      {actionMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center justify-between">
          {actionMessage}
          <button type="button" onClick={() => setActionMessage(null)} className="text-emerald-600 hover:text-emerald-800"><X className="w-4 h-4" /></button>
        </div>
      )}

      {adminView !== 'overview' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 outline-none"
          />
        </div>
      )}

      {loading && adminView === 'overview' ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>
      ) : adminView === 'overview' ? (
        <OverviewPanel overview={overview} platformStats={platformStats} onNavigate={setAdminView} />
      ) : adminView === 'contact' ? (
        <ContactPanel
          rows={contactFiltered}
          loading={loading}
          busy={actionBusy}
          onConfirm={setConfirm}
          onRunAction={runAction}
        />
      ) : adminView === 'workspaces' ? (
        <WorkspacesPanel
          rows={quotaFiltered}
          loading={loading}
          busy={actionBusy}
          onConfirm={setConfirm}
          onRunAction={runAction}
        />
      ) : adminView === 'leads' ? (
        <LeadsPanel rows={leadsFiltered} loading={loading} />
      ) : adminView === 'transcripts' ? (
        <TranscriptsPanel rows={transcriptsFiltered} loading={loading} />
      ) : adminView === 'plans' ? (
        <PlansPanel plans={plans} loading={loading} busy={actionBusy} onRunAction={runAction} />
      ) : (
        <UsersPanel
          uniqueUsers={uniqueUsers}
          filtered={filtered}
          loading={loading}
          selectedUserId={selectedUserId}
          detail={detail}
          detailLoading={detailLoading}
          currentUserId={currentUserId}
          busy={actionBusy}
          onSelectUser={setSelectedUserId}
          onCloseDetail={() => setSelectedUserId(null)}
          onConfirm={setConfirm}
          onRunAction={runAction}
        />
      )}

      {confirm && (
        <ConfirmModal
          {...confirm}
          busy={actionBusy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void runAction(confirm.onConfirm, confirm.successMessage ?? 'Done.')}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Overview
// ─────────────────────────────────────────────
function StatCard({ label, value, sub, onClick }: { label: string; value: string | number; sub?: string; onClick?: () => void }) {
  const cls = 'rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all';
  const inner = (
    <>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </>
  );
  if (onClick) return <button type="button" onClick={onClick} className={cn(cls, 'hover:border-violet-300 hover:shadow-sm cursor-pointer')}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

function OverviewPanel({ overview, platformStats, onNavigate }: {
  overview: AdminOverview | null;
  platformStats: AdminPlatformStats | null;
  onNavigate: (v: AdminView) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Users & Workspaces</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total users" value={overview?.users_count ?? 0} onClick={() => onNavigate('users')} />
          <StatCard label="Platform admins" value={overview?.platform_admins_count ?? 0} onClick={() => onNavigate('users')} />
          <StatCard label="Workspaces" value={overview?.organizations_count ?? 0} onClick={() => onNavigate('workspaces')} />
          <StatCard label="Active subscriptions" value={platformStats?.active_subscriptions ?? 0} sub="paid plans" onClick={() => onNavigate('workspaces')} />
        </div>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Activity</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total leads" value={overview?.total_leads ?? 0} onClick={() => onNavigate('leads')} />
          <StatCard label="Appointments" value={overview?.total_appointments ?? 0} onClick={() => onNavigate('leads')} />
          <StatCard label="Transcripts" value={platformStats?.total_transcripts ?? 0} onClick={() => onNavigate('transcripts')} />
          <StatCard label="Knowledge items" value={platformStats?.total_knowledge_items ?? 0} />
        </div>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Voice usage</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Voice minutes used (total)" value={fmtMins(platformStats?.total_voice_minutes_used)} />
          <StatCard label="Org members" value={platformStats?.total_org_members ?? 0} />
          <StatCard label="Contact messages" value={overview?.contact_submissions_count ?? 0} onClick={() => onNavigate('contact')} />
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-600 space-y-2">
        <p className="font-semibold text-slate-800">What you can do from each tab</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Users</strong> — grant/revoke admin, delete accounts.</li>
          <li><strong>Workspaces</strong> — rename, change slug, set Twilio phone, change plan/status/limits, reset usage, delete.</li>
          <li><strong>Leads</strong> — browse all leads platform-wide with org attribution.</li>
          <li><strong>Transcripts</strong> — read any conversation from any workspace.</li>
          <li><strong>Contact</strong> — read and delete contact form submissions.</li>
          <li><strong>Plans</strong> — set Stripe price IDs and voice-minute limits per plan (required for billing to work).</li>
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────
function UsersPanel({ uniqueUsers, filtered, loading, selectedUserId, detail, detailLoading, currentUserId, busy, onSelectUser, onCloseDetail, onConfirm, onRunAction }: {
  uniqueUsers: AdminDirectoryRow[];
  filtered: AdminDirectoryRow[];
  loading: boolean;
  selectedUserId: string | null;
  detail: AdminUserDetail | null;
  detailLoading: boolean;
  currentUserId: string;
  busy: boolean;
  onSelectUser: (id: string) => void;
  onCloseDetail: () => void;
  onConfirm: (c: ConfirmState) => void;
  onRunAction: (fn: () => Promise<void>, msg: string) => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Users className="w-4 h-4 text-violet-500" />
          Users ({uniqueUsers.length})
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>
        ) : (
          <ul className="max-h-[min(70vh,560px)] overflow-y-auto divide-y divide-slate-100">
            {uniqueUsers.map((r) => (
              <li key={r.user_id} className="group flex items-stretch">
                <button
                  type="button"
                  onClick={() => onSelectUser(r.user_id)}
                  className={cn('flex-1 text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors', selectedUserId === r.user_id && 'bg-violet-50/80')}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {r.avatar_url ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-slate-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">{r.full_name || 'No name'}</p>
                    <p className="text-xs text-slate-500 truncate">{r.email}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {r.user_is_platform_admin && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">Admin</span>
                      )}
                      {r.org_name && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{r.org_name}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
                </button>
                {r.user_id !== currentUserId && (
                  <button
                    type="button"
                    disabled={busy}
                    title="Delete user"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirm({
                        title: 'Delete user?',
                        message: `Permanently delete ${r.email}? Their sole-owned workspaces will also be removed.`,
                        confirmLabel: 'Delete user',
                        successMessage: 'User deleted.',
                        destructive: true,
                        onConfirm: async () => {
                          await AdminService.deleteUser(r.user_id);
                          if (selectedUserId === r.user_id) onCloseDetail();
                        },
                      });
                    }}
                    className="px-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
            {uniqueUsers.length === 0 && <li className="px-4 py-12 text-center text-sm text-slate-500">No users match your search.</li>}
          </ul>
        )}
      </div>

      <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm min-h-[320px]">
        {!selectedUserId ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-slate-500">
            <Users className="w-12 h-12 text-slate-200 mb-3" />
            <p className="text-sm font-medium">Select a user to manage their account.</p>
          </div>
        ) : detailLoading ? (
          <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>
        ) : detail ? (
          <UserDetailPanel
            detail={detail}
            rows={filtered.filter((x) => x.user_id === selectedUserId)}
            currentUserId={currentUserId}
            busy={busy}
            onClose={onCloseDetail}
            onConfirm={onConfirm}
            onRunAction={onRunAction}
          />
        ) : (
          <p className="p-8 text-sm text-slate-500">Could not load user detail.</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Workspaces
// ─────────────────────────────────────────────
function WorkspacesPanel({ rows, loading, busy, onConfirm, onRunAction }: {
  rows: OrgQuotaRow[];
  loading: boolean;
  busy: boolean;
  onConfirm: (c: ConfirmState) => void;
  onRunAction: (fn: () => Promise<void>, msg: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [twilioPhone, setTwilioPhone] = useState('');
  const [plan, setPlan] = useState<PlanName>('free');
  const [status, setStatus] = useState<SubscriptionStatus>('free');
  const [voiceLimit, setVoiceLimit] = useState('120');

  const startEdit = (o: OrgQuotaRow) => {
    setEditingId(o.organization_id);
    setOrgName(o.org_name || '');
    setSlug(o.public_slug || '');
    setTwilioPhone(o.twilio_phone_number || '');
    setPlan((o.plan_name as PlanName) || 'free');
    setStatus((o.subscription_status as SubscriptionStatus) || 'free');
    setVoiceLimit(String(o.monthly_voice_minutes_limit || 120));
  };

  const embedUrl = (slug: string | null) =>
    slug ? `${window.location.origin}/embed/${encodeURIComponent(slug)}` : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Building2 className="w-4 h-4 text-violet-500" />
        Workspaces ({rows.length})
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100 bg-slate-50/80">
                <th className="px-4 py-3 font-semibold">Workspace</th>
                <th className="px-4 py-3 font-semibold">Slug / Phone</th>
                <th className="px-4 py-3 font-semibold min-w-[140px]">Voice usage</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((o) => {
                const pct = quotaPct(o.monthly_voice_minutes_used, o.monthly_voice_minutes_limit);
                const isEditing = editingId === o.organization_id;
                const url = embedUrl(o.public_slug);
                return (
                  <tr key={o.organization_id} className="hover:bg-slate-50/80 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{o.org_name || '—'}</p>
                      <span className={cn(
                        'inline-block mt-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full',
                        o.subscription_status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        o.subscription_status === 'past_due' ? 'bg-amber-100 text-amber-700' :
                        o.subscription_status === 'canceled' ? 'bg-rose-100 text-rose-700' :
                        'bg-slate-100 text-slate-500'
                      )}>
                        {o.subscription_status || 'free'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-slate-600">{o.public_slug || '—'}</p>
                      {o.twilio_phone_number && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                          <Phone className="w-3 h-3" />{o.twilio_phone_number}
                        </p>
                      )}
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-violet-600 hover:text-violet-800 mt-1">
                          <ExternalLink className="w-3 h-3" /> Embed preview
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-1">
                        <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-rose-500' : pct >= 90 ? 'bg-amber-500' : 'bg-violet-500')}
                          style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <p className="text-xs tabular-nums text-slate-600">
                        {o.monthly_voice_minutes_used.toFixed(1)} / {o.monthly_voice_minutes_limit || '—'} min
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex flex-col gap-2 items-end min-w-[220px]">
                          <input
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            placeholder="Workspace name"
                            className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5"
                          />
                          <input
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            placeholder="public-slug"
                            className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5 font-mono"
                          />
                          <input
                            value={twilioPhone}
                            onChange={(e) => setTwilioPhone(e.target.value)}
                            placeholder="+91 Twilio phone"
                            className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5"
                          />
                          <select value={plan} onChange={(e) => setPlan(e.target.value as PlanName)}
                            className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5">
                            {PLAN_OPTIONS.map((p) => <option key={p} value={p}>Plan: {p}</option>)}
                          </select>
                          <select value={status} onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
                            className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5">
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>Status: {s}</option>)}
                          </select>
                          <input
                            type="number" min={0} value={voiceLimit}
                            onChange={(e) => setVoiceLimit(e.target.value)}
                            className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5"
                            placeholder="Voice limit (min)"
                          />
                          <div className="flex gap-1 flex-wrap justify-end">
                            <button type="button" disabled={busy}
                              onClick={() => void onRunAction(
                                () => AdminService.updateOrganization(o.organization_id, {
                                  orgName: orgName || null,
                                  publicSlug: slug || null,
                                  twilioPhone: twilioPhone || null,
                                  planName: plan,
                                  subscriptionStatus: status,
                                  voiceLimit: Number(voiceLimit) || 0,
                                }),
                                'Workspace updated.'
                              )}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
                              Save
                            </button>
                            <button type="button" disabled={busy}
                              onClick={() => void onRunAction(
                                () => AdminService.updateOrganization(o.organization_id, { resetUsage: true }),
                                'Voice usage reset.'
                              )}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1">
                              <RotateCcw className="w-3 h-3" /> Reset usage
                            </button>
                            <button type="button" onClick={() => setEditingId(null)}
                              className="text-xs px-2.5 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end flex-wrap">
                          <button type="button" disabled={busy} onClick={() => startEdit(o)}
                            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50">
                            Edit
                          </button>
                          <button type="button" disabled={busy}
                            onClick={() => onConfirm({
                              title: 'Delete workspace?',
                              message: `Delete "${o.org_name}" and ALL its data (knowledge, leads, appointments, transcripts)?`,
                              confirmLabel: 'Delete workspace',
                              successMessage: 'Workspace deleted.',
                              destructive: true,
                              onConfirm: async () => { await AdminService.deleteOrganization(o.organization_id); },
                            })}
                            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50 inline-flex items-center gap-1">
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-4 py-12 text-center text-sm text-slate-500">No workspaces match your filter.</p>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Leads
// ─────────────────────────────────────────────
function LeadsPanel({ rows, loading }: { rows: AdminLead[]; loading: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <TrendingUp className="w-4 h-4 text-violet-500" />
          All leads ({rows.length})
        </div>
        <button
          type="button"
          onClick={() => {
            const csv = ['Name,Email,Phone,Interest,Org,Date',
              ...rows.map((r) => [r.name, r.email, r.phone || '', r.interest || '', r.org_name || '', r.created_at].map((v) => `"${v}"`).join(','))
            ].join('\n');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
            a.download = 'voicera-leads.csv';
            a.click();
          }}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
        >
          Export CSV
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-slate-500">No leads yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100 bg-slate-50/80">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Interest</th>
                <th className="px-4 py-3 font-semibold">Workspace</th>
                <th className="px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium text-slate-900">{l.name}</td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${l.email}`} className="text-violet-600 hover:underline">{l.email}</a>
                    {l.phone && <p className="text-xs text-slate-400 mt-0.5">{l.phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{l.interest || '—'}</td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{l.org_name || '—'}</p>
                    {l.public_slug && <p className="font-mono text-xs text-slate-400">{l.public_slug}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{fmtDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Transcripts
// ─────────────────────────────────────────────
function TranscriptsPanel({ rows, loading }: { rows: AdminTranscript[]; loading: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <MessageSquare className="w-4 h-4 text-violet-500" />
        All transcripts ({rows.length})
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-slate-500">No transcripts yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
          {rows.map((t) => {
            const expanded = expandedId === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : t.id)}
                  className="w-full text-left px-5 py-4 hover:bg-slate-50/80 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{t.org_name || 'Unknown workspace'}</span>
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">{t.public_slug || '—'}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span>{fmtDate(t.created_at)}</span>
                      <span>{t.message_count} messages</span>
                      {t.duration_seconds != null && <span><Mic className="inline w-3 h-3 mr-0.5" />{fmtMins(t.duration_seconds / 60)}</span>}
                    </div>
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                </button>
                {expanded && (
                  <div className="px-5 pb-5 space-y-2 max-h-96 overflow-y-auto bg-slate-50/60">
                    {t.messages.map((m, i) => (
                      <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm',
                          m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                        )}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    {t.messages.length === 0 && <p className="text-xs text-slate-400 py-2">No messages recorded.</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Contact submissions
// ─────────────────────────────────────────────
function ContactPanel({ rows, loading, busy, onConfirm, onRunAction }: {
  rows: AdminContactSubmission[];
  loading: boolean;
  busy: boolean;
  onConfirm: (c: ConfirmState) => void;
  onRunAction: (fn: () => Promise<void>, msg: string) => Promise<void>;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Inbox className="w-4 h-4 text-violet-500" />
        Contact submissions ({rows.length})
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-slate-500">No contact messages yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-[min(75vh,640px)] overflow-y-auto">
          {rows.map((c) => (
            <li key={c.id} className="px-5 py-4 hover:bg-slate-50/80 group">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{c.email}{c.company ? ` · ${c.company}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <time className="text-xs text-slate-400">{fmtDate(c.created_at)}</time>
                  <a
                    href={`mailto:${c.email}?subject=Re: Your Voicera enquiry`}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50"
                  >
                    <Mail className="w-3 h-3" /> Reply
                  </a>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onConfirm({
                      title: 'Delete message?',
                      message: `Delete message from ${c.name} (${c.email})?`,
                      confirmLabel: 'Delete',
                      successMessage: 'Message deleted.',
                      destructive: true,
                      onConfirm: async () => { await AdminService.deleteContactSubmission(c.id); },
                    })}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">{c.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Plans
// ─────────────────────────────────────────────
function PlansPanel({ plans, loading, busy, onRunAction }: {
  plans: AdminPlan[];
  loading: boolean;
  busy: boolean;
  onRunAction: (fn: () => Promise<void>, msg: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [priceId, setPriceId] = useState('');
  const [limit, setLimit] = useState('');
  const [displayName, setDisplayName] = useState('');

  const startEdit = (p: AdminPlan) => {
    setEditingId(p.id);
    setPriceId(p.stripe_price_id || '');
    setLimit(String(p.monthly_voice_minutes_limit));
    setDisplayName(p.display_name);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Package className="w-4 h-4 text-violet-500" />
        Plans & Stripe price IDs
      </div>
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
        <strong>Important:</strong> Set the Stripe Price ID for each paid plan so that the Stripe webhook can correctly activate subscriptions. Get price IDs from your <a href="https://dashboard.stripe.com/prices" target="_blank" rel="noopener noreferrer" className="underline">Stripe Dashboard → Products</a>.
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100 bg-slate-50/80">
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Stripe Price ID</th>
              <th className="px-4 py-3 font-semibold">Voice limit</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {plans.map((p) => {
              const isEditing = editingId === p.id;
              return (
                <tr key={p.id} className="hover:bg-slate-50/80 align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900 capitalize">{p.display_name}</p>
                    <p className="text-xs text-slate-400 font-mono">{p.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        value={priceId}
                        onChange={(e) => setPriceId(e.target.value)}
                        placeholder="price_1ABC..."
                        className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5 font-mono"
                      />
                    ) : (
                      <span className={cn('font-mono text-xs', p.stripe_price_id ? 'text-slate-700' : 'text-slate-300 italic')}>
                        {p.stripe_price_id || 'not set'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number" min={0} value={limit}
                        onChange={(e) => setLimit(e.target.value)}
                        className="w-24 text-xs rounded-lg border border-slate-200 px-2 py-1.5"
                      />
                    ) : (
                      <span className="text-slate-700">{p.monthly_voice_minutes_limit} min</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex gap-1 justify-end">
                        <button type="button" disabled={busy}
                          onClick={() => void onRunAction(
                            () => AdminService.updatePlan(p.id, {
                              stripePriceId: priceId || undefined,
                              voiceLimit: Number(limit) || undefined,
                              displayName: displayName || undefined,
                            }),
                            'Plan updated.'
                          )}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 inline-flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Save
                        </button>
                        <button type="button" onClick={() => setEditingId(null)}
                          className="text-xs px-2.5 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => startEdit(p)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50">
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// User detail panel
// ─────────────────────────────────────────────
function UserDetailPanel({ detail, rows, currentUserId, busy, onClose, onConfirm, onRunAction }: {
  detail: AdminUserDetail;
  rows: AdminDirectoryRow[];
  currentUserId: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (c: ConfirmState) => void;
  onRunAction: (fn: () => Promise<void>, msg: string) => Promise<void>;
}) {
  const p = detail.profile;
  const email = String(p.email ?? '');
  const fullName = String(p.full_name ?? '');
  const uid = String(p.id ?? '');
  const isAdmin = !!(p.is_platform_admin as boolean);
  const isSelf = uid === currentUserId;

  return (
    <div className="divide-y divide-slate-100">
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {p.avatar_url ? (
            <img src={String(p.avatar_url)} alt="" className="w-12 h-12 rounded-full border-2 border-slate-100" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center"><User className="w-6 h-6 text-slate-400" /></div>
          )}
          <div>
            <h3 className="text-lg font-bold text-slate-900">{fullName || email || 'User'}</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{email || '—'}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 py-3 flex flex-wrap gap-2 bg-slate-50/80">
        {!isSelf && (
          <button type="button" disabled={busy}
            onClick={() => void onRunAction(
              () => AdminService.setPlatformAdmin(uid, !isAdmin),
              isAdmin ? 'Admin access removed.' : 'User is now a platform admin.'
            )}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-violet-200 bg-white text-violet-800 hover:bg-violet-50 disabled:opacity-50">
            {isAdmin ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
            {isAdmin ? 'Remove admin' : 'Make admin'}
          </button>
        )}
        {!isSelf && (
          <button type="button" disabled={busy}
            onClick={() => onConfirm({
              title: 'Delete user account?',
              message: `Permanently delete ${email}?`,
              confirmLabel: 'Delete user',
              successMessage: 'User deleted.',
              destructive: true,
              onConfirm: async () => { await AdminService.deleteUser(uid); onClose(); },
            })}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5" /> Delete user
          </button>
        )}
        {isSelf && <p className="text-xs text-slate-500 py-2">You cannot delete or demote your own account here.</p>}
      </div>

      <div className="px-5 py-4 grid grid-cols-2 gap-3 text-sm">
        <DetailStat label="Signed up" value={fmtDate(p.created_at as string)} />
        <DetailStat label="Platform admin" value={isAdmin ? 'Yes' : 'No'} />
      </div>

      <div className="px-5 py-4 space-y-6 max-h-[50vh] overflow-y-auto">
        {detail.memberships.length === 0 ? (
          <p className="text-sm text-slate-500">No organization memberships.</p>
        ) : (
          detail.memberships.map((m, idx) => <MembershipCard key={idx} m={m} index={idx} />)
        )}
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-medium text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}

function MembershipCard({ m, index }: { m: AdminMembershipDetail; index: number }) {
  const org = m.organization || {};
  const orgName = String(org.name ?? 'Workspace');
  const slug = String(org.public_slug ?? '');
  const subStatus = String(org.subscription_status ?? '');
  const used = org.monthly_voice_minutes_used as number | undefined;
  const limit = org.monthly_voice_minutes_limit as number | undefined;
  const embedUrl = slug ? `${window.location.origin}/embed/${encodeURIComponent(slug)}` : null;

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-900 text-white flex items-center gap-2">
        <Building2 className="w-4 h-4 shrink-0 opacity-90" />
        <span className="font-semibold text-sm">{orgName}</span>
        <span className="text-xs opacity-75 ml-auto capitalize">{m.role}</span>
        {embedUrl && (
          <a href={embedUrl} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white ml-1">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
            <span className="text-slate-400 font-semibold">Slug</span>
            <p className="font-mono text-slate-800 mt-1 break-all">{slug || '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
            <span className="text-slate-400 font-semibold">Plan</span>
            <p className="text-slate-800 mt-1 capitalize">{subStatus || '—'}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {([['KB', m.counts?.knowledge], ['Leads', m.counts?.leads], ['Appts', m.counts?.appointments], ['Chats', m.counts?.transcripts], ['Voices', m.counts?.voice_profiles]] as const).map(([label, val]) => (
            <div key={label} className="rounded-xl bg-violet-50/60 border border-violet-100 px-2 py-2 text-center">
              <p className="text-[10px] font-bold text-violet-600 uppercase">{label}</p>
              <p className="text-lg font-bold text-slate-900">{n(val)}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Voice: {used != null && limit != null ? `${used} / ${limit} min` : '—'} — edit in Workspaces tab.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Confirm modal
// ─────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, destructive, busy, onCancel, onConfirm }: ConfirmState & { busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4" role="dialog" aria-modal="true">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600">{message}</p>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" disabled={busy} onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={onConfirm}
            className={cn('px-4 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-50 inline-flex items-center gap-2',
              destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-violet-600 hover:bg-violet-700')}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
