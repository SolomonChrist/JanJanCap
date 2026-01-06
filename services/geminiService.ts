
import { GoogleGenAI, Type } from "@google/genai";
import { Caption } from "../types";

export async function transcribeAudio(audioBase64: string): Promise<Caption[]> {
  const userApiKey = localStorage.getItem('gemini_api_key');
  
  if (!userApiKey) {
    throw new Error("API Key Missing: Please click the gear icon to add your Google Gemini API Key.");
  }

  const ai = new GoogleGenAI({ apiKey: userApiKey });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'audio/wav',
              data: audioBase64
            }
          },
          {
            text: 'Transcribe this audio precisely. Provide the transcription as a JSON array of objects, where each object has "start" (number, seconds), "end" (number, seconds), and "text" (string) properties. Group sentences into logical segments of 3-7 words each.'
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            start: { type: Type.NUMBER, description: 'Start time in seconds' },
            end: { type: Type.NUMBER, description: 'End time in seconds' },
            text: { type: Type.STRING, description: 'The spoken text' }
          },
          required: ['start', 'end', 'text']
        }
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '[]');
    return data.map((item: any, index: number) => ({
      ...item,
      id: `caption-${index}`
    }));
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("AI Transcription failed. Ensure your API Key is valid and has Gemini 3 access.");
  }
}
