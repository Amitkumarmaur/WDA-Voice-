import React from 'react';
import { MessageSquare } from 'lucide-react';

interface IntroManagerProps {
  intro: string;
  onUpdate: (intro: string) => void;
}

export default function IntroManager({ intro, onUpdate }: IntroManagerProps) {
  return (
    <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-200/60 p-8 space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
          <MessageSquare size={24} />
        </div>
        <div>
          <h3 className="text-2xl font-display font-bold text-slate-900">Conversation Intro</h3>
          <p className="text-sm text-slate-500">Define the agent's opening greeting.</p>
        </div>
      </div>
      <textarea
        value={intro}
        onChange={(e) => onUpdate(e.target.value)}
        className="w-full h-32 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
        placeholder="Enter the opening greeting for the conversation..."
      />
    </div>
  );
}
