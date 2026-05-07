import React, { useState, useEffect } from 'react';
import { VoiceService } from '../services/voiceService';
import { VoiceProfile } from '../types';
import { Mic, Upload, Loader2, CheckCircle, Trash2, Info, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { getSupabase } from '../lib/supabase';

interface VoiceClonerProps {
  organizationId: string;
  onUpdate: (profile: VoiceProfile | null) => void;
}

export default function VoiceCloner({ organizationId, onUpdate }: VoiceClonerProps) {
  const [activeProfile, setActiveProfile] = useState<VoiceProfile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadProfile();
  }, [organizationId]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const profile = await VoiceService.getActiveVoiceProfile(organizationId);
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
      const profile = await VoiceService.analyzeVoiceSample(organizationId, file);
      setActiveProfile(profile);
      onUpdate(profile);
    } catch (error) {
      console.error('Failed to analyze voice:', error);
      alert('Failed to analyze voice sample. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleDelete = async () => {
    const {
      data: { session },
    } = await getSupabase().auth.getSession();
    if (!session) {
      alert('You must be logged in to remove voice profiles.');
      return;
    }
    if (!activeProfile?.id) return;

    try {
      await VoiceService.deleteVoiceProfile(activeProfile.id);
      setActiveProfile(null);
      setShowConfirmDelete(false);
      onUpdate(null);
    } catch (error) {
      console.error('Failed to delete profile:', error);
      alert(`Failed to delete profile: ${error instanceof Error ? error.message : String(error)}`);
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
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {activeProfile ? (
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
              <div className="flex items-center space-x-2 text-emerald-600">
                <CheckCircle size={20} />
                <span className="font-bold text-sm">Active Voice Profile</span>
              </div>
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <User className="text-indigo-500" size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900">{activeProfile.name}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{activeProfile.description}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <span className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[10px] font-bold uppercase text-slate-400">
                      Tone: {activeProfile.tone}
                    </span>
                    <span className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[10px] font-bold uppercase text-slate-400">
                      Pace: {activeProfile.pace}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                {!showConfirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setShowConfirmDelete(true)}
                    className="text-xs font-bold text-rose-500 hover:text-rose-700 flex items-center space-x-1"
                  >
                    <Trash2 size={14} />
                    <span>Remove Profile</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-3">
                    <span className="text-xs text-slate-500">Are you sure?</span>
                    <button type="button" onClick={() => void handleDelete()} className="text-xs font-bold text-rose-600">
                      Yes, Delete
                    </button>
                    <button type="button" onClick={() => setShowConfirmDelete(false)} className="text-xs font-bold text-slate-400">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <label
              className={cn(
                'flex flex-col items-center justify-center p-12 border-2 border-dashed border-rose-200 rounded-3xl bg-rose-50/30 hover:bg-rose-50/50 transition-all cursor-pointer group',
                isUploading && 'opacity-50 pointer-events-none'
              )}
            >
              <div className="p-4 bg-white rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                <Upload className="text-rose-500" size={32} />
              </div>
              <span className="text-sm font-bold text-slate-700">Upload Voice Sample</span>
              <span className="text-xs text-slate-400 mt-2 text-center max-w-xs">
                Upload a short clip (MP3/WAV) of the voice you want to mimic.
              </span>
              <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
          )}

          {isUploading && (
            <div className="flex items-center justify-center space-x-2 text-rose-600 py-4">
              <Loader2 className="animate-spin" size={20} />
              <span className="text-sm font-medium">Analyzing voice characteristics...</span>
            </div>
          )}

          <div className="flex items-start space-x-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100/50">
            <Info className="text-blue-500 shrink-0" size={18} />
            <p className="text-xs text-blue-700 leading-relaxed">
              The AI will analyze spectral patterns, prosody, and emotional resonance to configure the Live API voice
              hints.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
