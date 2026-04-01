import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Clock, Video, Phone, User, Pill, ClipboardList, FlaskConical, FileText, AlertCircle, FileDown, Loader2, Mail, Send, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface ConsultationSummaryDialogProps {
  appointmentId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDoctor?: boolean;
}

export function ConsultationSummaryDialog({ appointmentId, open, onOpenChange, isDoctor = false }: ConsultationSummaryDialogProps) {
  const { toast } = useToast();
  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [selectedEmailDocs, setSelectedEmailDocs] = useState<Set<string>>(new Set());

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

  const hasPrescription = data?.prescription && data.prescription.medications?.length > 0;
  const hasInstructions = data?.medicalInstructions && data.medicalInstructions.length > 0;
  const hasExams = data?.examOrders && data.examOrders.exams?.length > 0;
  const hasDocuments = hasPrescription || hasInstructions || hasExams;

  const handleDownloadPdf = async (types: string) => {
    if (!appointmentId) return;
    setDownloadingType(types);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/consultations/${appointmentId}/documents/pdf?types=${types}`, {
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
      const typeLabel = types.includes(',') ? 'documentos' : 
        types === 'prescription' ? 'receta' :
        types === 'instructions' ? 'indicaciones' : 'examenes';
      a.download = `${typeLabel}_consulta_${appointmentId}.pdf`;
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
      setDownloadingType(null);
    }
  };

  const toggleEmailDoc = (type: string) => {
    setSelectedEmailDocs(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
    setEmailSent(false);
  };

  const handleSendEmail = async () => {
    if (!appointmentId || selectedEmailDocs.size === 0) return;
    setSendingEmail(true);
    setEmailSent(false);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/consultations/${appointmentId}/send-documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentTypes: Array.from(selectedEmailDocs) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error al enviar" }));
        throw new Error(err.error);
      }
      const result = await res.json();
      setEmailSent(true);
      toast({
        title: "Documentos enviados",
        description: `Enviados al correo de ${data?.patient?.name || 'paciente'}`,
      });
    } catch (err: any) {
      toast({
        title: "Error al enviar",
        description: err.message || "No se pudieron enviar los documentos",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) {
        setSelectedEmailDocs(new Set());
        setEmailSent(false);
      }
      onOpenChange(v);
    }}>
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

            {data && <SummaryContent data={data} isDoctor={isDoctor} />}

            {data && hasDocuments && (
              <Card data-testid="card-document-actions">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileDown className="h-5 w-5 text-primary" />
                    Documentos
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="grid gap-2">
                    {hasPrescription && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        onClick={() => handleDownloadPdf('prescription')}
                        disabled={downloadingType === 'prescription'}
                        data-testid="btn-download-prescription"
                      >
                        {downloadingType === 'prescription' ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Pill className="h-4 w-4 mr-2" />
                        )}
                        Descargar Receta (PDF)
                      </Button>
                    )}
                    {hasInstructions && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        onClick={() => handleDownloadPdf('instructions')}
                        disabled={downloadingType === 'instructions'}
                        data-testid="btn-download-instructions"
                      >
                        {downloadingType === 'instructions' ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ClipboardList className="h-4 w-4 mr-2" />
                        )}
                        Descargar Indicaciones (PDF)
                      </Button>
                    )}
                    {hasExams && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        onClick={() => handleDownloadPdf('exams')}
                        disabled={downloadingType === 'exams'}
                        data-testid="btn-download-exams"
                      >
                        {downloadingType === 'exams' ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FlaskConical className="h-4 w-4 mr-2" />
                        )}
                        Descargar Órdenes de Exámenes (PDF)
                      </Button>
                    )}
                    {(hasPrescription ? 1 : 0) + (hasInstructions ? 1 : 0) + (hasExams ? 1 : 0) > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        onClick={() => handleDownloadPdf('prescription,instructions,exams')}
                        disabled={downloadingType === 'prescription,instructions,exams'}
                        data-testid="btn-download-all"
                      >
                        {downloadingType === 'prescription,instructions,exams' ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileDown className="h-4 w-4 mr-2" />
                        )}
                        Descargar Todos (PDF)
                      </Button>
                    )}
                  </div>

                  {isDoctor && (
                    <div className="border-t pt-3 mt-3 space-y-3" data-testid="section-resend-email">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4 text-primary" />
                        Enviar documentos por email al paciente
                      </p>
                      <div className="space-y-2">
                        {hasPrescription && (
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={selectedEmailDocs.has('prescription')}
                              onCheckedChange={() => toggleEmailDoc('prescription')}
                              data-testid="check-email-prescription"
                            />
                            <Pill className="h-3.5 w-3.5 text-muted-foreground" />
                            Receta Médica
                          </label>
                        )}
                        {hasInstructions && (
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={selectedEmailDocs.has('instructions')}
                              onCheckedChange={() => toggleEmailDoc('instructions')}
                              data-testid="check-email-instructions"
                            />
                            <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                            Indicaciones Médicas
                          </label>
                        )}
                        {hasExams && (
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={selectedEmailDocs.has('exams')}
                              onCheckedChange={() => toggleEmailDoc('exams')}
                              data-testid="check-email-exams"
                            />
                            <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
                            Órdenes de Exámenes
                          </label>
                        )}
                      </div>
                      {emailSent ? (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400" data-testid="text-email-sent">
                          <CheckCircle2 className="h-4 w-4" />
                          Documentos enviados al correo del paciente
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={handleSendEmail}
                          disabled={sendingEmail || selectedEmailDocs.size === 0}
                          data-testid="btn-send-email"
                        >
                          {sendingEmail ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          Enviar por email
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SummaryContent({ data, isDoctor = false }: { data: SummaryData; isDoctor?: boolean }) {
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

      {isDoctor && clinicalRecord && (
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
