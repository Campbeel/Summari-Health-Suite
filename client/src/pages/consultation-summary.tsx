import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Calendar, Clock, Video, Phone, User, Pill, ClipboardList, FlaskConical, FileText, AlertCircle, FileDown, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface SummaryData {
  appointment: {
    id: number;
    scheduledDate: string;
    scheduledTime: string;
    status: string;
    consultationType: string;
    notes: string | null;
  };
  doctor: {
    name: string;
    specialty: string;
  };
  patient: {
    name: string;
    gender: string | null;
    bloodType: string | null;
    allergies: string[] | null;
  };
  clinicalRecord: {
    chiefComplaint: string | null;
    symptoms: string[] | null;
    diagnosis: string | null;
    notes: string | null;
  } | null;
  prescription: {
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions?: string;
    }>;
    instructions: string | null;
  } | null;
  medicalInstructions: Array<{
    category: string;
    title: string;
    description: string;
    priority: string;
  }>;
  examOrders: {
    exams: Array<{
      name: string;
      instructions?: string;
    }>;
    clinicalJustification: string | null;
  } | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  diet: "Alimentación",
  exercise: "Ejercicio",
  lifestyle: "Estilo de vida",
  "follow-up": "Seguimiento",
  tests: "Exámenes",
};

const PRIORITY_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Baja", variant: "secondary" },
  normal: { label: "Normal", variant: "default" },
  high: { label: "Alta", variant: "destructive" },
  urgent: { label: "Urgente", variant: "destructive" },
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Completada",
  pending_validation: "Pendiente de validación",
  cancelled: "Cancelada",
  scheduled: "Agendada",
  in_progress: "En progreso",
};

export default function ConsultationSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading, error } = useQuery<SummaryData>({
    queryKey: ["/api/consultations", id, "summary"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/consultations/${id}/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar resumen");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6" data-testid="summary-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6" data-testid="summary-error">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/appointments"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="text-2xl font-bold">Error</h1>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No se pudo cargar el resumen de la consulta.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { appointment, doctor, patient, clinicalRecord, prescription, medicalInstructions, examOrders } = data;
  const hasPrescription = prescription && prescription.medications?.length > 0;
  const hasInstructions = medicalInstructions && medicalInstructions.length > 0;
  const hasExams = examOrders && examOrders.exams?.length > 0;
  const hasDocuments = hasPrescription || hasInstructions || hasExams;

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/consultations/${id}/documents/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error al generar PDF" }));
        throw new Error(err.error);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consulta_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({
        title: "Error al descargar",
        description: err.message || "No se pudo generar el PDF",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6" data-testid="consultation-summary">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild data-testid="btn-back">
            <Link href="/appointments"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-title">Resumen de Consulta</h1>
            <p className="text-muted-foreground text-sm">
              {format(parseISO(appointment.scheduledDate), "EEEE d 'de' MMMM, yyyy", { locale: es })}
            </p>
          </div>
        </div>
        {hasDocuments && (
          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={downloading}
            data-testid="btn-download-pdf"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Descargar PDF
          </Button>
        )}
      </div>

      <Card data-testid="card-appointment-info">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <span className="font-semibold text-lg" data-testid="text-doctor-name">Dr. {doctor.name}</span>
              </div>
              <p className="text-muted-foreground ml-7" data-testid="text-specialty">{doctor.specialty}</p>
              <div className="flex flex-wrap gap-3 ml-7 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(parseISO(appointment.scheduledDate), "dd/MM/yyyy")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {appointment.scheduledTime.slice(0, 5)}
                </span>
                <span className="flex items-center gap-1">
                  {appointment.consultationType === "video" ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                  {appointment.consultationType === "video" ? "Videollamada" : "Llamada"}
                </span>
              </div>
            </div>
            <Badge variant={appointment.status === "completed" ? "default" : "secondary"} className="self-start" data-testid="badge-status">
              {STATUS_LABELS[appointment.status] || appointment.status}
            </Badge>
          </div>
          {appointment.notes && (
            <p className="mt-3 text-sm bg-muted/50 rounded-md p-3" data-testid="text-notes">
              <strong>Motivo:</strong> {appointment.notes}
            </p>
          )}
        </CardContent>
      </Card>

      {clinicalRecord && (
        <Card data-testid="card-clinical-record">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Registro Clínico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {clinicalRecord.chiefComplaint && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Motivo de consulta</p>
                <p data-testid="text-chief-complaint">{clinicalRecord.chiefComplaint}</p>
              </div>
            )}
            {clinicalRecord.symptoms && clinicalRecord.symptoms.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Síntomas</p>
                <div className="flex flex-wrap gap-2" data-testid="list-symptoms">
                  {clinicalRecord.symptoms.map((s, i) => (
                    <Badge key={i} variant="outline">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            {clinicalRecord.diagnosis && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Diagnóstico</p>
                <p data-testid="text-diagnosis">{clinicalRecord.diagnosis}</p>
              </div>
            )}
            {clinicalRecord.notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Notas clínicas</p>
                <p className="text-sm" data-testid="text-clinical-notes">{clinicalRecord.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hasPrescription && (
        <Card data-testid="card-prescription">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Pill className="h-5 w-5 text-primary" />
              Receta Médica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {prescription!.medications.map((med, i) => (
                <div key={i} className="border rounded-lg p-3" data-testid={`medication-${i}`}>
                  <p className="font-semibold">{med.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                    <span><strong>Dosis:</strong> {med.dosage}</span>
                    <span><strong>Frecuencia:</strong> {med.frequency}</span>
                    <span><strong>Duración:</strong> {med.duration}</span>
                  </div>
                  {med.instructions && (
                    <p className="mt-1 text-sm text-muted-foreground italic">→ {med.instructions}</p>
                  )}
                </div>
              ))}
            </div>
            {prescription!.instructions && (
              <div className="mt-3 p-3 bg-primary/5 rounded-md border-l-3 border-primary">
                <p className="text-sm"><strong>Instrucciones generales:</strong> {prescription!.instructions}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hasInstructions && (
        <Card data-testid="card-instructions">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5 text-primary" />
              Indicaciones Médicas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {medicalInstructions.map((instr, i) => {
                const priorityCfg = PRIORITY_CONFIG[instr.priority] || PRIORITY_CONFIG.normal;
                return (
                  <div key={i} className="border rounded-lg p-3" data-testid={`instruction-${i}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold">{instr.title}</p>
                      <div className="flex gap-1.5">
                        <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[instr.category] || instr.category}</Badge>
                        <Badge variant={priorityCfg.variant} className="text-xs">{priorityCfg.label}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{instr.description}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {hasExams && (
        <Card data-testid="card-exams">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FlaskConical className="h-5 w-5 text-primary" />
              Órdenes de Exámenes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {examOrders!.exams.map((exam, i) => (
                <div key={i} className="border rounded-lg p-3" data-testid={`exam-${i}`}>
                  <p className="font-semibold">{exam.name}</p>
                  {exam.instructions && (
                    <p className="text-sm text-muted-foreground mt-1 italic">Preparación: {exam.instructions}</p>
                  )}
                </div>
              ))}
            </div>
            {examOrders!.clinicalJustification && (
              <div className="mt-3 p-3 bg-muted/50 rounded-md">
                <p className="text-sm"><strong>Justificación clínica:</strong> {examOrders!.clinicalJustification}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!clinicalRecord && !hasPrescription && !hasInstructions && !hasExams && (
        <Card data-testid="card-no-records">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {appointment.status === "pending_validation"
                ? "El doctor aún no ha validado la información clínica de esta consulta."
                : "No hay registros clínicos disponibles para esta consulta."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
