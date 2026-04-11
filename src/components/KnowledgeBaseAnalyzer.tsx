import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from '../lib/config';
import { Sparkles, Loader2, Send, Bot, User } from 'lucide-react';
import { KnowledgeItem } from '../types';
import { cn } from '../lib/utils';

interface KnowledgeBaseAnalyzerProps {
  knowledgeItems: KnowledgeItem[];
}

export default function KnowledgeBaseAnalyzer({ knowledgeItems }: KnowledgeBaseAnalyzerProps) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!query || isLoading) return;
    setIsLoading(true);
    setResponse('');

    try {
      if (!GEMINI_API_KEY) {
        throw new Error('Missing Gemini API key. Set VITE_GEMINI_API_KEY in environment variables and rebuild.');
      }
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const context = knowledgeItems.map(item => `[${item.type}] ${item.title}: ${item.content}`).join('\n\n');
      
      const result = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `
          You are a business analyst. Use the following knowledge base to answer the user's query or analyze the content.
          
          KNOWLEDGE BASE:
          ${context}
          
          USER QUERY:
          ${query}
        `,
      });

      setResponse(result.text || "I couldn't generate an analysis.");
    } catch (error) {
      console.error("Analysis failed:", error);
      setResponse("An error occurred during analysis. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-200/60 p-8 space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
          <Sparkles size={24} />
        </div>
        <div>
          <h3 className="text-2xl font-display font-bold text-slate-900">AI Intelligence</h3>
          <p className="text-sm text-slate-500">Analyze your knowledge base or get business insights.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask Gemini to analyze your documents, suggest improvements, or answer complex questions..."
            className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm"
          />
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !query}
            className="absolute bottom-4 right-4 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>

        {response && (
          <div className="p-6 bg-indigo-50/30 rounded-2xl border border-indigo-100/50 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center space-x-2 text-indigo-600 mb-2">
              <Bot size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Gemini Analysis</span>
            </div>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {response}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
