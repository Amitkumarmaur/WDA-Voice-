import { collection, addDoc, getDocs, query, orderBy, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { KnowledgeItem } from '../types';
import * as pdfjs from 'pdfjs-dist';
import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from '../lib/config';

// @ts-ignore - Vite handles this import
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export const KnowledgeBaseService = {
  async addKnowledgeItem(item: Omit<KnowledgeItem, 'id' | 'createdAt'>) {
    const docRef = await addDoc(collection(db, 'knowledge_base'), {
      ...item,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async getKnowledgeItems(): Promise<KnowledgeItem[]> {
    const q = query(collection(db, 'knowledge_base'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as KnowledgeItem[];
  },

  async deleteKnowledgeItem(id: string) {
    try {
      await deleteDoc(doc(db, 'knowledge_base', id));
    } catch (error) {
      console.error('Full error object:', error);
      throw error;
    }
  },

  async extractTextFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  },

  async transcribeAudio(file: File): Promise<string> {
    if (!GEMINI_API_KEY) {
      throw new Error('Missing Gemini API key. Set VITE_GEMINI_API_KEY in environment variables and rebuild.');
    }
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(
      new Uint8Array(arrayBuffer)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: file.type,
            data: base64Data
          }
        },
        {
          text: "Please transcribe this audio file accurately. Provide only the transcription text."
        }
      ]
    });

    return result.text || "Transcription failed.";
  }
};
