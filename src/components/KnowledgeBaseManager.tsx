import React, { useState, useEffect } from 'react';
import { KnowledgeBaseService } from '../services/knowledgeBaseService';
import { KnowledgeItem } from '../types';
import { FileText, Link, Plus, Trash2, Loader2, Globe, FileUp, X, Music } from 'lucide-react';
import { cn } from '../lib/utils';
import { getSupabase } from '../lib/supabase';

interface KnowledgeBaseManagerProps {
  organizationId: string;
  onUpdate: (items: KnowledgeItem[]) => void;
}

export default function KnowledgeBaseManager({ organizationId, onUpdate }: KnowledgeBaseManagerProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    void loadItems();
  }, [organizationId]);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const data = await KnowledgeBaseService.getKnowledgeItems(organizationId);
      setItems(data);
      onUpdate(data);
    } catch (error) {
      console.error('Failed to load knowledge base:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      let content = '';
      let type: 'pdf' | 'audio' = 'pdf';

      if (file.type === 'application/pdf') {
        console.log('Extracting text from PDF...');
        content = await KnowledgeBaseService.extractTextFromPdf(file);
        console.log('PDF extracted, chars:', content.length);
        type = 'pdf';
      } else if (file.type.startsWith('audio/')) {
        console.log('Transcribing audio...');
        content = await KnowledgeBaseService.transcribeAudio(file);
        type = 'audio';
      } else {
        throw new Error(`Unsupported file type: ${file.type}`);
      }

      console.log('Saving to knowledge base...');
      await KnowledgeBaseService.addKnowledgeItem(organizationId, {
        title: file.name,
        content,
        source: file.name,
        type,
      });
      console.log('Saved successfully.');
      await loadItems();
    } catch (error) {
      console.error('Failed to process file (full error):', error);
      let msg: string;
      if (error instanceof Error) {
        msg = error.message;
      } else if (typeof error === 'object' && error !== null) {
        msg = JSON.stringify(error);
      } else {
        msg = String(error);
      }
      alert(`Failed to process file: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddUrl = async () => {
    if (!newUrl) return;
    setIsUploading(true);
    try {
      const { title, text } = await KnowledgeBaseService.scrapeWebsite(newUrl);
      if (!text) {
        throw new Error('No readable content found at that URL.');
      }
      await KnowledgeBaseService.addKnowledgeItem(organizationId, {
        title: title || new URL(newUrl).hostname,
        content: text,
        source: newUrl,
        type: 'website',
      });
      setNewUrl('');
      setIsAdding(false);
      await loadItems();
    } catch (error) {
      console.error('Failed to add URL:', error);
      alert(`Failed to add URL: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsUploading(false);
    }
  };

  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    const {
      data: { session },
    } = await getSupabase().auth.getSession();
    if (!session) {
      alert('You must be logged in to delete items.');
      return;
    }
    try {
      await KnowledgeBaseService.deleteKnowledgeItem(id);
      setItemToDelete(null);
      await loadItems();
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert(`Failed to delete item: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-200/60 p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-display font-bold text-slate-900">Knowledge Base</h3>
          <p className="text-sm text-slate-500">Manage the sources your AI agent uses for answers.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm"
        >
          {isAdding ? <X size={24} /> : <Plus size={24} />}
        </button>
      </div>

      {isAdding && (
        <div className="p-6 bg-indigo-50/50 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300 border border-indigo-100/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-indigo-200 rounded-xl bg-white hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer transition-all group shadow-sm">
              <FileUp className="w-8 h-8 text-indigo-400 group-hover:text-indigo-600 mb-2 transition-colors" />
              <span className="text-sm font-medium text-slate-600">Upload PDF</span>
              <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>

            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-indigo-200 rounded-xl bg-white hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer transition-all group shadow-sm">
              <Music className="w-8 h-8 text-indigo-400 group-hover:text-indigo-600 mb-2 transition-colors" />
              <span className="text-sm font-medium text-slate-600">Upload Audio</span>
              <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>

            <div className="flex flex-col space-y-2">
              <div className="flex-1 p-6 bg-white rounded-xl border-2 border-indigo-100 flex flex-col justify-center space-y-3 shadow-sm">
                <div className="flex items-center space-x-2 text-indigo-600">
                  <Globe size={20} />
                  <span className="text-sm font-medium">Add Website URL</span>
                </div>
                <div className="flex space-x-2">
                  <input
                    type="url"
                    placeholder="https://example.com"
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddUrl()}
                    disabled={isUploading || !newUrl}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
          {isUploading && (
            <div className="flex items-center justify-center space-x-2 text-indigo-600 text-sm font-medium bg-white/80 py-2 rounded-lg">
              <Loader2 className="animate-spin" size={16} />
              <span>Processing source...</span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-sm text-slate-400">Loading knowledge base...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-sm text-slate-400">No knowledge sources added yet.</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-md hover:border-indigo-100 transition-all"
            >
              <div className="flex items-center space-x-4">
                <div
                  className={cn(
                    'p-3 rounded-xl shadow-sm',
                    item.type === 'pdf'
                      ? 'bg-rose-50 text-rose-600 border border-rose-100'
                      : item.type === 'audio'
                        ? 'bg-amber-50 text-amber-600 border border-amber-100'
                        : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                  )}
                >
                  {item.type === 'pdf' ? (
                    <FileText size={20} />
                  ) : item.type === 'audio' ? (
                    <Music size={20} />
                  ) : (
                    <Globe size={20} />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{item.title}</h4>
                  <p className="text-xs text-slate-500">
                    {item.type.toUpperCase()} • {item.source}
                  </p>
                </div>
              </div>
              {itemToDelete === item.id ? (
                <div className="flex items-center space-x-2">
                  <button type="button" onClick={() => void handleDelete(item.id!)} className="text-xs text-rose-600 font-bold hover:underline">
                    Yes
                  </button>
                  <button type="button" onClick={() => setItemToDelete(null)} className="text-xs text-slate-500 hover:underline">
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setItemToDelete(item.id!)}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
