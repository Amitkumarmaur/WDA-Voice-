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
  type: 'pdf' | 'website' | 'manual';
  createdAt: any;
}

export interface Lead {
  id?: string;
  name: string;
  email: string;
  interest?: string;
  conversationId?: string;
  createdAt: any;
}

export interface Appointment {
  id?: string;
  name: string;
  email: string;
  date: any;
  notes?: string;
  createdAt: any;
}
