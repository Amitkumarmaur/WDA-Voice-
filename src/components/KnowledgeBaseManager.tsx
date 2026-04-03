import React, { useState, useEffect } from 'react';
import { KnowledgeBaseService } from '../services/knowledgeBaseService';
import { KnowledgeItem } from '../types';
import { FileText, Link, Plus, Trash2, Loader2, Globe, FileUp, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface KnowledgeBaseManagerProps {
  onUpdate: (items: KnowledgeItem[]) => void;
}

export default function KnowledgeBaseManager({ onUpdate }: KnowledgeBaseManagerProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const data = await KnowledgeBaseService.getKnowledgeItems();
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
      const content = await KnowledgeBaseService.extractTextFromPdf(file);
      await KnowledgeBaseService.addKnowledgeItem({
        title: file.name,
        content,
        source: file.name,
        type: 'pdf'
      });
      await loadItems();
    } catch (error) {
      console.error('Failed to process PDF:', error);
      alert('Failed to process PDF. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddUrl = async () => {
    if (!newUrl) return;
    setIsUploading(true);
    try {
      // For URLs, we'll store the URL itself. 
      // In a real app, we'd scrape it here or use a backend service.
      // For now, we'll just store it as a placeholder.
      await KnowledgeBaseService.addKnowledgeItem({
        title: new URL(newUrl).hostname,
        content: `Website content from ${newUrl}`,
        source: newUrl,
        type: 'website'
      });
      setNewUrl('');
      setIsAdding(false);
      await loadItems();
    } catch (error) {
      console.error('Failed to add URL:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this knowledge source?')) return;
    try {
      await KnowledgeBaseService.deleteKnowledgeItem(id);
      await loadItems();
    } catch (error) {
      console.error('Failed to delete item:', error);
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
          onClick={() => setIsAdding(!isAdding)}
          className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm"
        >
          {isAdding ? <X size={24} /> : <Plus size={24} />}
        </button>
      </div>

      {isAdding && (
        <div className="p-6 bg-indigo-50/50 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300 border border-indigo-100/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-indigo-200 rounded-xl bg-white hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer transition-all group shadow-sm">
              <FileUp className="w-8 h-8 text-indigo-400 group-hover:text-indigo-600 mb-2 transition-colors" />
              <span className="text-sm font-medium text-slate-600">Upload PDF Manual</span>
              <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
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
                    onClick={handleAddUrl}
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
                <div className={cn(
                  "p-3 rounded-xl shadow-sm",
                  item.type === 'pdf' ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                )}>
                  {item.type === 'pdf' ? <FileText size={20} /> : <Globe size={20} />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{item.title}</h4>
                  <p className="text-xs text-slate-500">{item.type.toUpperCase()} • {item.source}</p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(item.id!)}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
