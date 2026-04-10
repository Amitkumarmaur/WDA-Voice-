import React, { useState, useEffect } from 'react';
import { VoiceService } from '../services/voiceService';
import { VoiceProfile } from '../types';
import { Mic, Upload, Loader2, CheckCircle, Trash2, Info, User } from 'lucide-react';
import { cn } from '../lib/utils';

interface VoiceClonerProps {
  onUpdate: (profile: VoiceProfile | null) => void;
}

export default function VoiceCloner({ onUpdate }: VoiceClonerProps) {
  const [activeProfile, setActiveProfile] = useState<VoiceProfile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const profile = await VoiceService.getActiveVoiceProfile();
      setActiveProfile(profile);
      onUpdate(profile);
    } catch (error) {
      console.error('Failed to load voice profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const profile = await VoiceService.analyzeVoiceSample(file);
      setActiveProfile(profile);
      onUpdate(profile);
    } catch (error) {
      console.error('Failed to analyze voice:', error);
      alert('Failed to analyze voice sample. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!activeProfile?.id) return;
    if (!confirm('Are you sure you want to remove this voice profile?')) return;
    
    try {
      await VoiceService.deleteVoiceProfile(activeProfile.id);
      setActiveProfile(null);
      onUpdate(null);
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-200/60 p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <Mic size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-display font-bold text-slate-900">Voice Style Matcher</h3>
            <p className="text-sm text-slate-500">Analyze a voice sample to match its tone and style.</p>
          </div>
        </div>
        {activeProfile && (
          <button
            onClick={handleDelete}
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
          >
            <Trash2 size={20} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading voice profile...</p>
        </div>
      ) : activeProfile ? (
        <div className="p-6 bg-rose-50/30 rounded-2xl border border-rose-100/50 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 border-4 border-white shadow-sm">
              <User size={32} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-lg font-bold text-slate-900">Active Voice Profile</h4>
                <CheckCircle size={16} className="text-emerald-500" />
              </div>
              <p className="text-sm text-slate-500">Mimicking your uploaded sample</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-xl border border-rose-100 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tone</span>
              <p className="text-sm font-medium text-slate-700 capitalize truncate" title={activeProfile.tone}>{activeProfile.tone}</p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-rose-100 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pitch</span>
              <p className="text-sm font-medium text-slate-700 capitalize truncate" title={activeProfile.pitch}>{activeProfile.pitch}</p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-rose-100 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pace</span>
              <p className="text-sm font-medium text-slate-700 capitalize truncate" title={activeProfile.pace}>{activeProfile.pace}</p>
            </div>
            {activeProfile.intonation && (
              <div className="p-4 bg-white rounded-xl border border-rose-100 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Intonation</span>
                <p className="text-sm font-medium text-slate-700 capitalize truncate" title={activeProfile.intonation}>{activeProfile.intonation}</p>
              </div>
            )}
            {activeProfile.energyLevel && (
              <div className="p-4 bg-white rounded-xl border border-rose-100 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Energy</span>
                <p className="text-sm font-medium text-slate-700 capitalize truncate" title={activeProfile.energyLevel}>{activeProfile.energyLevel}</p>
              </div>
            )}
            {activeProfile.nuances && (
              <div className="p-4 bg-white rounded-xl border border-rose-100 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nuances</span>
                <p className="text-sm font-medium text-slate-700 capitalize truncate" title={activeProfile.nuances}>{activeProfile.nuances}</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-white rounded-xl border border-rose-100 shadow-sm space-y-2">
            <div className="flex items-center space-x-2 text-rose-600">
              <Info size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Analysis Result & Acting Instructions</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed italic">
              "{activeProfile.description}"
            </p>
            <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100 flex items-start space-x-2">
              <Info size={16} className="text-indigo-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-indigo-700">
                <strong>Note:</strong> The real-time AI uses the closest available pre-built voice ({activeProfile.recommendedVoice}) and modifies its acting style to match these characteristics. It is not a 1:1 deepfake clone.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-rose-200 rounded-3xl bg-rose-50/30 hover:border-rose-400 hover:bg-rose-50/50 cursor-pointer transition-all group shadow-sm">
            <Upload className="w-12 h-12 text-rose-400 group-hover:text-rose-600 mb-4 transition-colors" />
            <h4 className="text-lg font-bold text-slate-900 mb-1">Upload Voice Sample</h4>
            <p className="text-sm text-slate-500 text-center max-w-xs">
              Upload a clear 10-30 second recording. The AI will analyze the emotion, pace, and tone, and apply it to the closest available AI voice.
            </p>
            <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>
          
          {isUploading && (
            <div className="flex items-center justify-center space-x-2 text-rose-600 text-sm font-medium bg-rose-50 py-3 rounded-xl border border-rose-100">
              <Loader2 className="animate-spin" size={18} />
              <span>Analyzing voice characteristics...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
