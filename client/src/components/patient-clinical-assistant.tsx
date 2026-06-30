import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { Bot, Send, Loader2, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PatientClinicalAssistantProps {
  patientId: number;
  className?: string;
}

export function PatientClinicalAssistant({ patientId, className = "" }: PatientClinicalAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isWelcomeLoaded, setIsWelcomeLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const welcomeFetchedRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const welcomeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/staff/patients/${patientId}/assistant/welcome`);
      return response.json();
    },
    onSuccess: (data) => {
      setMessages([{ role: "assistant", content: data.message }]);
      setIsWelcomeLoaded(true);
    },
    onError: () => {
      setMessages([{
        role: "assistant",
        content: "Hola. Puedo ayudarte con un resumen del paciente, alertas y recomendaciones. ¿Qué necesitas?",
      }]);
      setIsWelcomeLoaded(true);
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (allMessages: Message[]) => {
      const response = await apiRequest("POST", `/api/staff/patients/${patientId}/assistant/chat`, {
        messages: allMessages,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "No pude procesar la consulta. Intenta de nuevo." },
      ]);
    },
  });

  useEffect(() => {
    if (!welcomeFetchedRef.current && patientId > 0) {
      welcomeFetchedRef.current = true;
      welcomeMutation.mutate();
    }
  }, [patientId]);

  const sendMessage = () => {
    if (!input.trim() || chatMutation.isPending || !isWelcomeLoaded) return;
    const userMessage: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    chatMutation.mutate(updatedMessages);
  };

  return (
    <div className={`flex flex-col border rounded-lg bg-card ${className}`} data-testid="patient-clinical-assistant">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <div className="relative h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
          <Sparkles className="h-2.5 w-2.5 text-primary absolute -top-0.5 -right-0.5" />
        </div>
        <div>
          <p className="text-sm font-medium leading-none">Asistente del residente</p>
          <p className="text-[10px] text-muted-foreground">Resumen y avisos del residente</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[280px] max-h-[400px]">
        {welcomeMutation.isPending && messages.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>

      <div className="p-2 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pide un resumen, alertas o recomendaciones..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          disabled={!isWelcomeLoaded || chatMutation.isPending}
          data-testid="input-patient-assistant"
        />
        <Button
          size="icon"
          onClick={sendMessage}
          disabled={!input.trim() || chatMutation.isPending || !isWelcomeLoaded}
          data-testid="button-patient-assistant-send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
