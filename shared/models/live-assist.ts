export interface LiveAudioChunkMessage {
  type: "live_audio_chunk";
  appointmentId: number;
  chunkIndex: number;
  audioData: string;
  mimeType: string;
  timestamp: number;
}

export interface LiveTranscriptDelta {
  type: "live_transcript_delta";
  appointmentId: number;
  chunkIndex: number;
  text: string;
  cumulativeText: string;
  timestamp: number;
}

export type SuggestionCategory =
  | "follow_up_question"
  | "risk_flag"
  | "guideline_reminder"
  | "allergy_alert"
  | "dosage_check"
  | "differential_diagnosis"
  | "general";

export interface LiveAssistSuggestion {
  type: "live_assist_suggestion";
  id: string;
  appointmentId: number;
  timestamp: number;
  category: SuggestionCategory;
  confidence: number;
  sourceSnippet: string;
  recommendation: string;
  priority: "low" | "medium" | "high" | "critical";
}

export interface LiveAssistStatus {
  type: "live_assist_status";
  appointmentId: number;
  status: "active" | "paused" | "error" | "stopped";
  message?: string;
  timestamp: number;
}

export interface LiveAssistDismiss {
  type: "live_assist_dismiss";
  appointmentId: number;
  suggestionId: string;
}

export interface LiveAssistAcknowledge {
  type: "live_assist_acknowledge";
  appointmentId: number;
  suggestionId: string;
}
