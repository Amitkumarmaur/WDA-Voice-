import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdminDirectoryRow,
  AdminService,
  AdminUserDetail,
  AdminMembershipDetail,
} from '../../services/adminService';
import {
  Building2,
  Calendar,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Mail,
  Mic,
  RefreshCw,
  Search,
  Shield,
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
        monthly_voice_minutes_used: n(r.monthly_voice_minutes_used),
        monthly_voice_minutes_limit: Math.max(0, n(r.monthly_voice_minutes_limit)),
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    const ra =
      a.monthly_voice_minutes_limit > 0
        ? a.monthly_voice_minutes_used / a.monthly_voice_minutes_limit
        : a.monthly_voice_minutes_used > 0
          ? 2
          : 0;
    const rb =
      b.monthly_voice_minutes_limit > 0
        ? b.monthly_voice_minutes_used / b.monthly_voice_minutes_limit
        : b.monthly_voice_minutes_used > 0
          ? 2
          : 0;
    return rb - ra;
  });
}

function quotaPct(used: number, limit: number): number {
  if (limit <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, (used / limit) * 100);
}

export default function AdminDashboard() {
  const [rows, setRows] = useState<AdminDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adminView, setAdminView] = useState<'directory' | 'voice_quotas'>('directory');

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await AdminService.getUsersDirectory();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  useEffect(() => {
    if (!selectedUserId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void AdminService.getUserDetail(selectedUserId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900">Admin</h2>
            <p className="text-sm text-slate-500">All registered users and their workspaces (read-only).</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-slate-50/80 p-0.5">
            <button
              type="button"
              onClick={() => setAdminView('directory')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
                adminView === 'directory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Users className="w-3.5 h-3.5" />
              Users
            </button>
            <button
              type="button"
              onClick={() => setAdminView('voice_quotas')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
                adminView === 'voice_quotas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Mic className="w-3.5 h-3.5" />
              Voice quotas
            </button>
          </div>
          <button
            type="button"
            onClick={() => void loadDirectory()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          placeholder={
            adminView === 'directory'
              ? 'Search by email, name, org, or slug…'
              : 'Filter workspaces by name, slug, or org id…'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 outline-none"
        />
      </div>

      {adminView === 'voice_quotas' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <LayoutGrid className="w-4 h-4 text-violet-500" />
            Workspaces — voice minutes ({quotaFiltered.length})
          </div>
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[min(75vh,640px)] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100 bg-slate-50/80">
                    <th className="px-4 py-3 font-semibold">Workspace</th>
                    <th className="px-4 py-3 font-semibold">Slug</th>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold min-w-[200px]">Usage</th>
                    <th className="px-4 py-3 font-semibold text-right">Used / limit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotaFiltered.map((o) => {
                    const pct = quotaPct(o.monthly_voice_minutes_used, o.monthly_voice_minutes_limit);
                    const over = o.monthly_voice_minutes_limit <= 0 && o.monthly_voice_minutes_used > 0;
                    const barColor =
                      pct >= 100 || over ? 'bg-rose-500' : pct >= 90 ? 'bg-amber-500' : 'bg-violet-500';
                    return (
                      <tr key={o.organization_id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-medium text-slate-900">{o.org_name || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{o.public_slug || '—'}</td>
                        <td className="px-4 py-3 capitalize text-slate-700">{o.subscription_status || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all', barColor)}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                          {o.monthly_voice_minutes_used.toFixed(1)} /{' '}
                          {o.monthly_voice_minutes_limit > 0 ? o.monthly_voice_minutes_limit : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {quotaFiltered.length === 0 && (
                <p className="px-4 py-12 text-center text-sm text-slate-500">No workspaces match your filter.</p>
              )}
            </div>
          )}
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/50">
            Minutes roll up per workspace (<span className="font-mono">organizations.monthly_voice_minutes_*</span>
            ). Edge Functions block Gemini Live tokens and generate calls when used ≥ limit (requires{' '}
            <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> on those functions).
          </div>
        </div>
      ) : (
      <>
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
                <li key={r.user_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedUserId(r.user_id)}
                    className={cn(
                      'w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors',
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
                        {r.subscription_status && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {r.subscription_status}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
                  </button>
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
              <p className="text-sm font-medium">Select a user to view full profile and workspace data.</p>
            </div>
          ) : detailLoading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            </div>
          ) : detail ? (
            <UserDetailPanel detail={detail} rows={filtered.filter((x) => x.user_id === selectedUserId)} onClose={() => setSelectedUserId(null)} />
          ) : (
            <p className="p-8 text-sm text-slate-500">Could not load user detail.</p>
          )}
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 text-xs text-slate-600">
        Directory rows include one entry per organization membership. Open a user to see every workspace, billing hints,
        agent settings, voice profile, and recent activity.
      </div>
      </>
      )}
    </div>
  );
}

function UserDetailPanel({
  detail,
  rows,
  onClose,
}: {
  detail: AdminUserDetail;
  rows: AdminDirectoryRow[];
  onClose: () => void;
}) {
  const p = detail.profile;
  const email = String(p.email ?? '');
  const fullName = String(p.full_name ?? '');
  const uid = String(p.id ?? '');

  return (
    <div className="divide-y divide-slate-100">
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{fullName || email || 'User'}</h3>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <Mail className="w-3 h-3" />
            {email || '—'}
          </p>
          <p className="text-[11px] text-slate-400 mt-2 font-mono break-all">ID: {uid}</p>
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

      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <DetailStat label="Signed up" value={fmtDate(p.created_at as string)} />
        <DetailStat label="Profile updated" value={fmtDate(p.updated_at as string)} />
        <DetailStat
          label="Platform admin"
          value={(p.is_platform_admin as boolean) ? 'Yes' : 'No'}
        />
      </div>

      {rows.length > 1 && (
        <div className="px-5 py-3 bg-amber-50/80 border-y border-amber-100 text-xs text-amber-900">
          This user has {rows.length} directory rows ({rows.length} memberships). Detail below lists each workspace.
        </div>
      )}

      <div className="px-5 py-4 space-y-6">
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
  const stripe = org.stripe_customer_id != null ? String(org.stripe_customer_id) : '';
  const used = org.monthly_voice_minutes_used;
  const limit = org.monthly_voice_minutes_limit;

  const agent = m.agent_settings;
  const voice = m.voice_profile;
  const billing = m.subscription;

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-900 text-white flex items-center gap-2">
        <Building2 className="w-4 h-4 shrink-0 opacity-90" />
        <span className="font-semibold text-sm">
          Workspace {index + 1}: {orgName}
        </span>
        <span className="text-xs opacity-75 ml-auto capitalize">{m.role}</span>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
            <span className="text-slate-400 font-semibold">Public slug</span>
            <p className="font-mono text-slate-800 mt-1 break-all">{slug || '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
            <span className="text-slate-400 font-semibold">Subscription</span>
            <p className="text-slate-800 mt-1 capitalize">{subStatus || '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
            <span className="text-slate-400 font-semibold">Voice minutes</span>
            <p className="text-slate-800 mt-1">
              {used != null && limit != null ? `${used} / ${limit}` : '—'}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
            <span className="text-slate-400 font-semibold">Stripe customer</span>
            <p className="font-mono text-slate-800 mt-1 break-all text-[11px]">{stripe || '—'}</p>
          </div>
        </div>

        {billing && Object.keys(billing).length > 0 && (
          <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Subscription record</p>
            <pre className="text-[11px] text-slate-600 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(billing, null, 2)}
            </pre>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(
            [
              ['KB items', m.counts?.knowledge],
              ['Leads', m.counts?.leads],
              ['Appointments', m.counts?.appointments],
              ['Transcripts', m.counts?.transcripts],
              ['Voice profiles', m.counts?.voice_profiles],
            ] as const
          ).map(([label, val]) => (
            <div key={label} className="rounded-xl bg-violet-50/60 border border-violet-100 px-2 py-2 text-center">
              <p className="text-[10px] font-bold text-violet-600 uppercase">{label}</p>
              <p className="text-lg font-bold text-slate-900">{n(val)}</p>
            </div>
          ))}
        </div>

        {agent && (
          <div className="rounded-xl border border-slate-200 px-3 py-3 space-y-2">
            <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
              <Mic className="w-3.5 h-3.5" />
              Agent settings
            </p>
            <p className="text-xs text-slate-500">
              Language: <span className="font-medium text-slate-800">{String(agent.language ?? '—')}</span>
              {' · '}
              Persona ID:{' '}
              <span className="font-mono text-slate-800">{String(agent.persona_id || '—')}</span>
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-4">
              Intro: {String(agent.intro ?? '').trim() || '—'}
            </p>
          </div>
        )}

        {voice && Object.keys(voice).length > 0 && (
          <div className="rounded-xl border border-slate-200 px-3 py-3 space-y-1">
            <p className="text-xs font-bold text-slate-700">Voice profile (latest)</p>
            <p className="text-sm font-semibold text-slate-900">{String(voice.name ?? '')}</p>
            <p className="text-[11px] text-slate-500">
              Tone {String(voice.tone ?? '')} · Pace {String(voice.pace ?? '')} · Recommended{' '}
              <span className="font-medium text-slate-700">{String(voice.recommended_voice ?? '')}</span>
            </p>
            <p className="text-[11px] text-slate-600 line-clamp-3">{String(voice.description ?? '')}</p>
          </div>
        )}

        <MiniTable title="Recent leads" icon={<Users className="w-3.5 h-3.5" />} rows={m.recent_leads} columns={['name', 'email', 'created_at']} />
        <MiniTable
          title="Recent appointments"
          icon={<Calendar className="w-3.5 h-3.5" />}
          rows={m.recent_appointments}
          columns={['name', 'email', 'date']}
        />

        {m.recent_transcripts?.length > 0 && (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 text-xs font-bold text-slate-600">Recent transcripts</div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="px-3 py-2 font-semibold">Created</th>
                  <th className="px-3 py-2 font-semibold">Messages</th>
                </tr>
              </thead>
              <tbody>
                {m.recent_transcripts.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50">
                    <td className="px-3 py-1.5 text-slate-600">{fmtDate(t.created_at)}</td>
                    <td className="px-3 py-1.5">{t.message_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {m.sample_knowledge?.length > 0 && (
          <div className="rounded-xl border border-slate-200 px-3 py-3">
            <p className="text-xs font-bold text-slate-700 mb-2">Knowledge samples (latest)</p>
            <ul className="space-y-1.5 text-[11px] text-slate-600">
              {m.sample_knowledge.map((k) => (
                <li key={String(k.id)} className="flex gap-2">
                  <span className="font-medium text-slate-800 truncate">{String(k.title)}</span>
                  <span className="text-slate-400 shrink-0">[{String(k.type)}]</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniTable({
  title,
  icon,
  rows,
  columns,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Record<string, unknown>[];
  columns: string[];
}) {
  if (!rows?.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-400">
        No {title.toLowerCase()}.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 text-xs font-bold text-slate-600 flex items-center gap-2">
        {icon}
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              {columns.map((c) => (
                <th key={c} className="px-3 py-2 font-semibold capitalize">
                  {c.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-50">
                {columns.map((c) => (
                  <td key={c} className="px-3 py-1.5 text-slate-600 max-w-[140px] truncate">
                    {c === 'created_at' || c === 'date'
                      ? fmtDate(row[c] as string)
                      : String(row[c] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
