import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Lead, Appointment, Message } from '../types';

export const BusinessService = {
  async captureLead(lead: Omit<Lead, 'id' | 'createdAt'>) {
    const docRef = await addDoc(collection(db, 'leads'), {
      ...lead,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async scheduleAppointment(appointment: Omit<Appointment, 'id' | 'createdAt'>) {
    const docRef = await addDoc(collection(db, 'appointments'), {
      ...appointment,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async saveTranscript(messages: Message[]) {
    const docRef = await addDoc(collection(db, 'transcripts'), {
      messages,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  }
};
