import OpenAI from "openai";
import { randomUUID } from "crypto";
import type { LiveAssistSuggestion, SuggestionCategory } from "@shared/models/live-assist";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SEMANTIC_TRIGGERS = [
  "alergia", "alérgico", "alérgica",
  "dolor", "fiebre", "presión",
  "medicamento", "dosis", "mg", "ml",
  "embarazada", "embarazo", "lactancia",
  "diabetes", "hipertensión", "asma",
  "contraindicación", "reacción",
  "urgente", "emergencia", "grave",
  "sangrado", "disnea", "taquicardia",
  "pediátrico", "geriátrico", "niño", "anciano",
  "cirugía", "operación", "antecedente",
  "crónico", "crónica",
];

interface SessionState {
  appointmentId: number;
  lastAnalyzedText: string;
  lastAnalysisTime: number;
  recentSuggestions: Array<{ text: string; time: number }>;
  patientContext?: PatientContext;
  analysisCount: number;
}

interface PatientContext {
  name: string;
  allergies?: string[];
  medicalHistory?: string;
  age?: number;
  gender?: string;
}

const TIME_TRIGGER_INTERVAL = 10_000;
const COOLDOWN_MS = 30_000;
const MIN_NEW_CHARS = 50;

export class LiveAssistOrchestrator {
  private sessions = new Map<number, SessionState>();
  private onSuggestion: (suggestion: LiveAssistSuggestion) => void;

  constructor(onSuggestion: (suggestion: LiveAssistSuggestion) => void) {
    this.onSuggestion = onSuggestion;
  }

  initSession(appointmentId: number, patientContext?: PatientContext): void {
    this.sessions.set(appointmentId, {
      appointmentId,
      lastAnalyzedText: "",
      lastAnalysisTime: 0,
      recentSuggestions: [],
      patientContext,
      analysisCount: 0,
    });
  }

  async evaluateTranscript(appointmentId: number, cumulativeText: string): Promise<void> {
    const session = this.sessions.get(appointmentId);
    if (!session) return;

    const now = Date.now();
    const newText = cumulativeText.slice(session.lastAnalyzedText.length).trim();
    const timeSinceLastAnalysis = now - session.lastAnalysisTime;

    const hasEnoughNewContent = newText.length >= MIN_NEW_CHARS;
    const timeTriggered = timeSinceLastAnalysis >= TIME_TRIGGER_INTERVAL && newText.length > 20;
    const semanticTriggered = this.checkSemanticTriggers(newText);

    if (!hasEnoughNewContent && !timeTriggered && !semanticTriggered) {
      return;
    }

    session.lastAnalyzedText = cumulativeText;
    session.lastAnalysisTime = now;
    session.analysisCount++;

    try {
      const suggestions = await this.generateSuggestions(session, cumulativeText, newText);
      const filtered = this.filterDuplicates(session, suggestions);

      for (const suggestion of filtered) {
        session.recentSuggestions.push({ text: suggestion.recommendation, time: now });
        this.onSuggestion(suggestion);
      }

      session.recentSuggestions = session.recentSuggestions.filter(
        s => now - s.time < COOLDOWN_MS * 2
      );
    } catch (error) {
      console.error(`[LiveAssist] Error generating suggestions for appointment ${appointmentId}:`, error);
    }
  }

  private checkSemanticTriggers(text: string): boolean {
    const lower = text.toLowerCase();
    return SEMANTIC_TRIGGERS.some(trigger => lower.includes(trigger));
  }

  private filterDuplicates(session: SessionState, suggestions: LiveAssistSuggestion[]): LiveAssistSuggestion[] {
    const now = Date.now();
    return suggestions.filter(s => {
      const isDuplicate = session.recentSuggestions.some(recent => {
        if (now - recent.time > COOLDOWN_MS) return false;
        return this.textSimilarity(s.recommendation, recent.text) > 0.6;
      });
      return !isDuplicate;
    });
  }

  private textSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  private async generateSuggestions(
    session: SessionState,
    fullTranscript: string,
    recentText: string
  ): Promise<LiveAssistSuggestion[]> {
    const windowSize = 2000;
    const transcriptWindow = fullTranscript.length > windowSize
      ? fullTranscript.slice(-windowSize)
      : fullTranscript;

    const patientInfo = session.patientContext
      ? `\nPACIENTE: ${session.patientContext.name}${session.patientContext.age ? `, ${session.patientContext.age} años` : ""}${session.patientContext.gender ? `, ${session.patientContext.gender}` : ""}
ALERGIAS: ${session.patientContext.allergies?.join(", ") || "Sin alergias conocidas"}
ANTECEDENTES: ${session.patientContext.medicalHistory || "Sin antecedentes registrados"}`
      : "";

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un asistente clínico en tiempo real que ayuda al médico DURANTE una consulta. Tu rol es ÚNICAMENTE asistivo: sugerir, alertar y recordar, NUNCA dar diagnósticos definitivos ni ordenar acciones.

REGLAS ESTRICTAS:
1. Usa SIEMPRE lenguaje sugestivo: "Considere preguntar...", "Posible preocupación a verificar...", "Revise la guía de...", "Podría ser útil explorar..."
2. NUNCA uses lenguaje directivo: no digas "Prescriba...", "Diagnostique...", "El paciente tiene..."
3. Solo genera sugerencias cuando hay algo ÚTIL que aportar. Si la conversación es trivial o social, devuelve un array vacío.
4. Prioriza: alertas de seguridad del paciente > preguntas de seguimiento > recordatorios de guías clínicas
5. Sé conciso: cada recomendación debe ser 1-2 oraciones máximo.
${patientInfo}

Responde en JSON: { "suggestions": [{ "category": "follow_up_question" | "risk_flag" | "guideline_reminder" | "allergy_alert" | "dosage_check" | "differential_diagnosis" | "general", "confidence": 0.0-1.0, "recommendation": "texto", "priority": "low" | "medium" | "high" | "critical", "sourceSnippet": "fragmento relevante de la transcripción" }] }

Si no hay sugerencias relevantes, devuelve { "suggestions": [] }.
Responde siempre en español.`
        },
        {
          role: "user",
          content: `TRANSCRIPCIÓN EN CURSO DE LA CONSULTA (últimos fragmentos):\n\n${transcriptWindow}\n\nTEXTO NUEVO DESDE ÚLTIMA EVALUACIÓN:\n${recentText}\n\nGenera sugerencias asistivas si corresponde.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    try {
      const parsed = JSON.parse(content);
      const suggestions: LiveAssistSuggestion[] = (parsed.suggestions || [])
        .filter((s: any) => s.recommendation && s.recommendation.length > 10)
        .filter((s: any) => this.validateAssistiveLanguage(s.recommendation))
        .map((s: any) => ({
          type: "live_assist_suggestion" as const,
          id: randomUUID(),
          appointmentId: session.appointmentId,
          timestamp: Date.now(),
          category: s.category || "general",
          confidence: Math.min(1, Math.max(0, s.confidence || 0.5)),
          sourceSnippet: (s.sourceSnippet || "").slice(0, 200),
          recommendation: s.recommendation,
          priority: s.priority || "medium",
        }));
      return suggestions;
    } catch {
      return [];
    }
  }

  private validateAssistiveLanguage(text: string): boolean {
    const prohibited = [
      /^prescriba\b/i,
      /^diagnostique\b/i,
      /^administre\b/i,
      /^ordene\b/i,
      /el paciente tiene\b/i,
      /debe (prescribir|diagnosticar|administrar)/i,
      /tiene que (prescribir|recetar)/i,
    ];
    return !prohibited.some(pattern => pattern.test(text));
  }

  endSession(appointmentId: number): void {
    this.sessions.delete(appointmentId);
    console.log(`[LiveAssist] Session ended for appointment ${appointmentId}`);
  }

  isSessionActive(appointmentId: number): boolean {
    return this.sessions.has(appointmentId);
  }
}
