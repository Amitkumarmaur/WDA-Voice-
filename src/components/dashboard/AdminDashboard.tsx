import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdminContactSubmission,
  AdminDirectoryRow,
  AdminOverview,
  AdminService,
  AdminUserDetail,
  AdminMembershipDetail,
  PlanName,
  SubscriptionStatus,
} from '../../services/adminService';
import {
  Building2,
  ChevronRight,
  Inbox,
  LayoutGrid,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';

function n(v: number | null | undefined): number {
  return typeof v === 'number' ? v : 0;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

type OrgQuotaRow = {
  organization_id: string;
  org_name: string | null;
  public_slug: string | null;
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

type AdminView = 'overview' | 'users' | 'workspaces' | 'contact';

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

export default function AdminDashboard({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<AdminDirectoryRow[]>([]);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [contacts, setContacts] = useState<AdminContactSubmission[]>([]);
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
      const [directory, stats, submissions] = await Promise.all([
        AdminService.getUsersDirectory(),
        AdminService.getOverview(),
        AdminService.getContactSubmissions(100),
      ]);
      setRows(directory);
      setOverview(stats);
      setContacts(submissions);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

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
    if (!selectedUserId) {
      setDetail(null);
      return;
    }
    void reloadDetail(selectedUserId);
  }, [selectedUserId, reloadDetail]);

  const runAction = useCallback(
    async (fn: () => Promise<void>, successMsg: string) => {
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
    },
    [loadAll, reloadDetail, selectedUserId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const email = (r.email || '').toLowerCase();
      const name = (r.full_name || '').toLowerCase();
      const org = (r.org_name || '').toLowerCase();
      const slug = (r.public_slug || '').toLowerCase();
      return email.includes(q) || name.includes(q) || org.includes(q) || slug.includes(q);
    });
  }, [rows, query]);

  const uniqueUsers = useMemo(() => {
    const map = new Map<string, AdminDirectoryRow>();
    for (const r of filtered) {
      if (!map.has(r.user_id)) map.set(r.user_id, r);
    }
    return [...map.values()];
  }, [filtered]);

  const orgQuotas = useMemo(() => aggregateOrgQuotas(rows), [rows]);

  const quotaFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgQuotas;
    return orgQuotas.filter((o) => {
      const name = (o.org_name || '').toLowerCase();
      const slug = (o.public_slug || '').toLowerCase();
      const id = o.organization_id.toLowerCase();
      return name.includes(q) || slug.includes(q) || id.includes(q);
    });
  }, [orgQuotas, query]);

  const contactFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => {
      return (
        c.email.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.message.toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q)
      );
    });
  }, [contacts, query]);

  const tabs: { id: AdminView; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { id: 'users', label: 'Users', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'workspaces', label: 'Workspaces', icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'contact', label: 'Contact', icon: <Inbox className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900">Admin control center</h2>
            <p className="text-sm text-slate-500">Manage users, workspaces, billing, and contact submissions.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-slate-50/80 p-0.5 flex-wrap">
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
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {actionMessage}
        </div>
      )}

      {adminView !== 'overview' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder={
              adminView === 'users'
                ? 'Search users by email, name, org, or slug…'
                : adminView === 'workspaces'
                  ? 'Search workspaces…'
                  : 'Search contact submissions…'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 outline-none"
          />
        </div>
      )}

      {loading && adminView === 'overview' ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      ) : adminView === 'overview' ? (
        <OverviewPanel overview={overview} onNavigate={setAdminView} />
      ) : adminView === 'contact' ? (
        <ContactPanel rows={contactFiltered} loading={loading} />
      ) : adminView === 'workspaces' ? (
        <WorkspacesPanel
          rows={quotaFiltered}
          loading={loading}
          busy={actionBusy}
          onConfirm={setConfirm}
          onRunAction={runAction}
        />
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

function OverviewPanel({
  overview,
  onNavigate,
}: {
  overview: AdminOverview | null;
  onNavigate: (v: AdminView) => void;
}) {
  const cards = [
    { label: 'Users', value: overview?.users_count ?? 0, tab: 'users' as AdminView },
    { label: 'Workspaces', value: overview?.organizations_count ?? 0, tab: 'workspaces' as AdminView },
    { label: 'Platform admins', value: overview?.platform_admins_count ?? 0, tab: 'users' as AdminView },
    { label: 'Contact messages', value: overview?.contact_submissions_count ?? 0, tab: 'contact' as AdminView },
    { label: 'Total leads', value: overview?.total_leads ?? 0, tab: 'workspaces' as AdminView },
    { label: 'Total appointments', value: overview?.total_appointments ?? 0, tab: 'workspaces' as AdminView },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onNavigate(c.tab)}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left hover:border-violet-300 hover:shadow-sm transition-all"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{c.value}</p>
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-600 space-y-2">
        <p className="font-semibold text-slate-800">Quick guide</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Users</strong> — view profiles, grant admin access, or permanently delete accounts.
          </li>
          <li>
            <strong>Workspaces</strong> — change plan, reset voice minutes, or delete a workspace and all its data.
          </li>
          <li>
            <strong>Contact</strong> — read messages from the marketing contact form.
          </li>
        </ul>
      </div>
    </div>
  );
}

function UsersPanel({
  uniqueUsers,
  filtered,
  loading,
  selectedUserId,
  detail,
  detailLoading,
  currentUserId,
  busy,
  onSelectUser,
  onCloseDetail,
  onConfirm,
  onRunAction,
}: {
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
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          </div>
        ) : (
          <ul className="max-h-[min(70vh,560px)] overflow-y-auto divide-y divide-slate-100">
            {uniqueUsers.map((r) => (
              <li key={r.user_id} className="group flex items-stretch">
                <button
                  type="button"
                  onClick={() => onSelectUser(r.user_id)}
                  className={cn(
                    'flex-1 text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors',
                    selectedUserId === r.user_id && 'bg-violet-50/80'
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {r.avatar_url ? (
                      <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">{r.full_name || 'No name'}</p>
                    <p className="text-xs text-slate-500 truncate">{r.email}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {r.user_is_platform_admin && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                          Admin
                        </span>
                      )}
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
                        message: `Permanently delete ${r.email}? Their sole-owned workspaces will also be removed. This cannot be undone.`,
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
            {uniqueUsers.length === 0 && (
              <li className="px-4 py-12 text-center text-sm text-slate-500">No users match your search.</li>
            )}
          </ul>
        )}
      </div>

      <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm min-h-[320px]">
        {!selectedUserId ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-slate-500">
            <Users className="w-12 h-12 text-slate-200 mb-3" />
            <p className="text-sm font-medium">Select a user to manage their account and workspaces.</p>
          </div>
        ) : detailLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          </div>
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

function WorkspacesPanel({
  rows,
  loading,
  busy,
  onConfirm,
  onRunAction,
}: {
  rows: OrgQuotaRow[];
  loading: boolean;
  busy: boolean;
  onConfirm: (c: ConfirmState) => void;
  onRunAction: (fn: () => Promise<void>, msg: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanName>('free');
  const [status, setStatus] = useState<SubscriptionStatus>('free');
  const [voiceLimit, setVoiceLimit] = useState('120');

  const startEdit = (o: OrgQuotaRow) => {
    setEditingId(o.organization_id);
    setPlan((o.plan_name as PlanName) || 'free');
    setStatus((o.subscription_status as SubscriptionStatus) || 'free');
    setVoiceLimit(String(o.monthly_voice_minutes_limit || 120));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Building2 className="w-4 h-4 text-violet-500" />
        Workspaces ({rows.length})
      </div>
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100 bg-slate-50/80">
                <th className="px-4 py-3 font-semibold">Workspace</th>
                <th className="px-4 py-3 font-semibold">Slug</th>
                <th className="px-4 py-3 font-semibold min-w-[140px]">Voice usage</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((o) => {
                const pct = quotaPct(o.monthly_voice_minutes_used, o.monthly_voice_minutes_limit);
                const isEditing = editingId === o.organization_id;
                return (
                  <tr key={o.organization_id} className="hover:bg-slate-50/80 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{o.org_name || '—'}</p>
                      <p className="text-xs text-slate-500 capitalize mt-0.5">
                        {o.subscription_status || 'free'}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{o.public_slug || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-1">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            pct >= 100 ? 'bg-rose-500' : pct >= 90 ? 'bg-amber-500' : 'bg-violet-500'
                          )}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <p className="text-xs tabular-nums text-slate-600">
                        {o.monthly_voice_minutes_used.toFixed(1)} / {o.monthly_voice_minutes_limit || '—'} min
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex flex-col gap-2 items-end min-w-[200px]">
                          <select
                            value={plan}
                            onChange={(e) => setPlan(e.target.value as PlanName)}
                            className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5"
                          >
                            {PLAN_OPTIONS.map((p) => (
                              <option key={p} value={p}>
                                Plan: {p}
                              </option>
                            ))}
                          </select>
                          <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
                            className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                Status: {s}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={0}
                            value={voiceLimit}
                            onChange={(e) => setVoiceLimit(e.target.value)}
                            className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5"
                            placeholder="Voice limit (min)"
                          />
                          <div className="flex gap-1 flex-wrap justify-end">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void onRunAction(
                                  () =>
                                    AdminService.updateOrganization(o.organization_id, {
                                      planName: plan,
                                      subscriptionStatus: status,
                                      voiceLimit: Number(voiceLimit) || 0,
                                    }),
                                  'Workspace updated.'
                                )
                              }
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void onRunAction(
                                  () =>
                                    AdminService.updateOrganization(o.organization_id, { resetUsage: true }),
                                  'Voice usage reset.'
                                )
                              }
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reset
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-xs px-2.5 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end flex-wrap">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => startEdit(o)}
                            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Manage
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              onConfirm({
                                title: 'Delete workspace?',
                                message: `Delete "${o.org_name}" and ALL its data (knowledge, leads, appointments, transcripts)? This cannot be undone.`,
                                confirmLabel: 'Delete workspace',
                                successMessage: 'Workspace deleted.',
                                destructive: true,
                                onConfirm: async () => {
                                  await AdminService.deleteOrganization(o.organization_id);
                                },
                              })
                            }
                            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-slate-500">No workspaces match your filter.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ContactPanel({ rows, loading }: { rows: AdminContactSubmission[]; loading: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Inbox className="w-4 h-4 text-violet-500" />
        Contact submissions ({rows.length})
      </div>
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-slate-500">No contact messages yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-[min(75vh,640px)] overflow-y-auto">
          {rows.map((c) => (
            <li key={c.id} className="px-5 py-4 hover:bg-slate-50/80">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-slate-900">{c.name}</p>
                <time className="text-xs text-slate-400">{fmtDate(c.created_at)}</time>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{c.email}{c.company ? ` · ${c.company}` : ''}</p>
              <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{c.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UserDetailPanel({
  detail,
  rows,
  currentUserId,
  busy,
  onClose,
  onConfirm,
  onRunAction,
}: {
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
        <div>
          <h3 className="text-lg font-bold text-slate-900">{fullName || email || 'User'}</h3>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <Mail className="w-3 h-3" />
            {email || '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close detail"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 py-3 flex flex-wrap gap-2 bg-slate-50/80 border-b border-slate-100">
        {!isSelf && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onRunAction(
                () => AdminService.setPlatformAdmin(uid, !isAdmin),
                isAdmin ? 'Admin access removed.' : 'User is now a platform admin.'
              )
            }
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-violet-200 bg-white text-violet-800 hover:bg-violet-50 disabled:opacity-50"
          >
            {isAdmin ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
            {isAdmin ? 'Remove admin' : 'Make admin'}
          </button>
        )}
        {!isSelf && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onConfirm({
                title: 'Delete user account?',
                message: `Permanently delete ${email}? Sole-owned workspaces will be removed. This cannot be undone.`,
                confirmLabel: 'Delete user',
                successMessage: 'User deleted.',
                destructive: true,
                onConfirm: async () => {
                  await AdminService.deleteUser(uid);
                  onClose();
                },
              })
            }
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete user
          </button>
        )}
        {isSelf && (
          <p className="text-xs text-slate-500 py-2">You cannot delete or demote your own account here.</p>
        )}
      </div>

      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <DetailStat label="Signed up" value={fmtDate(p.created_at as string)} />
        <DetailStat label="Platform admin" value={isAdmin ? 'Yes' : 'No'} />
      </div>

      {rows.length > 1 && (
        <div className="px-5 py-3 bg-amber-50/80 border-y border-amber-100 text-xs text-amber-900">
          {rows.length} workspace memberships.
        </div>
      )}

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
  const used = org.monthly_voice_minutes_used;
  const limit = org.monthly_voice_minutes_limit;

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-900 text-white flex items-center gap-2">
        <Building2 className="w-4 h-4 shrink-0 opacity-90" />
        <span className="font-semibold text-sm">
          {orgName}
        </span>
        <span className="text-xs opacity-75 ml-auto capitalize">{m.role}</span>
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
          {(
            [
              ['KB', m.counts?.knowledge],
              ['Leads', m.counts?.leads],
              ['Appts', m.counts?.appointments],
              ['Chats', m.counts?.transcripts],
              ['Voices', m.counts?.voice_profiles],
            ] as const
          ).map(([label, val]) => (
            <div key={label} className="rounded-xl bg-violet-50/60 border border-violet-100 px-2 py-2 text-center">
              <p className="text-[10px] font-bold text-violet-600 uppercase">{label}</p>
              <p className="text-lg font-bold text-slate-900">{n(val)}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Voice: {used != null && limit != null ? `${used} / ${limit} min` : '—'} — manage in Workspaces tab.
        </p>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  destructive,
  busy,
  onCancel,
  onConfirm,
}: ConfirmState & { busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4" role="dialog" aria-modal="true">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600">{message}</p>
        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-50 inline-flex items-center gap-2',
              destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-violet-600 hover:bg-violet-700'
            )}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
