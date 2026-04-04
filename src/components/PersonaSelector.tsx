import React from 'react';
import { VOICE_PERSONAS } from '../constants';
import { VoicePersona } from '../types';
import { User } from 'lucide-react';
import { cn } from '../lib/utils';

interface PersonaSelectorProps {
  selectedPersona: VoicePersona | null;
  onSelect: (persona: VoicePersona) => void;
}

export default function PersonaSelector({ selectedPersona, onSelect }: PersonaSelectorProps) {
  return (
    <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-200/60 p-8 space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
          <User size={24} />
        </div>
        <div>
          <h3 className="text-2xl font-display font-bold text-slate-900">Voice Persona</h3>
          <p className="text-sm text-slate-500">Choose the personality of your AI agent.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {VOICE_PERSONAS.map((persona) => (
          <button
            key={persona.id}
            onClick={() => onSelect(persona)}
            className={cn(
              "p-4 rounded-2xl border-2 text-left transition-all",
              selectedPersona?.id === persona.id
                ? "border-indigo-500 bg-indigo-50 shadow-sm"
                : "border-slate-100 bg-slate-50 hover:border-indigo-200"
            )}
          >
            <h4 className="font-bold text-slate-900">{persona.name}</h4>
            <p className="text-xs text-slate-500 mt-1">{persona.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
