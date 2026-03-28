import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Shield,
  Pill,
  Stethoscope,
  Info,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  Activity,
} from "lucide-react";
import type { LiveAssistSuggestion } from "@shared/models/live-assist";

interface LiveAssistPanelProps {
  suggestions: LiveAssistSuggestion[];
  liveTranscript: string;
  status: "active" | "paused" | "error" | "stopped" | "idle";
  onDismiss: (id: string) => void;
  onAcknowledge: (id: string) => void;
}

const categoryConfig: Record<string, { icon: typeof AlertTriangle; label: string; color: string }> = {
  follow_up_question: { icon: HelpCircle, label: "Pregunta sugerida", color: "text-blue-600 dark:text-blue-400" },
  risk_flag: { icon: AlertTriangle, label: "Alerta de riesgo", color: "text-red-600 dark:text-red-400" },
  guideline_reminder: { icon: Info, label: "Recordatorio", color: "text-amber-600 dark:text-amber-400" },
  allergy_alert: { icon: Shield, label: "Alergia", color: "text-red-700 dark:text-red-300" },
  dosage_check: { icon: Pill, label: "Dosificación", color: "text-orange-600 dark:text-orange-400" },
  differential_diagnosis: { icon: Stethoscope, label: "Diagnóstico diferencial", color: "text-purple-600 dark:text-purple-400" },
  general: { icon: Info, label: "General", color: "text-gray-600 dark:text-gray-400" },
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300 dark:border-orange-700",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300 dark:border-blue-700",
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300 border-gray-300 dark:border-gray-700",
};

export function LiveAssistPanel({ suggestions, liveTranscript, status, onDismiss, onAcknowledge }: LiveAssistPanelProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  const visibleSuggestions = suggestions
    .filter(s => !dismissedIds.has(s.id))
    .sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const pa = priorityOrder[a.priority] ?? 2;
      const pb = priorityOrder[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return b.timestamp - a.timestamp;
    });

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
    onDismiss(id);
  };

  const handleAcknowledge = (id: string) => {
    setAcknowledgedIds(prev => new Set(prev).add(id));
    onAcknowledge(id);
  };

  return (
    <div className="flex flex-col h-full" data-testid="live-assist-panel">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Asistente en Vivo</span>
          {status === "active" && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          )}
        </div>
        {visibleSuggestions.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {visibleSuggestions.length}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {status === "active" && visibleSuggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/40 mb-2 animate-pulse" />
              <p className="text-xs text-muted-foreground">
                Escuchando consulta...
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Las sugerencias aparecerán cuando se detecte información clínica relevante
              </p>
            </div>
          )}

          {status === "idle" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Zap className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">
                El asistente en vivo se activará al iniciar la grabación
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">
                Error en el asistente en vivo. La consulta continúa normalmente.
              </p>
            </div>
          )}

          {visibleSuggestions.map((suggestion, idx) => {
            const config = categoryConfig[suggestion.category] || categoryConfig.general;
            const Icon = config.icon;
            const isAcknowledged = acknowledgedIds.has(suggestion.id);
            const isNew = Date.now() - suggestion.timestamp < 5000;

            return (
              <div
                key={suggestion.id}
                className={`relative rounded-lg border p-2.5 transition-all ${
                  priorityColors[suggestion.priority] || priorityColors.medium
                } ${isNew ? "animate-in fade-in slide-in-from-top-2 duration-300" : ""} ${
                  isAcknowledged ? "opacity-60" : ""
                }`}
                data-testid={`live-assist-suggestion-${idx}`}
              >
                <div className="flex items-start gap-2">
                  <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
                        {config.label}
                      </span>
                      {suggestion.confidence >= 0.8 && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                          Alta confianza
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed">{suggestion.recommendation}</p>
                    {suggestion.sourceSnippet && (
                      <p className="text-[10px] opacity-50 mt-1 italic leading-tight">
                        "{suggestion.sourceSnippet}"
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 shrink-0 opacity-50 hover:opacity-100"
                    onClick={() => handleDismiss(suggestion.id)}
                    data-testid={`dismiss-suggestion-${idx}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                {!isAcknowledged && (
                  <div className="flex justify-end mt-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[10px] px-2 opacity-60 hover:opacity-100"
                      onClick={() => handleAcknowledge(suggestion.id)}
                      data-testid={`ack-suggestion-${idx}`}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Enterado
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {liveTranscript && (
        <div className="border-t">
          <button
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
            onClick={() => setShowTranscript(!showTranscript)}
            data-testid="toggle-live-transcript"
          >
            <span>Transcripción en vivo</span>
            {showTranscript ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
          {showTranscript && (
            <ScrollArea className="max-h-32 px-3 pb-2">
              <p className="text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap" data-testid="live-transcript-text">
                {liveTranscript}
              </p>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
