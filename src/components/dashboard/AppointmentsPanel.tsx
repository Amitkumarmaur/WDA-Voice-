import React, { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { Appointment } from '../../types';
import { LayoutDashboard, Loader2, Trash2, Phone } from 'lucide-react';

export default function AppointmentsPanel({ organizationId }: { organizationId: string }) {
  const [rows, setRows] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('appointments')
      .select('id, name, email, phone, date, notes, status, created_at')
      .eq('organization_id', organizationId)
      .order('date', { ascending: true })
      .limit(50);
    if (!error && data) {
      setRows(
        data.map((r) => ({
          id: r.id as string,
          name: r.name as string,
          email: r.email as string,
          phone: r.phone as string | undefined,
          date: r.date,
          notes: r.notes as string | undefined,
          status: r.status as Appointment['status'],
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
    await supabase.from('appointments').delete().eq('id', id);
    void load();
  };

  return (
    <div className="p-8 bg-white rounded-3xl border border-slate-200/60 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="text-indigo-600" size={22} />
        <div>
          <h3 className="text-xl font-display font-bold text-slate-900">Appointments</h3>
          <p className="text-sm text-slate-500">Scheduled follow-ups from the agent.</p>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">No appointments yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {rows.map((a) => (
            <li key={a.id} className="py-3 flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900">{a.name}</p>
                  {a.status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      a.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      a.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      a.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{a.status}</span>
                  )}
                </div>
                <p className="text-slate-500">{a.email}</p>
                {a.phone && (
                  <p className="text-slate-500 flex items-center gap-1 mt-0.5">
                    <Phone size={12} /> {a.phone}
                  </p>
                )}
                <p className="text-indigo-600 font-medium mt-1">
                  {a.date ? new Date(a.date as string).toLocaleString() : ''}
                </p>
                {a.notes && <p className="text-slate-500 mt-1">{a.notes}</p>}
              </div>
              <button
                type="button"
                onClick={() => a.id && void remove(a.id)}
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
