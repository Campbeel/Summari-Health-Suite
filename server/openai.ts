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

export interface ConsultationAISuggestions {
  clinicalSummary: {
    chiefComplaint?: string;
    symptoms?: string[];
    diagnosis?: string;
    notes?: string;
  } | null;
  prescription: {
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions?: string;
    }>;
    instructions?: string;
  } | null;
  medicalInstructions: Array<{
    category: string;
    title: string;
    description: string;
    priority: string;
  }>;
  examOrders?: Array<{
    name: string;
    instructions?: string;
  }>;
}

export async function generateFullConsultationSuggestions(transcript: string): Promise<ConsultationAISuggestions> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un asistente médico experto que analiza transcripciones de consultas médicas y extrae toda la información clínica relevante.

Analiza la transcripción y extrae CUATRO secciones:

1. **clinicalSummary**: Resumen clínico de la consulta
   - chiefComplaint: motivo principal de la visita (string)
   - symptoms: array de síntomas mencionados (string[])
   - diagnosis: diagnóstico si se menciona (string)
   - notes: notas clínicas adicionales importantes (string)

2. **prescription**: Receta médica (null si no se mencionan medicamentos)
   - medications: array de objetos con name, dosage, frequency, duration, instructions (opcional)
   - instructions: instrucciones generales para el paciente sobre los medicamentos

3. **medicalInstructions**: Array de indicaciones médicas para el paciente
   Cada indicación tiene:
   - category: una de "diet" (alimentación), "exercise" (ejercicio), "lifestyle" (estilo de vida), "follow-up" (seguimiento), "tests" (exámenes)
   - title: título corto de la indicación
   - description: descripción detallada
   - priority: "low", "normal", "high" o "urgent"

4. **examOrders**: Array de exámenes médicos solicitados (array vacío si no se mencionan)
   Cada examen tiene:
   - name: nombre del examen (ej: "Hemograma completo", "Perfil lipídico", "TSH")
   - instructions: instrucciones para el paciente (ej: "Ayuno de 12 horas") (opcional)

Si no hay información suficiente para alguna sección, devuelve null para clinicalSummary o prescription, y arrays vacíos para medicalInstructions y examOrders.

Devuelve un objeto JSON con las cuatro secciones. Responde siempre en español.`
        },
        {
          role: "user",
          content: `Analiza esta transcripción de consulta médica y extrae toda la información clínica:\n\n${transcript}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { clinicalSummary: null, prescription: null, medicalInstructions: [] };
    }

    const parsed = JSON.parse(content);

    return {
      clinicalSummary: parsed.clinicalSummary || null,
      prescription: parsed.prescription && parsed.prescription.medications?.length > 0
        ? parsed.prescription
        : null,
      medicalInstructions: Array.isArray(parsed.medicalInstructions)
        ? parsed.medicalInstructions
        : [],
      examOrders: Array.isArray(parsed.examOrders)
        ? parsed.examOrders
        : [],
    };
  } catch (error) {
    console.error("Error generating full consultation suggestions:", error);
    return { clinicalSummary: null, prescription: null, medicalInstructions: [] };
  }
}
