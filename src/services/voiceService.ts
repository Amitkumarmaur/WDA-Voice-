import { collection, addDoc, getDocs, query, orderBy, Timestamp, deleteDoc, doc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VoiceProfile } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

export const VoiceService = {
  async analyzeVoiceSample(file: File): Promise<VoiceProfile> {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
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
          text: `
            Analyze this voice sample and describe its characteristics in extreme detail to allow for a highly accurate voice acting mimicry. 
            Identify the following:
            - tone (e.g., warm, authoritative, calm, breathy, raspy)
            - pace (e.g., slow, moderate, fast, rhythmic, erratic)
            - pitch (e.g., high, low, medium, vocal fry, resonant)
            - intonation (e.g., upward inflection, flat, melodic, expressive)
            - nuances (e.g., subtle sighs, lip smacks, specific pronunciation quirks, breathiness)
            - energyLevel (e.g., low, relaxed, high, intense)
            
            Also, recommend the closest matching pre-built female voice from this list: 'Kore', 'Zephyr', 'Aoede'.
            Return the analysis in JSON format.
          `
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            tone: { type: Type.STRING },
            pace: { type: Type.STRING },
            pitch: { type: Type.STRING },
            intonation: { type: Type.STRING },
            nuances: { type: Type.STRING },
            energyLevel: { type: Type.STRING },
            recommendedVoice: { type: Type.STRING, description: "One of: Kore, Zephyr, Aoede" }
          },
          required: ["name", "description", "tone", "pace", "pitch", "intonation", "nuances", "energyLevel", "recommendedVoice"]
        }
      }
    });

    const profileData = JSON.parse(result.text || '{}');
    
    const profile: VoiceProfile = {
      ...profileData,
      createdAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, 'voice_profiles'), profile);
    return { ...profile, id: docRef.id };
  },

  async getActiveVoiceProfile(): Promise<VoiceProfile | null> {
    const q = query(collection(db, 'voice_profiles'), orderBy('createdAt', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as VoiceProfile;
  },

  async deleteVoiceProfile(id: string) {
    await deleteDoc(doc(db, 'voice_profiles', id));
  }
};
