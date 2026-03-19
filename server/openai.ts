import OpenAI from "openai";
import { speechToText, ensureCompatibleFormat } from "./replit_integrations/audio";

// Initialize OpenAI client with Replit AI Integrations credentials
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function transcribeAudio(audioBase64: string): Promise<string> {
  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
    const transcript = await speechToText(buffer, format);
    return transcript;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw new Error("Failed to transcribe audio");
  }
}

export async function transcribeAudioChunked(audioBase64: string): Promise<string> {
  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    console.log(`[Transcription] Raw audio buffer size: ${audioBuffer.length} bytes`);
    
    if (audioBuffer.length < 1000) {
      console.log(`[Transcription] Audio buffer too small (${audioBuffer.length} bytes), likely empty recording`);
      return "";
    }
    
    const { buffer: wavBuffer } = await ensureCompatibleFormat(audioBuffer);
    console.log(`[Transcription] WAV buffer size after conversion: ${wavBuffer.length} bytes`);
    
    if (wavBuffer.length < 1000) {
      console.log(`[Transcription] WAV buffer too small after conversion (${wavBuffer.length} bytes)`);
      return "";
    }
    
    const MAX_CHUNK_SIZE = 20 * 1024 * 1024;
    
    if (wavBuffer.length <= MAX_CHUNK_SIZE) {
      console.log(`[Transcription] Sending single buffer (${wavBuffer.length} bytes) to speech-to-text...`);
      const transcript = await speechToText(wavBuffer, "wav");
      console.log(`[Transcription] Single buffer result: ${transcript.length} chars`);
      return transcript;
    }
    
    const { spawn } = await import("child_process");
    const { writeFile, readdir, readFile, unlink, mkdir } = await import("fs/promises");
    const { randomUUID } = await import("crypto");
    const { tmpdir } = await import("os");
    const { join } = await import("path");
    
    const sessionId = randomUUID();
    const inputPath = join(tmpdir(), `full-audio-${sessionId}.wav`);
    const chunkDir = join(tmpdir(), `chunks-${sessionId}`);
    
    await writeFile(inputPath, wavBuffer);
    await mkdir(chunkDir, { recursive: true });
    
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath,
        "-f", "segment",
        "-segment_time", "120",
        "-ar", "16000",
        "-ac", "1",
        "-acodec", "pcm_s16le",
        "-y",
        join(chunkDir, "chunk-%03d.wav"),
      ]);
      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg segment exited with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });
    
    const chunkFiles = (await readdir(chunkDir)).filter(f => f.endsWith(".wav")).sort();
    console.log(`[Transcription] Split audio into ${chunkFiles.length} chunks for transcription`);
    
    const transcripts: string[] = [];
    for (const chunkFile of chunkFiles) {
      const chunkBuffer = await readFile(join(chunkDir, chunkFile));
      const chunkTranscript = await speechToText(chunkBuffer, "wav");
      if (chunkTranscript && chunkTranscript.trim()) {
        transcripts.push(chunkTranscript.trim());
      }
      await unlink(join(chunkDir, chunkFile)).catch(() => {});
    }
    
    await unlink(inputPath).catch(() => {});
    const { rm } = await import("fs/promises");
    await rm(chunkDir, { recursive: true, force: true }).catch(() => {});
    
    return transcripts.join(" ");
  } catch (error) {
    console.error("Error in chunked transcription:", error);
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

export interface MedicalReport {
  patientData: {
    fullName: string;
    age: number | null;
    sex: string;
    maritalStatus: string;
    occupation: string;
    location: string;
  };
  consultationData: {
    reason: string;
    currentIllness: {
      description: string;
      onset: string;
      duration: string;
      associatedSymptoms: string;
      modifyingFactors: string;
      previousTreatments: string;
    };
  };
  medicalHistory: {
    medical: string;
    surgical: string;
    allergies: string;
    medications: string;
    toxicological: string;
    gynecological: string | null;
    socioeconomic: string;
    pets: string;
  };
  familyHistory: string;
  habits: {
    diet: string;
    physicalActivity: string;
    sleep: string;
    substanceUse: string;
  };
  systemsReview: string;
  physicalExam: {
    systemsExploration: string;
  };
  diagnosticImpression: string;
  treatmentPlan: {
    tests: string[];
    treatment: string;
    instructions: string[];
  };
}

export async function generateMedicalReport(transcript: string): Promise<MedicalReport | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un asistente médico experto que genera informes médicos detallados y estructurados.
Analiza la transcripción de la consulta y genera un informe estructurado.
IMPORTANTE: NO incluyas información sensible o privada que no sea relevante para el registro médico. Omite comentarios personales, conversaciones casuales, o información que el paciente no haya querido que quede registrada.

El informe debe seguir este formato exacto en JSON:
{
  "patientData": {
    "fullName": "nombre completo del paciente (string)",
    "age": "edad del paciente (number o null si no se menciona)",
    "sex": "sexo del paciente (string, ej: 'Masculino', 'Femenino')",
    "maritalStatus": "estado civil (string, 'No mencionado' si no se indica)",
    "occupation": "ocupación (string, 'No mencionada' si no se indica)",
    "location": "ubicación/ciudad (string, 'No mencionada' si no se indica)"
  },
  "consultationData": {
    "reason": "motivo de consulta (string)",
    "currentIllness": {
      "description": "descripción de la enfermedad actual (string)",
      "onset": "inicio de los síntomas (string)",
      "duration": "duración (string)",
      "associatedSymptoms": "síntomas asociados (string)",
      "modifyingFactors": "factores que modifican los síntomas (string)",
      "previousTreatments": "tratamientos previos (string)"
    }
  },
  "medicalHistory": {
    "medical": "antecedentes médicos (string)",
    "surgical": "antecedentes quirúrgicos (string)",
    "allergies": "alergias (string)",
    "medications": "medicamentos actuales (string)",
    "toxicological": "antecedentes toxicológicos (string)",
    "gynecological": "antecedentes ginecológicos (string o null si no aplica)",
    "socioeconomic": "contexto socioeconómico (string)",
    "pets": "mascotas (string)"
  },
  "familyHistory": "antecedentes familiares (string)",
  "habits": {
    "diet": "alimentación (string)",
    "physicalActivity": "actividad física (string)",
    "sleep": "sueño (string)",
    "substanceUse": "uso de sustancias (string)"
  },
  "systemsReview": "revisión por sistemas (string)",
  "physicalExam": {
    "systemsExploration": "exploración por sistemas (string)"
  },
  "diagnosticImpression": "impresión diagnóstica (string)",
  "treatmentPlan": {
    "tests": ["array de exámenes solicitados"],
    "treatment": "plan de tratamiento (string)",
    "instructions": ["array de indicaciones para el paciente"]
  }
}

Si no hay información suficiente para un campo, usa "No mencionado" o "No evaluado" según corresponda.
Responde siempre en español. Devuelve SOLO el JSON sin texto adicional.`
        },
        {
          role: "user",
          content: `Analiza esta transcripción de consulta médica y genera el informe médico estructurado:\n\n${transcript}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    
    const defaults: MedicalReport = {
      patientData: {
        fullName: "No mencionado",
        age: null,
        sex: "No mencionado",
        maritalStatus: "No mencionado",
        occupation: "No mencionada",
        location: "No mencionada",
      },
      consultationData: {
        reason: "No mencionado",
        currentIllness: {
          description: "No mencionado",
          onset: "No mencionado",
          duration: "No mencionada",
          associatedSymptoms: "No mencionados",
          modifyingFactors: "No mencionados",
          previousTreatments: "No mencionados",
        },
      },
      medicalHistory: {
        medical: "No mencionados",
        surgical: "No mencionados",
        allergies: "No mencionadas",
        medications: "No mencionados",
        toxicological: "No mencionado",
        gynecological: null,
        socioeconomic: "No mencionado",
        pets: "No mencionado",
      },
      familyHistory: "No mencionados",
      habits: {
        diet: "No mencionada",
        physicalActivity: "No mencionada",
        sleep: "No mencionado",
        substanceUse: "No mencionado",
      },
      systemsReview: "No evaluada",
      physicalExam: {
        systemsExploration: "No evaluado",
      },
      diagnosticImpression: "No determinada",
      treatmentPlan: {
        tests: [],
        treatment: "No determinado",
        instructions: [],
      },
    };

    const report: MedicalReport = {
      patientData: { ...defaults.patientData, ...(parsed.patientData || {}) },
      consultationData: {
        reason: parsed.consultationData?.reason || defaults.consultationData.reason,
        currentIllness: { ...defaults.consultationData.currentIllness, ...(parsed.consultationData?.currentIllness || {}) },
      },
      medicalHistory: { ...defaults.medicalHistory, ...(parsed.medicalHistory || {}) },
      familyHistory: parsed.familyHistory || defaults.familyHistory,
      habits: { ...defaults.habits, ...(parsed.habits || {}) },
      systemsReview: parsed.systemsReview || defaults.systemsReview,
      physicalExam: { ...defaults.physicalExam, ...(parsed.physicalExam || {}) },
      diagnosticImpression: parsed.diagnosticImpression || defaults.diagnosticImpression,
      treatmentPlan: {
        tests: Array.isArray(parsed.treatmentPlan?.tests) ? parsed.treatmentPlan.tests : defaults.treatmentPlan.tests,
        treatment: parsed.treatmentPlan?.treatment || defaults.treatmentPlan.treatment,
        instructions: Array.isArray(parsed.treatmentPlan?.instructions) ? parsed.treatmentPlan.instructions : defaults.treatmentPlan.instructions,
      },
    };

    return report;
  } catch (error) {
    console.error("Error generating medical report:", error);
    return null;
  }
}

export interface ClinicalAlert {
  type: "error" | "warning" | "info";
  category: string;
  title: string;
  description: string;
  probability: number;
  severity: number;
}

export async function generateClinicalAlerts(data: {
  diagnosis?: string;
  symptoms?: string[];
  notes?: string;
  transcription?: string;
  medications?: Array<{ name: string; dosage: string; frequency: string; duration: string; instructions?: string }>;
  medicalInstructions?: Array<{ title: string; description: string; category: string }>;
  examOrders?: Array<{ name: string; type: string; clinicalJustification?: string }>;
  patientAllergies?: string[];
  medicalReport?: any;
}): Promise<ClinicalAlert[]> {
  try {
    const medicationsList = data.medications?.map(m => `${m.name} - ${m.dosage} cada ${m.frequency} por ${m.duration}`).join("\n") || "Sin medicamentos";
    const instructionsList = data.medicalInstructions?.map(i => `${i.title}: ${i.description}`).join("\n") || "Sin indicaciones";
    const examsList = data.examOrders?.map(e => `${e.name} (${e.type})`).join(", ") || "Sin exámenes";

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un sistema experto de alertas clínicas y farmacológicas para médicos.
Tu trabajo es analizar TODA la información de una consulta médica y detectar:

1. **ERRORES DE PRESCRIPCIÓN** (type: "error"):
   - Dosis incorrectas o peligrosas (ej: 1 kg en lugar de 1 g, 1000 mg en lugar de 100 mg)
   - Dosis fuera de rango terapéutico estándar
   - Frecuencias inadecuadas para el medicamento
   - Duraciones excesivas o insuficientes
   - Interacciones medicamentosas graves
   - Contraindicaciones con alergias del paciente
   - Medicamentos duplicados o redundantes

2. **ADVERTENCIAS CLÍNICAS** (type: "warning"):
   - Riesgos de salud futuros basados en diagnóstico y síntomas
   - Señales de alarma que requieren seguimiento
   - Posibles complicaciones del tratamiento
   - Inconsistencias entre diagnóstico y tratamiento prescrito
   - Falta de exámenes importantes para confirmar diagnóstico
   - Indicaciones que podrían ser contraproducentes

3. **INFORMACIÓN RELEVANTE** (type: "info"):
   - Recomendaciones adicionales de buenas prácticas
   - Alternativas terapéuticas a considerar
   - Recordatorios de protocolos clínicos

Para cada alerta, proporciona:
- "type": "error" | "warning" | "info"
- "category": categoría breve (ej: "Dosificación", "Interacción", "Riesgo futuro", "Protocolo")
- "title": título corto y claro
- "description": explicación detallada incluyendo qué está mal, por qué es un problema, y qué debería hacerse
- "probability": número 0-1 indicando probabilidad del riesgo (1.0 para errores de prescripción evidentes)
- "severity": número 0-1 indicando gravedad (1.0 = potencialmente mortal)

Prioriza errores de prescripción sobre advertencias generales. Sé específico y concreto.
Si no detectas ningún problema, devuelve un array vacío.
Responde SOLO en JSON: { "alerts": [...] }
Responde siempre en español.`
        },
        {
          role: "user",
          content: `Analiza esta consulta médica y detecta alertas clínicas:

DIAGNÓSTICO: ${data.diagnosis || "No especificado"}
SÍNTOMAS: ${data.symptoms?.join(", ") || "No especificados"}
NOTAS CLÍNICAS: ${data.notes || "Sin notas"}
ALERGIAS DEL PACIENTE: ${data.patientAllergies?.join(", ") || "Sin alergias conocidas"}

MEDICAMENTOS PRESCRITOS:
${medicationsList}

INDICACIONES MÉDICAS:
${instructionsList}

EXÁMENES SOLICITADOS:
${examsList}

${data.transcription ? `CONTEXTO DE LA CONSULTA (transcripción): ${data.transcription.substring(0, 2000)}` : ""}
${data.medicalReport?.diagnosticImpression ? `IMPRESIÓN DIAGNÓSTICA: ${data.medicalReport.diagnosticImpression}` : ""}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    const alerts = Array.isArray(parsed.alerts) ? parsed.alerts : [];

    return alerts
      .filter((a: any) => a.title && a.description && a.type)
      .map((a: any) => ({
        type: ["error", "warning", "info"].includes(a.type) ? a.type : "info",
        category: a.category || "General",
        title: a.title,
        description: a.description,
        probability: typeof a.probability === "number" ? Math.min(1, Math.max(0, a.probability)) : 0.5,
        severity: typeof a.severity === "number" ? Math.min(1, Math.max(0, a.severity)) : 0.5,
      })) as ClinicalAlert[];
  } catch (error) {
    console.error("Error generating clinical alerts:", error);
    throw new Error("Failed to generate clinical alerts");
  }
}

export interface AssistantContext {
  doctorName: string;
  patientName: string;
  patientAge?: number;
  patientGender?: string;
  patientAllergies?: string[];
  patientMedicalHistory?: string;
  consultationReason?: string;
  consultationType?: string;
  isNewPatient: boolean;
  previousConsultationsCount: number;
  previousConsultationsSummary?: string;
  currentClinicalRecord?: {
    chiefComplaint?: string;
    symptoms?: string[];
    diagnosis?: string;
    notes?: string;
  };
}

export async function generateAssistantWelcome(context: AssistantContext): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un asistente clínico inteligente para médicos en una plataforma de telemedicina chilena llamada Summari. Tu rol es apoyar al doctor durante y después de las consultas médicas.

Genera un mensaje de bienvenida conciso y profesional en español para el doctor. El mensaje debe:
1. Saludar al doctor por su nombre
2. Resumir brevemente quién es el paciente (edad, sexo si está disponible)
3. Indicar el motivo de consulta si está disponible
4. Mencionar si es paciente nuevo o recurrente (y cuántas consultas previas tiene)
5. Resaltar información clínica relevante (alergias, antecedentes importantes)
6. Ser directo y útil, como un briefing clínico rápido

Mantén el tono profesional pero cálido. No uses formato markdown extenso, solo texto plano con saltos de línea simples. Máximo 200 palabras.`
        },
        {
          role: "user",
          content: JSON.stringify(context),
        }
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    return response.choices[0]?.message?.content || "Bienvenido a la consulta.";
  } catch (error) {
    console.error("Error generating assistant welcome:", error);
    return `Hola Dr. ${context.doctorName}, bienvenido a la consulta con ${context.patientName}. ${context.consultationReason ? `Motivo: ${context.consultationReason}.` : ''} ${context.isNewPatient ? 'Es un paciente nuevo.' : `Paciente recurrente (${context.previousConsultationsCount} consultas previas).`}`;
  }
}

export async function chatWithAssistant(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  context: AssistantContext,
): Promise<string> {
  try {
    const systemMessage = `Eres un asistente clínico inteligente para médicos en una plataforma de telemedicina chilena llamada Summari.

Contexto del paciente actual:
- Nombre: ${context.patientName}
- Edad: ${context.patientAge ? `${context.patientAge} años` : 'No especificada'}
- Sexo: ${context.patientGender || 'No especificado'}
- Alergias: ${context.patientAllergies?.length ? context.patientAllergies.join(', ') : 'Ninguna registrada'}
- Antecedentes: ${context.patientMedicalHistory || 'Sin antecedentes registrados'}
- Motivo de consulta: ${context.consultationReason || 'No especificado'}
- Paciente ${context.isNewPatient ? 'nuevo' : `recurrente (${context.previousConsultationsCount} consultas previas)`}
${context.currentClinicalRecord ? `
Registro clínico actual:
- Motivo de consulta: ${context.currentClinicalRecord.chiefComplaint || 'No registrado'}
- Síntomas: ${context.currentClinicalRecord.symptoms?.join(', ') || 'No registrados'}
- Diagnóstico: ${context.currentClinicalRecord.diagnosis || 'Pendiente'}
- Notas: ${context.currentClinicalRecord.notes || 'Sin notas'}
` : ''}

Tu rol:
- Responder preguntas clínicas del doctor sobre el paciente
- Sugerir diagnósticos diferenciales cuando se te pregunte
- Ayudar con dosis de medicamentos, interacciones y contraindicaciones
- Recordar información del paciente cuando se necesite
- Ser conciso, profesional y útil
- Responder siempre en español
- NO diagnosticar por ti mismo, solo asistir al doctor
- Máximo 150 palabras por respuesta`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemMessage },
        ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    return response.choices[0]?.message?.content || "Lo siento, no pude procesar tu consulta.";
  } catch (error) {
    console.error("Error in assistant chat:", error);
    throw new Error("Failed to get assistant response");
  }
}
