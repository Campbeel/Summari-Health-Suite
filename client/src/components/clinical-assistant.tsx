import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { Bot, Send, Loader2, User, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ClinicalAssistantProps {
  appointmentId: string | number;
  className?: string;
}

export function ClinicalAssistant({ appointmentId, className = "" }: ClinicalAssistantProps) {
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
      const response = await apiRequest("POST", `/api/consultations/${appointmentId}/assistant/welcome`);
      return response.json();
    },
    onSuccess: (data) => {
      const welcomeMsg: Message = { role: "assistant", content: data.message };
      setMessages(prev => [welcomeMsg, ...prev]);
      setIsWelcomeLoaded(true);
    },
    onError: () => {
      const fallback: Message = { role: "assistant", content: "Hola, soy tu asistente clínico. ¿En qué puedo ayudarte?" };
      setMessages(prev => [fallback, ...prev]);
      setIsWelcomeLoaded(true);
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (allMessages: Message[]) => {
      const response = await apiRequest("POST", `/api/consultations/${appointmentId}/assistant/chat`, {
        messages: allMessages,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
    },
    onError: () => {
      setMessages(prev => [...prev, { role: "assistant", content: "Lo siento, hubo un error al procesar tu consulta. Intenta nuevamente." }]);
    },
  });

  useEffect(() => {
    if (!welcomeFetchedRef.current) {
      welcomeFetchedRef.current = true;
      welcomeMutation.mutate();
    }
  }, []);

  const sendMessage = () => {
    if (!input.trim() || chatMutation.isPending || !isWelcomeLoaded) return;
    const userMessage: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    chatMutation.mutate(updatedMessages);
  };

  return (
    <div className={`flex flex-col h-full ${className}`} data-testid="clinical-assistant">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <div className="relative h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
          <Sparkles className="h-2.5 w-2.5 text-primary absolute -top-0.5 -right-0.5" />
        </div>
        <div>
          <p className="text-sm font-medium leading-none">Asistente Clínico</p>
          <p className="text-[10px] text-muted-foreground">IA de apoyo médico</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3" data-testid="assistant-messages">
        {welcomeMutation.isPending && messages.length === 0 && (
          <div className="flex items-start gap-2">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="bg-muted rounded-lg rounded-tl-none px-3 py-2 max-w-[85%]">
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Preparando resumen...</span>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex items-start gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              msg.role === "assistant" ? "bg-primary/10" : "bg-secondary/10"
            }`}>
              {msg.role === "assistant" ? (
                <Bot className="h-3.5 w-3.5 text-primary" />
              ) : (
                <User className="h-3.5 w-3.5 text-secondary-foreground" />
              )}
            </div>
            <div className={`rounded-lg px-3 py-2 max-w-[85%] ${
              msg.role === "assistant"
                ? "bg-muted rounded-tl-none"
                : "bg-primary text-primary-foreground rounded-tr-none"
            }`}>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex items-start gap-2">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="bg-muted rounded-lg rounded-tl-none px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Pensando...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 p-2 border-t">
        <Input
          placeholder={isWelcomeLoaded ? "Pregunta al asistente..." : "Cargando..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          className="flex-1 h-8 text-sm"
          disabled={chatMutation.isPending || !isWelcomeLoaded}
          data-testid="input-assistant-message"
        />
        <Button
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={sendMessage}
          disabled={!input.trim() || chatMutation.isPending || !isWelcomeLoaded}
          data-testid="button-send-assistant"
        >
          {chatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
