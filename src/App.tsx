import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseEnvConfigured } from './lib/supabase';
import { TenantProvider, type TenantRef } from './lib/tenantContext';
import VoiceAgent from './components/VoiceAgent';
import BusinessDashboardShell from './components/dashboard/BusinessDashboardShell';
import AdminDashboard from './components/dashboard/AdminDashboard';
import { KnowledgeItem, VoiceProfile, VoicePersona } from './types';
import {
  LogIn,
  LogOut,
  Settings,
  Phone,
  LayoutDashboard,
  Loader2,
  ShieldCheck,
  Shield,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { VoiceraLogo } from './components/VoiceraLogo';
import { cn } from './lib/utils';
import { VOICE_PERSONAS, DEFAULT_AGENT_INTRO } from './constants';
import { KnowledgeBaseService } from './services/knowledgeBaseService';
import { AgentSettingsService } from './services/agentSettingsService';
import { VoiceService } from './services/voiceService';
type OrgRow = {
  id: string;
  name: string;
  public_slug: string;
  subscription_status: string;
};

const supabaseConfigured = isSupabaseEnvConfigured();

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState<'agent' | 'workspace' | 'admin'>('agent');
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [orgRow, setOrgRow] = useState<OrgRow | null>(null);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [activeVoiceProfile, setActiveVoiceProfile] = useState<VoiceProfile | null>(null);
  const [activePersona, setActivePersona] = useState<VoicePersona | null>(VOICE_PERSONAS[0]);
  const [language, setLanguage] = useState<'hindi' | 'english'>('english');
  const [intro, setIntro] = useState<string>('');
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  /** Skip one persist cycle after hydrating agent settings from the org (avoids leaking prior session state). */
  const skipNextPersistRef = useRef(true);

  const resetAgentSession = useCallback(() => {
    setOrganizationId(null);
    setOrgRow(null);
    setKnowledgeItems([]);
    setActiveVoiceProfile(null);
    setIsPlatformAdmin(false);
    setWorkspaceError(null);
    setIntro('');
    setActivePersona(VOICE_PERSONAS[0] ?? null);
    setLanguage('english');
    skipNextPersistRef.current = true;
    try {
      localStorage.removeItem('voiceAgent_intro');
    } catch {
      /* ignore */
    }
  }, []);

  const loadWorkspace = useCallback(async (uid: string) => {
    skipNextPersistRef.current = true;
    setWorkspaceError(null);
    setIntro('');
    setActivePersona(VOICE_PERSONAS[0] ?? null);
    setLanguage('english');
    setKnowledgeItems([]);
    setActiveVoiceProfile(null);
    setOrganizationId(null);
    setOrgRow(null);

    const supabase = getSupabase();

    // Always ensure a workspace exists for this user (idempotent — creates org on first sign-in).
    const { data: ensured, error: ensureErr } = await supabase.rpc('ensure_my_organization');
    if (ensureErr || !ensured) {
      console.error('ensure_my_organization', ensureErr);
      setWorkspaceError(
        ensureErr?.message ||
          'Could not create your workspace. Sign out, sign in again, and confirm Google auth is enabled in Supabase.'
      );
      return;
    }
    const oid = ensured as string;
    setOrganizationId(oid);

    const [{ data: orgData, error: orgErr }, items, settings, profile] = await Promise.all([
      supabase.from('organizations').select('id, name, public_slug, subscription_status').eq('id', oid).single(),
      KnowledgeBaseService.getKnowledgeItems(oid),
      AgentSettingsService.get(oid),
      VoiceService.getActiveVoiceProfile(oid),
    ]);

    if (orgErr) {
      console.error('organizations', orgErr);
      setWorkspaceError(orgErr.message || 'Could not load your workspace.');
      return;
    }

    const profRes = await supabase.from('profiles').select('is_platform_admin').eq('id', uid).maybeSingle();
    setIsPlatformAdmin(!profRes.error && !!profRes.data?.is_platform_admin);
    if (orgData) setOrgRow(orgData as OrgRow);
    setKnowledgeItems(items);
    setActiveVoiceProfile(profile);

    skipNextPersistRef.current = true;
    setIntro(settings?.intro?.trim() ? settings.intro : '');
    const persona = settings?.persona_id
      ? VOICE_PERSONAS.find((x) => x.id === settings.persona_id)
      : null;
    setActivePersona(persona ?? VOICE_PERSONAS[0] ?? null);
    setLanguage(settings?.language === 'hindi' || settings?.language === 'english' ? settings.language : 'english');
  }, []);

  /** Complete Google OAuth when Supabase redirects back with ?code= */
  useEffect(() => {
    if (!supabaseConfigured) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    let cancelled = false;
    const supabase = getSupabase();

    void supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
      if (cancelled) return;
      window.history.replaceState({}, '', '/app');
      if (error) {
        console.error('exchangeCodeForSession', error);
        const msg = (error.message || '').toLowerCase();
        setOauthError(
          msg.includes('verifier') || msg.includes('pkce') || msg.includes('invalid grant')
            ? 'Sign-in link expired or was opened in the wrong browser. Return to the app and click Business Login again.'
            : `Sign-in failed: ${error.message}`
        );
        return;
      }
      if (data.session?.user) {
        setOauthError(null);
        setUser(data.session.user);
        setIsLoading(false);
        window.setTimeout(() => {
          void loadWorkspace(data.session!.user.id);
        }, 0);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadWorkspace, supabaseConfigured]);

  useEffect(() => {
    if (!supabaseConfigured) {
      setIsLoading(false);
      return;
    }
    const supabase = getSupabase();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (event === 'SIGNED_IN' && session?.user) {
        setOauthError(null);
        if (window.location.search.includes('code=')) {
          window.history.replaceState({}, '', '/app');
        }
      }
      // Defer async Supabase calls — calling RPC/REST inside this callback synchronously
      // can block PKCE session exchange so users never appear in auth.users.
      if (session?.user) {
        window.setTimeout(() => {
          void loadWorkspace(session.user!.id);
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        resetAgentSession();
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (session?.user) {
        window.setTimeout(() => {
          void loadWorkspace(session.user!.id);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadWorkspace, resetAgentSession, supabaseConfigured]);

  useEffect(() => {
    if (user?.id) setActiveMainTab('workspace');
  }, [user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
      window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
    );
    const msg =
      params.get('error_description') ||
      hashParams.get('error_description') ||
      params.get('msg') ||
      '';
    const code = params.get('error_code') || hashParams.get('error_code') || '';
    if (
      code === 'validation_failed' ||
      msg.toLowerCase().includes('provider') ||
      msg.toLowerCase().includes('not enabled')
    ) {
      setOauthError(
        'Google sign-in is not enabled for this Supabase project. In the dashboard go to Authentication → Providers → Google, turn it on, and paste your Google OAuth Client ID and Secret (from Google Cloud Console).'
      );
      window.history.replaceState({}, '', '/app');
    } else if (msg) {
      setOauthError(decodeURIComponent(msg.replace(/\+/g, ' ')));
      window.history.replaceState({}, '', '/app');
    }
  }, [supabaseConfigured]);

  useEffect(() => {
    if (!supabaseConfigured || !organizationId || !user) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      void AgentSettingsService.upsert(organizationId, {
        intro,
        persona_id: activePersona?.id ?? '',
        language,
      });
    }, 800);
    return () => clearTimeout(t);
  }, [intro, activePersona?.id, language, organizationId, user, supabaseConfigured]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success' && user) {
      void loadWorkspace(user.id);
    }
  }, [user, loadWorkspace, supabaseConfigured]);

  const handleLogin = async () => {
    if (!supabaseConfigured) return;
    setOauthError(null);
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      const m = (error.message || '').toLowerCase();
      if (m.includes('provider') || m.includes('not enabled') || error.code === 'validation_failed') {
        setOauthError(
          'Google sign-in is not enabled for this Supabase project. Open Supabase → Authentication → Providers → Google, enable it, and add your OAuth Client ID and Secret from Google Cloud Console.'
        );
      } else {
        setOauthError(error.message);
      }
    }
  };

  const handleLogout = async () => {
    if (!supabaseConfigured) return;
    const supabase = getSupabase();
    await supabase.auth.signOut();
  };

  const tenant: TenantRef | null = useMemo(() => {
    if (!organizationId || !orgRow?.public_slug) return null;
    return { mode: 'org', organizationId, publicSlug: orgRow.public_slug };
  }, [organizationId, orgRow?.public_slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <Loader2 className="w-12 h-12 text-ink animate-spin" />
      </div>
    );
  }

  return (
    <TenantProvider value={tenant}>
      <div className="min-h-screen bg-canvas font-sans text-ink">
        <nav className="sticky top-0 z-50 border-b border-hairline-soft bg-canvas/95 px-4 py-3 sm:px-6">
          <div className="max-w-7xl mx-auto flex min-w-0 items-center justify-between gap-2">
            <Link
              to="/"
              className="flex max-w-[min(100%,240px)] shrink-0 items-center"
            >
              <VoiceraLogo className="h-9 w-auto sm:h-10" />
            </Link>

            <div className="flex min-w-0 items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  <div className="flex flex-wrap gap-0.5 rounded-md border border-hairline bg-surface-2/80 p-0.5">
                    <button
                      type="button"
                      onClick={() => setActiveMainTab('agent')}
                      className={cn(
                        'px-3 py-2 min-h-10 rounded-md type-body-sm font-medium transition-colors sm:px-4',
                        activeMainTab === 'agent'
                          ? 'bg-surface-1 text-ink border border-hairline'
                          : 'text-ink-muted hover:text-ink'
                      )}
                    >
                      Agent
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMainTab('workspace')}
                      className={cn(
                        'px-3 py-2 min-h-10 rounded-md type-body-sm font-medium transition-colors sm:px-4',
                        activeMainTab === 'workspace'
                          ? 'bg-surface-1 text-ink border border-hairline'
                          : 'text-ink-muted hover:text-ink'
                      )}
                    >
                      Workspace
                    </button>
                    {isPlatformAdmin && (
                      <button
                        type="button"
                        onClick={() => setActiveMainTab('admin')}
                        className={cn(
                          'inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 py-2 type-body-sm font-medium transition-colors sm:px-4',
                          activeMainTab === 'admin'
                            ? 'border border-hairline bg-surface-1 text-ink'
                            : 'text-ink-muted hover:text-ink'
                        )}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Admin
                      </button>
                    )}
                  </div>
                  <div className="hidden h-8 w-px bg-hairline sm:block" />
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <img
                      src={user.user_metadata?.avatar_url || user.user_metadata?.picture || ''}
                      alt={user.user_metadata?.full_name || ''}
                      className="h-8 w-8 rounded-full border-2 border-surface-1"
                    />
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      className="p-2 text-ink-tertiary rounded-md hover:bg-surface-2 hover:text-semantic-error"
                      title="Logout"
                    >
                      <LogOut size={18} />
                    </button>
                  </div>
                </div>
              ) : !supabaseConfigured ? (
                <span
                  className="inline-flex items-center gap-2 rounded-md border border-hairline bg-surface-2 type-body-sm font-medium text-ink px-4 py-2"
                  title="Add Supabase URL and anon key to .env.local first"
                >
                  <LogIn size={18} />
                  <span className="hidden sm:inline">Login needs Supabase env</span>
                </span>
              ) : (
                <div className="flex flex-col items-end gap-2 max-w-sm">
                  <button
                    type="button"
                    onClick={() => void handleLogin()}
                    className="type-body-sm font-medium flex min-h-10 items-center space-x-2 border border-hairline bg-surface-1 rounded-md px-4 py-2.5 text-ink hover:border-ink/20"
                  >
                    <LogIn size={18} />
                    <span>Business Login</span>
                  </button>
                  {oauthError && (
                    <p className="type-caption text-semantic-error text-right leading-snug" role="alert">
                      {oauthError}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </nav>

        {!supabaseConfigured && (
          <div className="border-b border-hairline bg-surface-2 px-4 py-3 sm:px-6">
            <div className="max-w-7xl mx-auto type-body-sm text-ink">
              <strong className="font-medium">Supabase not configured.</strong> Copy <code className="rounded-xs bg-canvas type-mono px-1.5 py-0.5 text-xs">.env.example</code> to{' '}
              <code className="rounded-xs bg-canvas type-mono px-1.5 py-0.5 text-xs">.env.local</code>, set <code className="rounded-xs bg-canvas type-mono px-1.5 py-0.5 text-xs">VITE_SUPABASE_URL</code> and{' '}
              <code className="rounded-xs bg-canvas type-mono px-1.5 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code>, then restart <code className="rounded-xs bg-canvas type-mono px-1.5 py-0.5 text-xs">npm run dev</code>.
            </div>
          </div>
        )}

        {user && workspaceError && (
          <div className="border-b border-hairline bg-surface-2 px-4 py-3 sm:px-6">
            <div className="max-w-7xl mx-auto type-body-sm text-semantic-error" role="alert">
              <strong className="font-medium">Workspace setup failed.</strong> {workspaceError}
            </div>
          </div>
        )}

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          {activeMainTab === 'agent' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              <div className="lg:col-span-7 space-y-10">
                <div className="space-y-5">
                  <div className="type-eyebrow inline-flex items-center gap-2 text-ink">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ink/30 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-ink" />
                    </span>
                    <span>Gemini Live</span>
                  </div>
                  <h2 className="type-display-md text-ink">Your 24/7 AI business voice.</h2>
                  <p className="type-body-lg text-ink-muted max-w-xl text-pretty">
                    Professional voice conversations that capture leads, schedule appointments, and answer questions
                    using your business knowledge.
                  </p>
                  {!user && (
                    <p className="type-body-sm max-w-xl rounded-md border border-hairline bg-surface-1 px-4 py-3 text-ink">
                      Sign in to load your private knowledge base. Voice can still be demoed; lead capture is saved
                      when you are signed in or on a public embed link.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { icon: ShieldCheck, title: 'RAG powered', desc: 'From your files' },
                    { icon: LayoutDashboard, title: 'Lead capture', desc: 'Into workspace' },
                    { icon: Settings, title: 'Customizable', desc: 'Your knowledge' },
                  ].map((feature, i) => (
                    <div
                      key={i}
                      className="group space-y-2.5 border border-hairline bg-surface-1 p-4 transition-colors"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-canvas text-ink">
                        <feature.icon className="text-ink" size={18} strokeWidth={1.75} />
                      </div>
                      <div>
                        <h4 className="type-body-sm font-medium text-ink">{feature.title}</h4>
                        <p className="type-caption text-ink-muted">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5">
                <VoiceAgent
                  knowledgeItems={knowledgeItems}
                  voiceProfile={activeVoiceProfile}
                  selectedPersona={activePersona}
                  language={language}
                  intro={intro.trim() || DEFAULT_AGENT_INTRO}
                />
              </div>
            </div>
          ) : activeMainTab === 'admin' ? (
            user && isPlatformAdmin ? (
              <AdminDashboard currentUserId={user.id} />
            ) : (
              <p className="type-body text-ink-muted max-w-5xl mx-auto">Admin access only.</p>
            )
          ) : !organizationId || !user ? (
            <p className="type-body text-ink-muted max-w-5xl mx-auto">Sign in to manage your workspace.</p>
          ) : !orgRow ? (
            <p className="type-body text-ink-muted max-w-5xl mx-auto">Loading workspace…</p>
          ) : (
            <BusinessDashboardShell
              organizationId={organizationId}
              orgRow={orgRow}
              user={user}
              knowledgeItems={knowledgeItems}
              setKnowledgeItems={setKnowledgeItems}
              intro={intro}
              setIntro={setIntro}
              activePersona={activePersona}
              setActivePersona={setActivePersona}
              language={language}
              onLanguageChange={setLanguage}
              onVoiceProfileUpdate={setActiveVoiceProfile}
            />
          )}
        </main>

        <footer className="mt-20 border-t border-hairline-soft py-10 px-4 sm:px-6 bg-canvas">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Phone size={16} className="text-ink" />
              <p className="type-body-sm text-ink-muted">© 2026 Voicera. Gemini Live.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 type-body-sm text-ink-muted">
              <Link to="/" className="hover:text-ink">Marketing site</Link>
              <Link to="/privacy" className="hover:text-ink">Privacy</Link>
              <Link to="/terms" className="hover:text-ink">Terms</Link>
              <Link to="/resources" className="hover:text-ink">Resources</Link>
            </div>
          </div>
        </footer>
      </div>
    </TenantProvider>
  );
}
