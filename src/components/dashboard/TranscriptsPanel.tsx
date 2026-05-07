import React, { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { Message } from '../../types';
import { MessageSquare, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

type Row = { id: string; created_at: string; messages: Message[] };

export default function TranscriptsPanel({ organizationId }: { organizationId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('transcripts')
      .select('id, messages, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (!error && data) {
      setRows(
        data.map((r) => ({
          id: r.id as string,
          created_at: r.created_at as string,
          messages: (r.messages as Message[]) ?? [],
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [organizationId]);

  return (
    <div className="p-8 bg-white rounded-3xl border border-slate-200/60 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <MessageSquare className="text-indigo-600" size={22} />
        <div>
          <h3 className="text-xl font-display font-bold text-slate-900">Transcripts</h3>
          <p className="text-sm text-slate-500">Recent conversation logs.</p>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">No transcripts yet.</p>
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto">
          {rows.map((t) => (
            <li key={t.id} className="border border-slate-100 rounded-xl overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 text-left text-sm font-medium text-slate-800 hover:bg-slate-100"
                onClick={() => setOpenId(openId === t.id ? null : t.id)}
              >
                <span>{new Date(t.created_at).toLocaleString()}</span>
                {openId === t.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              {openId === t.id && (
                <div className="px-4 py-3 space-y-2 text-xs text-slate-600 max-h-64 overflow-y-auto border-t border-slate-100">
                  {t.messages.map((m, i) => (
                    <div key={i} className={m.role === 'user' ? 'text-slate-800' : 'text-indigo-800'}>
                      <span className="font-bold uppercase">{m.role}:</span> {m.text}
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
