import React, { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { Lead } from '../../types';
import { Users, Loader2, Trash2, Mail } from 'lucide-react';

export default function LeadsPanel({ organizationId }: { organizationId: string }) {
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, email, interest, conversation_id, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) {
      setRows(
        data.map((r) => ({
          id: r.id as string,
          name: r.name as string,
          email: r.email as string,
          interest: r.interest as string | undefined,
          conversationId: r.conversation_id as string | undefined,
          createdAt: r.created_at,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [organizationId]);

  const remove = async (id: string) => {
    const supabase = getSupabase();
    await supabase.from('leads').delete().eq('id', id);
    void load();
  };

  return (
    <div className="p-8 bg-white rounded-3xl border border-slate-200/60 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <Users className="text-indigo-600" size={22} />
        <div>
          <h3 className="text-xl font-display font-bold text-slate-900">Recent Leads</h3>
          <p className="text-sm text-slate-500">Captured by the voice agent.</p>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">No leads yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {rows.map((l) => (
            <li key={l.id} className="py-3 flex items-start justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{l.name}</p>
                <p className="text-slate-500 flex items-center gap-1 mt-0.5">
                  <Mail size={12} /> {l.email}
                </p>
                {l.interest && <p className="text-slate-500 mt-1">{l.interest}</p>}
                <p className="text-xs text-slate-400 mt-1">
                  {l.createdAt ? new Date(l.createdAt as string).toLocaleString() : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => l.id && void remove(l.id)}
                className="p-2 text-slate-400 hover:text-rose-600 rounded-lg"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
