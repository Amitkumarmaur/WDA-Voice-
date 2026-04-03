import React, { useState, useEffect } from 'react';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import VoiceAgent from './components/VoiceAgent';
import KnowledgeBaseManager from './components/KnowledgeBaseManager';
import { KnowledgeItem } from './types';
import { LogIn, LogOut, Settings, Phone, LayoutDashboard, Loader2, ShieldCheck, Users } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'agent' | 'dashboard'>('agent');
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200/50">
              <Phone size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-display font-bold tracking-tight text-slate-900">AI Voice Agent</h1>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
                  <button
                    onClick={() => setActiveTab('agent')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      activeTab === 'agent' ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                    )}
                  >
                    Agent
                  </button>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      activeTab === 'dashboard' ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                    )}
                  >
                    Dashboard
                  </button>
                </div>
                <div className="h-8 w-px bg-slate-200 mx-2" />
                <div className="flex items-center space-x-3">
                  <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" />
                  <button
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                    title="Logout"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="flex items-center space-x-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
              >
                <LogIn size={18} />
                <span>Business Login</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === 'agent' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-10">
              <div className="space-y-6">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  <span>Gemini 3.1 Live API</span>
                </div>
                <h2 className="text-5xl md:text-6xl font-display font-bold tracking-tight text-slate-900 leading-[1.1]">
                  Your 24/7 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">AI Business</span> Representative.
                </h2>
                <p className="text-lg md:text-xl text-slate-500 max-w-xl leading-relaxed">
                  Professional voice conversations that capture leads, schedule appointments, and answer questions using your business knowledge.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: ShieldCheck, title: "RAG Powered", desc: "Always accurate" },
                  { icon: LayoutDashboard, title: "Lead Capture", desc: "Sales focused" },
                  { icon: Settings, title: "Customizable", desc: "Your knowledge" }
                ].map((feature, i) => (
                  <div key={i} className="p-5 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow space-y-3 group">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <feature.icon className="text-indigo-600" size={20} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{feature.title}</h4>
                      <p className="text-sm text-slate-500">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5">
              <VoiceAgent knowledgeItems={knowledgeItems} />
            </div>
          </div>
        ) : (
          <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex items-center space-x-3 text-slate-900">
              <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                <LayoutDashboard size={24} />
              </div>
              <h2 className="text-3xl font-display font-bold tracking-tight">Business Dashboard</h2>
            </div>
            
            <KnowledgeBaseManager onUpdate={setKnowledgeItems} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-8 bg-white rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow space-y-4">
                <h3 className="text-xl font-display font-bold text-slate-900">Recent Leads</h3>
                <p className="text-sm text-slate-500">View and manage leads captured by the AI agent.</p>
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Users className="w-8 h-8 mb-2 text-slate-300" />
                  <span>Lead management coming soon...</span>
                </div>
              </div>
              <div className="p-8 bg-white rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow space-y-4">
                <h3 className="text-xl font-display font-bold text-slate-900">Appointments</h3>
                <p className="text-sm text-slate-500">Scheduled follow-up calls and meetings.</p>
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <LayoutDashboard className="w-8 h-8 mb-2 text-slate-300" />
                  <span>Appointment calendar coming soon...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-24 border-t border-slate-200/60 py-12 px-6 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <Phone size={16} className="text-indigo-600" />
            <p className="text-sm text-slate-500 font-medium">© 2026 AI Voice Business Agent. Powered by Gemini 3.1 Flash Live.</p>
          </div>
          <div className="flex space-x-6 text-sm font-medium text-slate-500">
            <a href="#" className="hover:text-indigo-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Documentation</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
