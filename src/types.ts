export interface VoiceProfile {
  id?: string;
  name: string;
  description: string;
  tone: string;
  pace: string;
  pitch: string;
  intonation: string;
  nuances: string;
  energyLevel: string;
  recommendedVoice: string;
  createdAt: any;
}

export interface VoicePersona {
  id: string;
  name: string;
  description: string;
  voiceName: string;
  systemInstruction: string;
  role?: string;
}

export interface Message {
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
}

export interface KnowledgeItem {
  id?: string;
  title: string;
  content: string;
  source: string;
  type: 'pdf' | 'website' | 'manual' | 'audio';
  createdAt: any;
}

export interface Lead {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  interest?: string;
  status?: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  conversationId?: string;
  createdAt: any;
}

export interface Appointment {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  date: any;
  notes?: string;
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: any;
}
