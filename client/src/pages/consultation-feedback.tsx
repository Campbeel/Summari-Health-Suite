import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Star,
  CheckCircle2,
  FileText,
  ClipboardList,
  Pill,
  ArrowLeft,
  Send,
  Loader2,
  Stethoscope,
  Monitor
} from "lucide-react";

function StarRating({ value, onChange, size = "lg", prefix = "" }: { value: number; onChange: (v: number) => void; size?: "sm" | "lg"; prefix?: string }) {
  const [hover, setHover] = useState(0);
  const starSize = size === "lg" ? "h-8 w-8" : "h-6 w-6";

  return (
    <div className="flex gap-1" data-testid="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-colors"
          data-testid={`${prefix}star-${star}`}
        >
          <Star
            className={`${starSize} transition-colors ${
              star <= (hover || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ConsultationFeedbackPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [doctorRating, setDoctorRating] = useState(0);
  const [doctorComment, setDoctorComment] = useState("");
  const [platformRating, setPlatformRating] = useState(0);
  const [platformComment, setPlatformComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => navigate("/appointments"), 15000);
    return () => clearTimeout(timer);
  }, [submitted, navigate]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/consultations/${id}/rating`, {
        doctorRating,
        doctorComment: doctorComment.trim() || null,
        platformRating: platformRating || null,
        platformComment: platformComment.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar la calificación. Inténtalo nuevamente.",
        variant: "destructive",
      });
    },
  });

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-background/80 backdrop-blur-md shrink-0">
          <div />
          <ThemeToggle />
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-lg w-full text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold" data-testid="text-thank-you">¡Gracias por tu opinión!</h1>
            <p className="text-muted-foreground">
              Tu calificación nos ayuda a mejorar la experiencia de atención médica.
            </p>

            <Card className="text-left">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Ficha clínica</p>
                    <p className="text-xs text-muted-foreground">El resumen de tu consulta estará disponible en "Mis Fichas Clínicas"</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Pill className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Recetas médicas</p>
                    <p className="text-xs text-muted-foreground">Tus recetas estarán disponibles en "Mis Recetas"</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <ClipboardList className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Indicaciones e instrucciones</p>
                    <p className="text-xs text-muted-foreground">Las indicaciones del médico estarán disponibles junto a tu ficha clínica</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <p className="text-sm text-muted-foreground italic">
              El médico está completando la documentación de tu consulta. Los documentos estarán disponibles dentro de la plataforma una vez que el médico los finalice.
            </p>

            <Button onClick={() => navigate("/appointments")} className="w-full" data-testid="button-go-appointments">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Ir a mis consultas
            </Button>
            <p className="text-xs text-muted-foreground" data-testid="text-auto-redirect">
              Serás redirigido automáticamente en unos segundos...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-background/80 backdrop-blur-md shrink-0">
        <div />
        <ThemeToggle />
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold" data-testid="text-consultation-ended">Consulta finalizada</h1>
            <p className="text-muted-foreground text-sm">
              Cuéntanos cómo fue tu experiencia
            </p>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Califica a tu médico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <StarRating value={doctorRating} onChange={setDoctorRating} prefix="doctor-" />
              <Textarea
                placeholder="¿Cómo fue la atención del médico? (opcional)"
                value={doctorComment}
                onChange={(e) => setDoctorComment(e.target.value)}
                className="min-h-[80px] resize-none"
                data-testid="input-doctor-comment"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                Califica la plataforma
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <StarRating value={platformRating} onChange={setPlatformRating} size="sm" prefix="platform-" />
              <Textarea
                placeholder="¿Cómo fue tu experiencia con la plataforma? (opcional)"
                value={platformComment}
                onChange={(e) => setPlatformComment(e.target.value)}
                className="min-h-[80px] resize-none"
                data-testid="input-platform-comment"
              />
            </CardContent>
          </Card>

          <Card className="bg-muted/50 border-dashed">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Documentos de tu consulta</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    El médico está completando la ficha clínica, recetas e indicaciones de tu consulta.
                    Estarán disponibles dentro de la plataforma una vez que el médico los finalice.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/appointments")}
              className="flex-1"
              data-testid="button-skip-rating"
            >
              Omitir
            </Button>
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={doctorRating === 0 || submitMutation.isPending}
              className="flex-1"
              data-testid="button-submit-rating"
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar calificación
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
