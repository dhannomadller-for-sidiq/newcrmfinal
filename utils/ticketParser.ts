import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system';

// NOTE: In a production app, this API key should be handled via a secure backend 
// or Supabase Edge Function. Do NOT hardcode it here.
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export interface ParsedTicketData {
  transport_type?: 'flight' | 'train' | 'bus';
  pnr?: string;
  number?: string; // Flight/Train/Bus number
  name?: string;   // Train/Bus name
  operator_contact?: string;
  
  dep_place?: string;
  dep_date?: string; // YYYY-MM-DD
  dep_time?: string; // HH:MM
  
  arr_place?: string;
  arr_date?: string; // YYYY-MM-DD
  arr_time?: string; // HH:MM
}

export async function parseTicketFile(uri: string, mimeType: string): Promise<ParsedTicketData | null> {
  // Read file as base64 once
  let base64Data = "";
  try {
    if (uri.startsWith('data:')) {
      base64Data = uri.split(',')[1];
    } else if (typeof window !== 'undefined' && (uri.startsWith('http') || uri.startsWith('blob:'))) {
      const response = await fetch(uri);
      const blob = await response.blob();
      base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });
    } else {
      base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
  } catch (err) {
    console.error("Error reading file:", err);
    return null;
  }

  // Try these stable models
  const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"];
  
  const prompt = `
    Analyze this ticket and extract journey details into a JSON array.
    
    1. IDENTIFY OUTWARD VS RETURN:
       - Outward (India -> Destination) must be the first object.
       - Return (Destination -> India) must be the second object.
    2. HANDLE CONNECTIONS:
       - Use the INITIAL departure city/date/time for "dep_...".
       - Use the FINAL destination city/date/time for "arr_...".
       - Use the FIRST flight/train number for "number".
    
    Required Fields: transport_type ('flight'|'train'|'bus'), pnr, number, name, 
    dep_place, dep_date (YYYY-MM-DD), dep_time (HH:MM), 
    arr_place, arr_date (YYYY-MM-DD), arr_time (HH:MM).
    Return ONLY a JSON array: [outward_obj, return_obj].
  `;

  for (const modelName of modelsToTry) {
    try {
      if (!genAI) {
        console.error("Gemini API not initialized. Missing API Key.");
        return null;
      }
      console.log(`✨ AI attempting with model: ${modelName} (V1BETA API)`);
      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1beta' });
      
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        }
      ]);

      const response = await result.response;
      const text = response.text();
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error: any) {
      console.warn(`Model ${modelName} failed:`, error?.message || error);
    }
  }

  return null;
}
