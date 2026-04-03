import { collection, addDoc, getDocs, query, orderBy, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { KnowledgeItem } from '../types';
import * as pdfjs from 'pdfjs-dist';

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
    await deleteDoc(doc(db, 'knowledge_base', id));
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
  }
};
