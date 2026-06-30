import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SpeechTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
  "data-testid"?: string;
}

export function SpeechTextarea({
  value,
  onChange,
  placeholder,
  rows = 8,
  id,
  "data-testid": testId,
}: SpeechTextareaProps) {
  const { toast } = useToast();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleListen = () => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      toast({
        title: "No disponible",
        description: "Tu navegador no soporta dictado por voz. Usa Chrome o Edge.",
        variant: "destructive",
      });
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "es-CL";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: { resultIndex: number; results: { length: number; [i: number]: { [j: number]: { transcript: string } } } }) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript.trim()) {
        onChange(value ? `${value.trimEnd()}\n${transcript.trim()}` : transcript.trim());
      }
    };

    recognition.onerror = () => {
      setListening(false);
      toast({ title: "Error de dictado", description: "No se pudo capturar audio.", variant: "destructive" });
    };

    recognition.onend = () => setListening(false);

    recognition.start();
    setListening(true);
  };

  return (
    <div className="space-y-2">
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        data-testid={testId}
      />
      <Button
        type="button"
        variant={listening ? "destructive" : "outline"}
        size="sm"
        onClick={toggleListen}
        data-testid="button-speech-dictation"
      >
        {listening ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            <MicOff className="h-4 w-4 mr-1" />
            Detener escucha
          </>
        ) : (
          <>
            <Mic className="h-4 w-4 mr-2" />
            Escuchar (dictado)
          </>
        )}
      </Button>
    </div>
  );
}
