import OpenAI from "openai";
import { speechToText, ensureCompatibleFormat } from "./replit_integrations/audio";

// Initialize OpenAI client with Replit AI Integrations credentials
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function transcribeAudio(audioBase64: string): Promise<string> {
  try {
    // Decode base64 to buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    
    // Convert to compatible format and transcribe using Replit AI integration
    const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
    const transcript = await speechToText(buffer, format);
    
    return transcript;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw new Error("Failed to transcribe audio");
  }
}

export async function generatePrescriptionFromTranscript(transcript: string): Promise<{
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }>;
  instructions?: string;
} | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un asistente médico que ayuda a extraer información de recetas de transcripciones de consultas médicas.
          
          Analiza la transcripción y extrae cualquier medicamento mencionado con su dosis, frecuencia y duración.
          
          Devuelve un objeto JSON con:
          - medications: array de objetos con name, dosage, frequency, duration, e instructions opcionales
          - instructions: instrucciones médicas generales para el paciente
          
          Si no se mencionan medicamentos, devuelve null.
          
          Responde siempre en español.`
        },
        {
          role: "user",
          content: `Extrae la información de receta de esta transcripción de consulta:\n\n${transcript}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    
    const parsed = JSON.parse(content);
    
    if (!parsed.medications || parsed.medications.length === 0) {
      return null;
    }
    
    return {
      medications: parsed.medications,
      instructions: parsed.instructions,
    };
  } catch (error) {
    console.error("Error generating prescription:", error);
    return null;
  }
}

export async function summarizeConsultation(transcript: string): Promise<{
  chiefComplaint?: string;
  symptoms?: string[];
  diagnosis?: string;
  notes?: string;
} | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un asistente médico que ayuda a resumir consultas médicas.
          
          Analiza la transcripción y extrae:
          - chiefComplaint: el motivo principal de la visita
          - symptoms: array de síntomas mencionados
          - diagnosis: el diagnóstico si se menciona
          - notes: notas clínicas adicionales importantes
          
          Responde siempre en español.`
        },
        {
          role: "user",
          content: `Resume esta transcripción de consulta:\n\n${transcript}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    
    return JSON.parse(content);
  } catch (error) {
    console.error("Error summarizing consultation:", error);
    return null;
  }
}
