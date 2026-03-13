import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Clock, Video, Phone, User, Pill, ClipboardList, FlaskConical, FileText, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface ConsultationSummaryDialogProps {
  appointmentId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConsultationSummaryDialog({ appointmentId, open, onOpenChange }: ConsultationSummaryDialogProps) {
  const { data, isLoading, error } = useQuery<SummaryData>({
    queryKey: ["/api/consultations", appointmentId, "summary"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/consultations/${appointmentId}/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar resumen");
      return res.json();
    },
    enabled: open && appointmentId !== null,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0" data-testid="consultation-summary-dialog">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-xl" data-testid="text-dialog-title">Resumen de Consulta</DialogTitle>
        </DialogHeader>
        <ScrollArea className="px-6 pb-6 max-h-[calc(85vh-80px)]">
          <div className="space-y-5 pr-2 pt-2">
            {isLoading && (
              <div className="space-y-4" data-testid="summary-dialog-loading">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-36 w-full" />
                <Skeleton className="h-36 w-full" />
              </div>
            )}

            {(error || (!isLoading && !data)) && (
              <div className="text-center py-8" data-testid="summary-dialog-error">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No se pudo cargar el resumen de la consulta.</p>
              </div>
            )}

            {data && <SummaryContent data={data} />}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SummaryContent({ data }: { data: SummaryData }) {
  const { appointment, doctor, patient, clinicalRecord, prescription, medicalInstructions, examOrders } = data;
  const hasPrescription = prescription && prescription.medications?.length > 0;
  const hasInstructions = medicalInstructions && medicalInstructions.length > 0;
  const hasExams = examOrders && examOrders.exams?.length > 0;

  return (
    <>
      <Card data-testid="card-appointment-info">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="space-y-1.5">
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
            <p className="mt-3 text-sm bg-muted/50 rounded-md p-2" data-testid="text-notes">
              <strong>Motivo:</strong> {appointment.notes}
            </p>
          )}
        </CardContent>
      </Card>

      {clinicalRecord && (
        <Card data-testid="card-clinical-record">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              Registro Clínico
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {clinicalRecord.chiefComplaint && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-0.5">Motivo de consulta</p>
                <p className="text-sm" data-testid="text-chief-complaint">{clinicalRecord.chiefComplaint}</p>
              </div>
            )}
            {clinicalRecord.symptoms && clinicalRecord.symptoms.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Síntomas</p>
                <div className="flex flex-wrap gap-1.5" data-testid="list-symptoms">
                  {clinicalRecord.symptoms.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            {clinicalRecord.diagnosis && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-0.5">Diagnóstico</p>
                <p className="text-sm" data-testid="text-diagnosis">{clinicalRecord.diagnosis}</p>
              </div>
            )}
            {clinicalRecord.notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-0.5">Notas clínicas</p>
                <p className="text-sm" data-testid="text-clinical-notes">{clinicalRecord.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hasPrescription && (
        <Card data-testid="card-prescription">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Pill className="h-5 w-5 text-primary" />
              Receta Médica
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {prescription!.medications.map((med, i) => (
                <div key={i} className="border rounded-lg p-2.5" data-testid={`medication-${i}`}>
                  <p className="font-semibold text-sm">{med.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                    <span><strong>Dosis:</strong> {med.dosage}</span>
                    <span><strong>Frecuencia:</strong> {med.frequency}</span>
                    <span><strong>Duración:</strong> {med.duration}</span>
                  </div>
                  {med.instructions && (
                    <p className="mt-0.5 text-xs text-muted-foreground italic">→ {med.instructions}</p>
                  )}
                </div>
              ))}
            </div>
            {prescription!.instructions && (
              <div className="mt-2 p-2 bg-primary/5 rounded-md border-l-3 border-primary">
                <p className="text-xs"><strong>Instrucciones generales:</strong> {prescription!.instructions}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hasInstructions && (
        <Card data-testid="card-instructions">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5 text-primary" />
              Indicaciones Médicas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {medicalInstructions.map((instr, i) => {
                const priorityCfg = PRIORITY_CONFIG[instr.priority] || PRIORITY_CONFIG.normal;
                return (
                  <div key={i} className="border rounded-lg p-2.5" data-testid={`instruction-${i}`}>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="font-semibold text-sm">{instr.title}</p>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-[10px] px-1.5">{CATEGORY_LABELS[instr.category] || instr.category}</Badge>
                        <Badge variant={priorityCfg.variant} className="text-[10px] px-1.5">{priorityCfg.label}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{instr.description}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {hasExams && (
        <Card data-testid="card-exams">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-5 w-5 text-primary" />
              Órdenes de Exámenes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {examOrders!.exams.map((exam, i) => (
                <div key={i} className="border rounded-lg p-2.5" data-testid={`exam-${i}`}>
                  <p className="font-semibold text-sm">{exam.name}</p>
                  {exam.instructions && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">Preparación: {exam.instructions}</p>
                  )}
                </div>
              ))}
            </div>
            {examOrders!.clinicalJustification && (
              <div className="mt-2 p-2 bg-muted/50 rounded-md">
                <p className="text-xs"><strong>Justificación clínica:</strong> {examOrders!.clinicalJustification}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!clinicalRecord && !hasPrescription && !hasInstructions && !hasExams && (
        <div className="text-center py-6" data-testid="card-no-records">
          <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {appointment.status === "pending_validation"
              ? "El doctor aún no ha validado la información clínica de esta consulta."
              : "No hay registros clínicos disponibles para esta consulta."}
          </p>
        </div>
      )}
    </>
  );
}
