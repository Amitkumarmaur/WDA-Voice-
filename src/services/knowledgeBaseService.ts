import { getSupabase, getSupabaseUrl } from '../lib/supabase';
import { KnowledgeItem } from '../types';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href;

async function invokeGeminiGenerate(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('You must be logged in for this action.');
  }
  const url = `${getSupabaseUrl()}/functions/v1/gemini-generate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((json.error as string) || res.statusText);
  }
  return json;
}

function mapRow(row: Record<string, unknown>): KnowledgeItem {
  return {
    id: row.id as string,
    title: row.title as string,
    content: row.content as string,
    source: row.source as string,
    type: row.type as KnowledgeItem['type'],
    createdAt: row.created_at,
  };
}

/** Remove characters PostgreSQL cannot store in a text column (null bytes, stray control chars). */
function sanitizeForPostgres(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Allow tab (9), newline (10), carriage return (13), and everything >= space (32)
    if (code === 9 || code === 10 || code === 13 || code >= 32) {
      result += text[i];
    }
  }
  return result;
}

export const KnowledgeBaseService = {
  async addKnowledgeItem(
    organizationId: string,
    item: Omit<KnowledgeItem, 'id' | 'createdAt'>,
    storagePath?: string | null
  ): Promise<string> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('knowledge_items')
      .insert({
        organization_id: organizationId,
        title: item.title,
        content: item.content,
        source: item.source,
        type: item.type,
        storage_path: storagePath ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  },

  async getKnowledgeItems(organizationId: string): Promise<KnowledgeItem[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('knowledge_items')
      .select('id, title, content, source, type, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  },

  async deleteKnowledgeItem(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from('knowledge_items').delete().eq('id', id);
    if (error) throw error;
  },

  async extractTextFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({
      data: arrayBuffer,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
      cMapPacked: true,
    }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
        .join(' ');
      fullText += pageText + '\n';
    }
    return sanitizeForPostgres(fullText);
  },

  async transcribeAudio(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    const out = await invokeGeminiGenerate({
      action: 'transcribe_audio',
      mimeType: file.type,
      data: base64Data,
    });
    return (out.text as string) || 'Transcription failed.';
  },
};
