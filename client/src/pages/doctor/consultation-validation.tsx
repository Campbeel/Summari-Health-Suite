import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText,
  Pill,
  ClipboardList,
  Check,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  User,
  Save,
  FlaskConical,
  Eye,
  Mail,
  Send,
  CheckCircle,
  ShieldAlert,
  Info,
  RefreshCw,
  Bot,
  Heart,
  Phone,
  Search,
  X,
  Shield,
  Sparkles,
} from "lucide-react";
import { ClinicalAssistant } from "@/components/clinical-assistant";
import { SigningPanel } from "@/components/signing-panel";
import type { ReportTemplate } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

interface MedicalInstructionDraft {
  category: string;
  title: string;
  description: string;
  priority: string;
  dueDate?: string;
}

interface Exam {
  name: string;
  justification: string;
}

interface GesDiagnosis {
  idProblema: number;
  problemaDeSalud: string;
  codigoCie10: string;
  descriptor: string;
}

interface ValidationData {
  appointment: {
    id: number;
    scheduledDate: string;
    scheduledTime: string;
    status: string;
    consultationType: string;
    notes?: string;
  };
  patient: {
    id: number;
    name: string;
    rut?: string;
    email?: string;
    whatsapp?: string;
    dateOfBirth?: string;
    gender?: string;
    bloodType?: string;
    allergies?: string[];
    medicalHistory?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
  };
  clinicalRecord: {
    id: number;
    chiefComplaint?: string;
    symptoms?: string[];
    clinicalDiagnosis?: string;
    diagnosis?: string;
    notes?: string;
    gesDiagnosis?: GesDiagnosis[] | null;
    medicalReport?: {
      patientData: {
        fullName: string;
        age: number | null;
        sex: string;
        maritalStatus: string;
        occupation: string;
        location: string;
      };
      consultationData: {
        reason: string;
        currentIllness: {
          description: string;
          onset: string;
          duration: string;
          associatedSymptoms: string;
          modifyingFactors: string;
          previousTreatments: string;
        };
      };
      medicalHistory: {
        medical: string;
        surgical: string;
        allergies: string;
        medications: string;
        toxicological: string;
        gynecological: string | null;
        socioeconomic: string;
        pets: string;
      };
      familyHistory: string;
      habits: {
        diet: string;
        physicalActivity: string;
        sleep: string;
        substanceUse: string;
      };
      systemsReview: string;
      physicalExam: {
        systemsExploration: string;
      };
      diagnosticImpression: string;
      treatmentPlan: {
        tests: string[];
        treatment: string;
        instructions: string[];
      };
    } | null;
  };
  prescription: {
    medications: Medication[];
  } | null;
  medicalInstructions: MedicalInstructionDraft[];
  examOrders: {
    exams: Exam[];
  } | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  diet: "Alimentación",
  exercise: "Ejercicio",
  lifestyle: "Estilo de vida",
  "follow-up": "Seguimiento",
  tests: "Exámenes",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

function AlertWarningDialog({ isOpen, onOpenChange, onConfirm, alerts }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  alerts: { type: string; title: string; description: string; severity: number; probability: number; category: string }[];
}) {
  const [countdown, setCountdown] = useState(0);
  const highSeverityAlerts = alerts.filter(a => (a.type === "error" || a.type === "warning") && (a.severity >= 0.6 || a.probability >= 0.6));
  const hasHighAlerts = highSeverityAlerts.length > 0;

  useEffect(() => {
    if (isOpen && hasHighAlerts) {
      setCountdown(5);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setCountdown(0);
    }
  }, [isOpen, hasHighAlerts]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasHighAlerts ? (
              <>
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Advertencias detectadas
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                ¿Confirmar validación?
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        {hasHighAlerts ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Se detectaron las siguientes alertas importantes. Revísalas antes de continuar:
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {highSeverityAlerts.map((alert, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 text-xs ${
                    alert.type === "error"
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-orange-500/50 bg-orange-500/5"
                  }`}
                  data-testid={`warning-dialog-alert-${i}`}
                >
                  <div className="flex items-start gap-2">
                    {alert.type === "error" ? (
                      <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">{alert.title}</p>
                      <p className="text-muted-foreground mt-0.5">{alert.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground italic">
              Al continuar, confirmas que has revisado estas advertencias.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Esta acción guardará el registro clínico, la receta y las indicaciones de forma permanente.
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-dialog">
            No, revisar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={hasHighAlerts && countdown > 0}
            variant={hasHighAlerts ? "destructive" : "default"}
            data-testid="button-confirm-dialog"
          >
            {hasHighAlerts && countdown > 0
              ? `Espere (${countdown}s)`
              : "Sí, terminar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ConsultationValidationPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [diagnosis, setDiagnosis] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const [medications, setMedications] = useState<Medication[]>([]);
  const [instructionsText, setInstructionsText] = useState("");
  
  const [gesDiagnoses, setGesDiagnoses] = useState<GesDiagnosis[]>([]);
  const [gesSearchQuery, setGesSearchQuery] = useState("");
  const [gesSearchResults, setGesSearchResults] = useState<GesDiagnosis[]>([]);
  const [gesSearching, setGesSearching] = useState(false);
  const [showGesSearch, setShowGesSearch] = useState(false);
  const [examsText, setExamsText] = useState("");
  const [medicalReportText, setMedicalReportText] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [sendPrescription, setSendPrescription] = useState(true);
  const [sendInstructions, setSendInstructions] = useState(true);
  const [sendExams, setSendExams] = useState(true);
  const [emailSent, setEmailSent] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);

  const [isInitialized, setIsInitialized] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const { data: reportTemplates } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/doctors/me/report-templates"],
  });

  const regenerateReport = useCallback(async (templateId?: number) => {
    if (!id) return;
    setIsRegenerating(true);
    try {
      const res = await apiRequest("POST", `/api/consultations/${id}/regenerate-report`, {
        templateId: templateId || null,
      });
      const data = await res.json();
      if (data.reportText) {
        setMedicalReportText(data.reportText);
        toast({ title: "Informe regenerado", description: templateId ? "Se aplicó la plantilla seleccionada" : "Se usó el formato predeterminado" });
      }
    } catch {
      toast({ title: "Error", description: "No se pudo regenerar el informe", variant: "destructive" });
    }
    setIsRegenerating(false);
  }, [id, toast]);

  interface ClinicalAlert {
    type: "error" | "warning" | "info";
    category: string;
    title: string;
    description: string;
    probability: number;
    severity: number;
  }
  const [clinicalAlerts, setClinicalAlerts] = useState<ClinicalAlert[]>([]);

  const { data: validationData, isLoading } = useQuery<ValidationData>({
    queryKey: ["/api/consultations", id, "validation"],
  });

  useEffect(() => {
    if (validationData && !isInitialized) {
      const cr = validationData.clinicalRecord;
      setChiefComplaint(cr.chiefComplaint || "");
      setSymptoms(cr.symptoms || []);
      setDiagnosis(cr.diagnosis || "");
      setClinicalNotes(cr.notes || "");

      if (validationData.prescription) {
        setMedications(validationData.prescription.medications || []);
      }

      if (validationData.medicalInstructions?.length > 0) {
        setInstructionsText(validationData.medicalInstructions.map(i => 
          i.description ? `${i.title}: ${i.description}` : i.title
        ).join("\n"));
      }

      if (validationData.examOrders) {
        setExamsText((validationData.examOrders.exams || []).map(e => 
          e.justification ? `${e.name} - ${e.justification}` : e.name
        ).join("\n"));
      }

      if (validationData.clinicalRecord.gesDiagnosis) {
        setGesDiagnoses(validationData.clinicalRecord.gesDiagnosis);
      }

      if (validationData.clinicalRecord.medicalReport) {
        const r = validationData.clinicalRecord.medicalReport as any;
        if (r.editedText) {
          setMedicalReportText(r.editedText);
        } else {
          const lines: string[] = [];
          lines.push("DATOS DEL PACIENTE");
          lines.push(`Nombre: ${r.patientData?.fullName || ""}`);
          if (r.patientData?.age != null) lines.push(`Edad: ${r.patientData.age}`);
          lines.push(`Sexo: ${r.patientData?.sex || ""}`);
          if (r.patientData?.occupation) lines.push(`Ocupación: ${r.patientData.occupation}`);
          lines.push("");
          lines.push("MOTIVO DE CONSULTA");
          lines.push(r.consultationData?.reason || "");
          lines.push("");
          lines.push("ENFERMEDAD ACTUAL");
          lines.push(r.consultationData?.currentIllness?.description || "");
          if (r.consultationData?.currentIllness?.onset) lines.push(`Inicio: ${r.consultationData.currentIllness.onset}`);
          if (r.consultationData?.currentIllness?.duration) lines.push(`Duración: ${r.consultationData.currentIllness.duration}`);
          if (r.consultationData?.currentIllness?.associatedSymptoms) lines.push(`Síntomas asociados: ${r.consultationData.currentIllness.associatedSymptoms}`);
          if (r.consultationData?.currentIllness?.modifyingFactors) lines.push(`Factores modificadores: ${r.consultationData.currentIllness.modifyingFactors}`);
          if (r.consultationData?.currentIllness?.previousTreatments) lines.push(`Tratamientos previos: ${r.consultationData.currentIllness.previousTreatments}`);
          lines.push("");
          lines.push("ANTECEDENTES");
          if (r.medicalHistory?.medical) lines.push(`Médicos: ${r.medicalHistory.medical}`);
          if (r.medicalHistory?.surgical) lines.push(`Quirúrgicos: ${r.medicalHistory.surgical}`);
          if (r.medicalHistory?.allergies) lines.push(`Alergias: ${r.medicalHistory.allergies}`);
          if (r.medicalHistory?.medications) lines.push(`Medicamentos: ${r.medicalHistory.medications}`);
          lines.push("");
          if (r.familyHistory) {
            lines.push("ANTECEDENTES FAMILIARES");
            lines.push(r.familyHistory);
            lines.push("");
          }
          lines.push("HÁBITOS");
          if (r.habits?.diet) lines.push(`Alimentación: ${r.habits.diet}`);
          if (r.habits?.physicalActivity) lines.push(`Actividad física: ${r.habits.physicalActivity}`);
          if (r.habits?.sleep) lines.push(`Sueño: ${r.habits.sleep}`);
          if (r.habits?.substanceUse) lines.push(`Sustancias: ${r.habits.substanceUse}`);
          lines.push("");
          if (r.systemsReview) {
            lines.push("REVISIÓN POR SISTEMAS");
            lines.push(r.systemsReview);
            lines.push("");
          }
          if (r.physicalExam?.systemsExploration) {
            lines.push("EXAMEN FÍSICO");
            lines.push(r.physicalExam.systemsExploration);
            lines.push("");
          }
          lines.push("IMPRESIÓN DIAGNÓSTICA");
          lines.push(r.diagnosticImpression || "");
          lines.push("");
          lines.push("PLAN DE TRATAMIENTO");
          if (r.treatmentPlan?.treatment) lines.push(r.treatmentPlan.treatment);
          if (r.treatmentPlan?.tests?.length > 0) {
            lines.push(`Exámenes: ${r.treatmentPlan.tests.join(", ")}`);
          }
          if (r.treatmentPlan?.instructions?.length > 0) {
            lines.push(`Indicaciones: ${r.treatmentPlan.instructions.join(", ")}`);
          }
          if (cr.notes) {
            lines.push("");
            lines.push("NOTAS CLÍNICAS");
            lines.push(cr.notes);
          }
          setMedicalReportText(lines.join("\n"));
        }
      }

      setIsInitialized(true);
    }
  }, [validationData, isInitialized]);

  useEffect(() => {
    if (!gesSearchQuery || gesSearchQuery.length < 2) {
      setGesSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setGesSearching(true);
      try {
        const res = await fetch(`/api/ges/search?q=${encodeURIComponent(gesSearchQuery)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        });
        if (res.ok) {
          const data = await res.json();
          setGesSearchResults(data);
        }
      } catch (e) {
        console.error("GES search error:", e);
      } finally {
        setGesSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [gesSearchQuery]);

  const parseInstructionsFromText = (text: string): MedicalInstructionDraft[] => {
    return text.split("\n").map(line => line.trim()).filter(line => line.length > 0).map(line => {
      const colonIdx = line.indexOf(":");
      const title = colonIdx > 0 ? line.substring(0, colonIdx).trim() : line;
      const description = colonIdx > 0 ? line.substring(colonIdx + 1).trim() : "";
      return { category: "follow-up", title, description: description || title, priority: "normal" };
    });
  };

  const parseExamsFromText = (text: string): Exam[] => {
    return text.split("\n").map(line => line.trim()).filter(line => line.length > 0).map(line => {
      const dashIdx = line.indexOf(" - ");
      const name = dashIdx > 0 ? line.substring(0, dashIdx).trim() : line;
      const justification = dashIdx > 0 ? line.substring(dashIdx + 3).trim() : "";
      return { name, justification };
    });
  };

  const validateMutation = useMutation({
    mutationFn: async () => {
      const parsedInstructions = parseInstructionsFromText(instructionsText);
      const parsedExams = parseExamsFromText(examsText);
      const response = await apiRequest("POST", `/api/consultations/${id}/validate`, {
        clinicalRecord: {
          chiefComplaint,
          symptoms,
          diagnosis,
          notes: clinicalNotes,
          gesDiagnosis: gesDiagnoses.length > 0 ? gesDiagnoses : null,
          medicalReportText: medicalReportText || null,
        },
        prescription: medications.length > 0 ? {
          medications,
        } : null,
        medicalInstructions: parsedInstructions,
        examOrders: parsedExams.length > 0 ? {
          exams: parsedExams,
        } : null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/me/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/me/stats"] });
      setIsValidated(true);
      toast({
        title: "Consulta validada",
        description: "La información clínica ha sido guardada exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo validar la consulta",
        variant: "destructive",
      });
    },
  });

  const sendDocumentsMutation = useMutation({
    mutationFn: async (documentTypes: string[]) => {
      const response = await apiRequest("POST", `/api/consultations/${id}/send-documents`, {
        documentTypes,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setEmailSent(true);
      toast({
        title: "Documentos enviados",
        description: `Los documentos han sido enviados al correo del paciente`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al enviar",
        description: error.message || "No se pudieron enviar los documentos por correo",
        variant: "destructive",
      });
    },
  });

  const alertsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/consultations/${id}/alerts`, {
        medications,
        medicalInstructions: parseInstructionsFromText(instructionsText).map(i => ({
          title: i.title,
          description: i.description,
          category: i.category,
        })),
        examOrders: parseExamsFromText(examsText).map(e => ({
          name: e.name,
          type: "general",
          clinicalJustification: e.justification,
        })),
      });
      return response.json();
    },
    onSuccess: (data) => {
      const sorted = (data.alerts || []).sort((a: ClinicalAlert, b: ClinicalAlert) => {
        const typeOrder = { error: 0, warning: 1, info: 2 };
        const aOrder = typeOrder[a.type] ?? 2;
        const bOrder = typeOrder[b.type] ?? 2;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return b.severity - a.severity;
      });
      setClinicalAlerts(sorted);
    },
    onError: () => {
      setClinicalAlerts([]);
      toast({
        title: "Error en el análisis",
        description: "No se pudieron generar las alertas clínicas. Intente nuevamente.",
        variant: "destructive",
      });
    },
  });


  const addMedication = () => {
    setMedications(prev => [...prev, {
      name: "",
      dosage: "",
      frequency: "",
      duration: "",
      instructions: "",
    }]);
  };

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    setMedications(prev => prev.map((med, i) =>
      i === index ? { ...med, [field]: value } : med
    ));
  };

  const removeMedication = (index: number) => {
    setMedications(prev => prev.filter((_, i) => i !== index));
  };


  const handlePdfPreview = async (types: string[]) => {
    setPdfPreviewLoading(true);
    setPdfPreviewOpen(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/consultations/${id}/documents/pdf?types=${types.join(",")}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Error al generar PDF");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(url);
    } catch {
      toast({
        title: "Error",
        description: "No se pudo generar la vista previa del PDF",
        variant: "destructive",
      });
      setPdfPreviewOpen(false);
    } finally {
      setPdfPreviewLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-[350px]" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!validationData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Consulta no encontrada</h2>
        <Button onClick={() => navigate("/doctor/appointments")} data-testid="button-back-appointments">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a consultas
        </Button>
      </div>
    );
  }

  const hasMedicalReport = !!validationData.clinicalRecord.medicalReport;

  const hasMedications = medications.length > 0;
  const parsedInstructionsPreview = parseInstructionsFromText(instructionsText);
  const parsedExamsPreview = parseExamsFromText(examsText);
  const hasInstructionItems = parsedInstructionsPreview.length > 0;
  const hasExamItems = parsedExamsPreview.length > 0;
  const hasAnyDocuments = hasMedications || hasInstructionItems || hasExamItems;

  const selectedDocCount = 
    (sendPrescription && hasMedications ? 1 : 0) +
    (sendInstructions && hasInstructionItems ? 1 : 0) +
    (sendExams && hasExamItems ? 1 : 0);

  const handleSendEmail = () => {
    const types: string[] = [];
    if (sendPrescription && hasMedications) types.push('prescription');
    if (sendInstructions && hasInstructionItems) types.push('instructions');
    if (sendExams && hasExamItems) types.push('exams');
    if (types.length === 0) {
      toast({
        title: "Sin documentos seleccionados",
        description: "Selecciona al menos un tipo de documento para enviar",
        variant: "destructive",
      });
      return;
    }
    sendDocumentsMutation.mutate(types);
  };

  if (isValidated) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center gap-4 mb-8">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold" data-testid="text-validation-success">
                Consulta validada exitosamente
              </h1>
              <p className="text-muted-foreground">
                La información clínica ha sido guardada. Puedes enviar los documentos al paciente por correo electrónico.
              </p>
            </div>

            {hasAnyDocuments && !emailSent && (
              <div className="space-y-4">
                <SigningPanel appointmentId={id!} />

                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Enviar documentos al paciente
                </h3>
                <p className="text-sm text-muted-foreground">
                  Selecciona los documentos que deseas enviar al correo del paciente:
                </p>

                <div className="space-y-3">
                  {hasMedications && (
                    <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors" data-testid="checkbox-send-prescription">
                      <input
                        type="checkbox"
                        checked={sendPrescription}
                        onChange={(e) => setSendPrescription(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Pill className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="font-medium text-sm">Receta médica</p>
                        <p className="text-xs text-muted-foreground">{medications.length} medicamento(s)</p>
                      </div>
                    </label>
                  )}

                  {hasInstructionItems && (
                    <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors" data-testid="checkbox-send-instructions">
                      <input
                        type="checkbox"
                        checked={sendInstructions}
                        onChange={(e) => setSendInstructions(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <ClipboardList className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="font-medium text-sm">Indicaciones médicas</p>
                        <p className="text-xs text-muted-foreground">{parsedInstructionsPreview.length} indicación(es)</p>
                      </div>
                    </label>
                  )}

                  {hasExamItems && (
                    <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors" data-testid="checkbox-send-exams">
                      <input
                        type="checkbox"
                        checked={sendExams}
                        onChange={(e) => setSendExams(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <FlaskConical className="h-4 w-4 text-purple-600" />
                      <div>
                        <p className="font-medium text-sm">Órdenes de exámenes</p>
                        <p className="text-xs text-muted-foreground">{parsedExamsPreview.length} examen(es)</p>
                      </div>
                    </label>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const types: string[] = [];
                      if (sendPrescription && hasMedications) types.push("prescription");
                      if (sendInstructions && hasInstructionItems) types.push("instructions");
                      if (sendExams && hasExamItems) types.push("exams");
                      if (types.length > 0) handlePdfPreview(types);
                    }}
                    disabled={pdfPreviewLoading || selectedDocCount === 0}
                    data-testid="button-preview-pdf-success"
                  >
                    {pdfPreviewLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    Vista previa
                  </Button>
                  <Button
                    onClick={handleSendEmail}
                    disabled={sendDocumentsMutation.isPending || selectedDocCount === 0}
                    className="flex-1"
                    data-testid="button-send-email"
                  >
                    {sendDocumentsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Enviar por correo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/doctor/appointments")}
                    data-testid="button-skip-email"
                  >
                    Omitir
                  </Button>
                </div>
              </div>
            )}

            {emailSent && (
              <div className="flex flex-col items-center gap-4 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <p className="font-medium text-green-800 dark:text-green-300">
                  Documentos enviados exitosamente al paciente
                </p>
                <Button
                  onClick={() => navigate("/doctor/appointments")}
                  data-testid="button-done"
                >
                  Volver a consultas
                </Button>
              </div>
            )}

            {!hasAnyDocuments && (
              <div className="flex flex-col items-center gap-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  No hay documentos (receta, indicaciones o exámenes) para enviar.
                </p>
                <Button
                  onClick={() => navigate("/doctor/appointments")}
                  data-testid="button-done-no-docs"
                >
                  Volver a consultas
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={pdfPreviewOpen} onOpenChange={(open) => {
          setPdfPreviewOpen(open);
          if (!open && pdfPreviewUrl) {
            URL.revokeObjectURL(pdfPreviewUrl);
            setPdfPreviewUrl(null);
          }
        }}>
          <DialogContent className="max-w-4xl h-[85vh]">
            <DialogHeader>
              <DialogTitle>Vista previa de documentos</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 h-full">
              {pdfPreviewLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pdfPreviewUrl ? (
                <iframe
                  src={pdfPreviewUrl}
                  className="w-full h-full rounded-md border"
                  title="Vista previa PDF"
                  data-testid="pdf-preview-iframe"
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/doctor/appointments")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              Validación Post-Consulta
            </h1>
            <p className="text-sm text-muted-foreground">
              Revisa y edita la información clínica antes de confirmar
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isValidated && hasAnyDocuments && (
            <Button
              variant="outline"
              onClick={() => {
                const types: string[] = [];
                if (hasMedications) types.push("prescription");
                if (hasInstructionItems) types.push("instructions");
                if (hasExamItems) types.push("exams");
                handlePdfPreview(types);
              }}
              disabled={pdfPreviewLoading}
              data-testid="button-preview-pdf"
            >
              {pdfPreviewLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              Vista previa PDF
            </Button>
          )}
          <Button
            onClick={() => setIsConfirmOpen(true)}
            disabled={validateMutation.isPending}
            data-testid="button-validate"
          >
            {validateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Validar y guardar
          </Button>
        </div>
      </div>

      <AlertWarningDialog
        isOpen={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        onConfirm={() => {
          setIsConfirmOpen(false);
          validateMutation.mutate();
        }}
        alerts={clinicalAlerts}
      />

      <Dialog open={pdfPreviewOpen} onOpenChange={(open) => {
        setPdfPreviewOpen(open);
        if (!open && pdfPreviewUrl) {
          URL.revokeObjectURL(pdfPreviewUrl);
          setPdfPreviewUrl(null);
        }
      }}>
        <DialogContent className="max-w-4xl h-[85vh]">
          <DialogHeader>
            <DialogTitle>Vista previa de documentos</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 h-full">
            {pdfPreviewLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pdfPreviewUrl ? (
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full rounded-md border"
                title="Vista previa PDF"
                data-testid="pdf-preview-iframe"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border bg-card p-3 mb-4" data-testid="patient-bar">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-none truncate" data-testid="text-patient-name">{validationData.patient.name}</p>
              {validationData.patient.rut && (
                <p className="text-[11px] text-muted-foreground mt-0.5" data-testid="text-patient-rut">RUT: {validationData.patient.rut}</p>
              )}
            </div>
          </div>

          <div className="hidden sm:block h-6 w-px bg-border" />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {validationData.patient.dateOfBirth && (
              <span data-testid="text-patient-age">
                {(() => {
                  const birth = new Date(validationData.patient.dateOfBirth!);
                  const today = new Date();
                  let age = today.getFullYear() - birth.getFullYear();
                  const m = today.getMonth() - birth.getMonth();
                  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                  return `${age} años`;
                })()}
              </span>
            )}
            {validationData.patient.gender && (
              <span data-testid="text-patient-gender">
                {validationData.patient.gender === "male" ? "Masculino" : validationData.patient.gender === "female" ? "Femenino" : validationData.patient.gender === "other" ? "Otro" : validationData.patient.gender}
              </span>
            )}
            {validationData.patient.bloodType && (
              <span className="flex items-center gap-1" data-testid="text-patient-blood">
                <Heart className="h-3 w-3" />
                {validationData.patient.bloodType}
              </span>
            )}
            {validationData.patient.email && (
              <span className="hidden md:inline" data-testid="text-patient-email">{validationData.patient.email}</span>
            )}
            {validationData.patient.whatsapp && (
              <span className="hidden md:inline flex items-center gap-1" data-testid="text-patient-whatsapp">
                <Phone className="h-3 w-3" />
                {validationData.patient.whatsapp}
              </span>
            )}
          </div>

          {validationData.patient.allergies && validationData.patient.allergies.length > 0 && (
            <>
              <div className="hidden sm:block h-6 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                <div className="flex flex-wrap gap-1">
                  {validationData.patient.allergies.map((a, i) => (
                    <span key={i} className="text-[11px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-medium" data-testid={`badge-allergy-${i}`}>{a}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          {validationData.patient.medicalHistory && (
            <>
              <div className="hidden sm:block h-6 w-px bg-border" />
              <span className="text-[11px] text-muted-foreground hidden lg:inline max-w-[200px] truncate" title={validationData.patient.medicalHistory}>
                Ant: {validationData.patient.medicalHistory}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="clinical" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="clinical" data-testid="tab-clinical">
                <FileText className="h-4 w-4 mr-1.5" />
                Informe
              </TabsTrigger>
              <TabsTrigger value="prescription" data-testid="tab-prescription">
                <Pill className="h-4 w-4 mr-1.5" />
                Receta
              </TabsTrigger>
              <TabsTrigger value="instructions" data-testid="tab-instructions">
                <ClipboardList className="h-4 w-4 mr-1.5" />
                Indicaciones
              </TabsTrigger>
              <TabsTrigger value="exams" data-testid="tab-exams">
                <FlaskConical className="h-4 w-4 mr-1.5" />
                Exámenes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="clinical" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Anamnesis
                    </CardTitle>
                    {(validationData?.clinicalRecord as any)?.hasTranscription && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isRegenerating}
                            data-testid="button-regenerate-report"
                          >
                            {isRegenerating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary" />
                            )}
                            Regenerar con IA
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => regenerateReport()}
                            data-testid="button-regenerate-default"
                          >
                            Formato predeterminado
                          </DropdownMenuItem>
                          {reportTemplates && reportTemplates.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              {reportTemplates.map((t) => (
                                <DropdownMenuItem
                                  key={t.id}
                                  onClick={() => regenerateReport(t.id)}
                                  data-testid={`button-regenerate-template-${t.id}`}
                                >
                                  {t.name}
                                  {t.isDefault && (
                                    <Badge variant="secondary" className="ml-2 text-[10px]">★</Badge>
                                  )}
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {chiefComplaint && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Motivo de consulta</p>
                      <p className="text-sm" data-testid="text-chief-complaint">{chiefComplaint}</p>
                    </div>
                  )}

                  <div>
                    {(validationData?.clinicalRecord as any)?.hasTranscription && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Generado por IA</span>
                        <span className="text-[10px] text-muted-foreground">· Editable</span>
                      </div>
                    )}
                    <Textarea
                      value={medicalReportText}
                      onChange={(e) => setMedicalReportText(e.target.value)}
                      className="min-h-[450px] text-sm leading-relaxed resize-y overflow-y-auto"
                      placeholder="La anamnesis aparecerá aquí después de la consulta. Incluye el informe generado y las notas clínicas. Puede modificarlo libremente."
                      data-testid="input-medical-report"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Generado a partir de la grabación e incluye notas clínicas. Puede editarlo libremente antes de validar.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="diagnosis" data-testid="label-diagnosis">Diagnóstico</Label>
                    <Textarea
                      id="diagnosis"
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="Diagnóstico clínico..."
                      className="mt-1.5"
                      data-testid="input-diagnosis"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-600" />
                        <Label className="font-medium">Diagnóstico GES</Label>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowGesSearch(!showGesSearch)}
                        data-testid="toggle-ges-search"
                      >
                        <Search className="h-3.5 w-3.5 mr-1" />
                        {showGesSearch ? "Ocultar búsqueda" : "Buscar patología GES"}
                      </Button>
                    </div>

                    {gesDiagnoses.length > 0 && (
                      <div className="space-y-2" data-testid="ges-selected-list">
                        {gesDiagnoses.map((g, idx) => (
                          <div key={`${g.codigoCie10}-${idx}`} className="flex items-start gap-2 p-2.5 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs shrink-0">
                                  GES #{g.idProblema}
                                </Badge>
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {g.codigoCie10}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium mt-1 leading-tight">{g.problemaDeSalud}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{g.descriptor}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setGesDiagnoses(prev => prev.filter((_, i) => i !== idx))}
                              data-testid={`ges-remove-${idx}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {showGesSearch && (
                      <div className="space-y-2 p-3 rounded-lg border bg-muted/30" data-testid="ges-search-panel">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={gesSearchQuery}
                            onChange={(e) => setGesSearchQuery(e.target.value)}
                            placeholder="Buscar por patología, descriptor o código CIE-10..."
                            className="pl-9"
                            data-testid="ges-search-input"
                          />
                          {gesSearching && (
                            <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        {gesSearchResults.length > 0 && (
                          <ScrollArea className="max-h-60">
                            <div className="space-y-1">
                              {gesSearchResults.map((r, idx) => {
                                const isSelected = gesDiagnoses.some(
                                  g => g.codigoCie10 === r.codigoCie10 && g.idProblema === r.idProblema
                                );
                                return (
                                  <button
                                    key={`${r.codigoCie10}-${idx}`}
                                    className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                                      isSelected
                                        ? "bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700"
                                        : "hover:bg-muted border border-transparent"
                                    }`}
                                    onClick={() => {
                                      if (isSelected) {
                                        setGesDiagnoses(prev =>
                                          prev.filter(g => !(g.codigoCie10 === r.codigoCie10 && g.idProblema === r.idProblema))
                                        );
                                      } else {
                                        setGesDiagnoses(prev => [...prev, r]);
                                      }
                                    }}
                                    data-testid={`ges-result-${idx}`}
                                  >
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                        GES #{r.idProblema}
                                      </Badge>
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                        {r.codigoCie10}
                                      </Badge>
                                      {isSelected && <Check className="h-3 w-3 text-blue-600 ml-auto" />}
                                    </div>
                                    <p className="font-medium text-xs mt-1 leading-tight">{r.problemaDeSalud}</p>
                                    <p className="text-xs text-muted-foreground leading-tight">{r.descriptor}</p>
                                  </button>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        )}
                        {gesSearchQuery.length >= 2 && !gesSearching && gesSearchResults.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-3">
                            No se encontraron resultados para "{gesSearchQuery}"
                          </p>
                        )}
                        {gesSearchQuery.length < 2 && (
                          <p className="text-xs text-muted-foreground text-center py-2">
                            Escriba al menos 2 caracteres para buscar
                          </p>
                        )}
                      </div>
                    )}

                    {gesDiagnoses.length === 0 && !showGesSearch && (
                      <p className="text-xs text-muted-foreground">
                        Sin diagnóstico GES asociado. Use el botón de búsqueda para agregar uno.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="prescription" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Pill className="h-5 w-5" />
                    Receta Médica
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addMedication} data-testid="button-add-medication">
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {medications.length === 0 ? (
                    <>
                      {hasMedicalReport && (
                        <div
                          className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-3"
                          data-testid="alert-prescription-empty-after-transcript"
                        >
                          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-amber-900 dark:text-amber-100">
                              No se detectaron medicamentos en la transcripción
                            </p>
                            <p className="text-amber-800/90 dark:text-amber-200/90 mt-0.5">
                              Si corresponde, agrégalos manualmente. Si efectivamente no
                              recetaste medicamentos, puedes continuar sin agregar nada.
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="text-center py-10 px-4 border border-dashed rounded-lg" data-testid="prescription-empty">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                          <Pill className="h-6 w-6 text-primary" />
                        </div>
                        <p className="text-sm font-medium">Sin medicamentos en la receta</p>
                        <p className="text-xs text-muted-foreground mt-1 mb-4">Agrega el primer medicamento para empezar</p>
                        <Button size="sm" onClick={addMedication} data-testid="button-add-first-medication">
                          <Plus className="h-4 w-4 mr-1.5" />
                          Agregar medicamento
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {medications.map((med, index) => (
                        <div key={index} className="border border-dashed rounded-md p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-medium text-muted-foreground">
                                Medicamento {index + 1}
                              </h4>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeMedication(index)}
                                data-testid={`button-remove-medication-${index}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label>Nombre</Label>
                                <Input
                                  value={med.name}
                                  onChange={(e) => updateMedication(index, "name", e.target.value)}
                                  placeholder="Nombre del medicamento"
                                  className="mt-1"
                                  data-testid={`input-med-name-${index}`}
                                />
                              </div>
                              <div>
                                <Label>Dosis</Label>
                                <Input
                                  value={med.dosage}
                                  onChange={(e) => updateMedication(index, "dosage", e.target.value)}
                                  placeholder="Ej: 500mg"
                                  className="mt-1"
                                  data-testid={`input-med-dosage-${index}`}
                                />
                              </div>
                              <div>
                                <Label>Frecuencia</Label>
                                <Input
                                  value={med.frequency}
                                  onChange={(e) => updateMedication(index, "frequency", e.target.value)}
                                  placeholder="Ej: Cada 8 horas"
                                  className="mt-1"
                                  data-testid={`input-med-frequency-${index}`}
                                />
                              </div>
                              <div>
                                <Label>Duración</Label>
                                <Input
                                  value={med.duration}
                                  onChange={(e) => updateMedication(index, "duration", e.target.value)}
                                  placeholder="Ej: 7 días"
                                  className="mt-1"
                                  data-testid={`input-med-duration-${index}`}
                                />
                              </div>
                            </div>
                            <div>
                              <Label>Instrucciones adicionales</Label>
                              <Input
                                value={med.instructions || ""}
                                onChange={(e) => updateMedication(index, "instructions", e.target.value)}
                                placeholder="Ej: Tomar después de las comidas"
                                className="mt-1"
                                data-testid={`input-med-instructions-${index}`}
                              />
                            </div>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="instructions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Indicaciones Médicas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={instructionsText}
                    onChange={(e) => setInstructionsText(e.target.value)}
                    placeholder={"Escriba una indicación por línea, por ejemplo:\nReposo relativo por 5 días\nDieta blanda sin irritantes\nControl en 7 días con exámenes"}
                    className="min-h-[200px] resize-y"
                    data-testid="input-instructions-text"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Cada línea será una indicación individual. Puede usar ":" para separar título y descripción.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="exams" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FlaskConical className="h-5 w-5" />
                    Órdenes de Exámenes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={examsText}
                    onChange={(e) => setExamsText(e.target.value)}
                    placeholder={"Escriba un examen por línea, por ejemplo:\nHemograma completo\nGlicemia en ayunas - Sospecha de diabetes\nTSH - Control tiroideo"}
                    className="min-h-[200px] resize-y"
                    data-testid="input-exams-text"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Cada línea será un examen. Use " - " para agregar justificación clínica.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
          <Card className="overflow-hidden border-primary/20 shadow-sm">
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-3 py-1.5 border-b border-primary/10 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">IA</span>
            </div>
            <ClinicalAssistant appointmentId={id!} className="h-[480px]" />
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Alertas Clínicas
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => alertsMutation.mutate()}
                  disabled={alertsMutation.isPending}
                  data-testid="button-generate-alerts"
                >
                  {alertsMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {alertsMutation.isPending ? (
                <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Analizando consulta...</span>
                </div>
              ) : clinicalAlerts.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-3" data-testid="clinical-alerts-list">
                    {clinicalAlerts.map((alert, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border p-3 text-xs ${
                          alert.type === "error"
                            ? "border-destructive/50 bg-destructive/5"
                            : alert.type === "warning"
                            ? "border-orange-500/50 bg-orange-500/5"
                            : "border-blue-500/50 bg-blue-500/5"
                        }`}
                        data-testid={`alert-${alert.type}-${i}`}
                      >
                        <div className="flex items-start gap-2">
                          {alert.type === "error" ? (
                            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                          ) : alert.type === "warning" ? (
                            <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-xs">{alert.title}</span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${
                                  alert.type === "error"
                                    ? "border-destructive/50 text-destructive"
                                    : alert.type === "warning"
                                    ? "border-orange-500/50 text-orange-500"
                                    : "border-blue-500/50 text-blue-500"
                                }`}
                              >
                                {alert.category}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">{alert.description}</p>
                            {(alert.severity >= 0.7 || alert.probability >= 0.7) && (
                              <div className="flex items-center gap-3 mt-1.5">
                                {alert.severity >= 0.7 && (
                                  <span className="text-[10px] text-destructive font-medium">
                                    Severidad: {Math.round(alert.severity * 100)}%
                                  </span>
                                )}
                                {alert.probability >= 0.7 && (
                                  <span className="text-[10px] text-orange-500 font-medium">
                                    Probabilidad: {Math.round(alert.probability * 100)}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-4">
                  {alertsMutation.isSuccess ? (
                    <>
                      <CheckCircle className="h-6 w-6 mx-auto mb-1 text-green-500" />
                      <p className="text-sm text-muted-foreground">No se detectaron alertas</p>
                    </>
                  ) : alertsMutation.isError ? (
                    <>
                      <AlertCircle className="h-6 w-6 mx-auto mb-1 text-destructive" />
                      <p className="text-sm text-muted-foreground">Error al analizar. Intente nuevamente.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => alertsMutation.mutate()}
                        data-testid="button-retry-alerts"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Reintentar
                      </Button>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-6 w-6 mx-auto mb-1 opacity-50 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Analiza la consulta para detectar alertas</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => alertsMutation.mutate()}
                        data-testid="button-run-alerts"
                      >
                        <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                        Analizar
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                Consulta del {validationData.appointment.scheduledDate} a las {validationData.appointment.scheduledTime?.slice(0, 5)}
              </p>
              {validationData.appointment.notes && (
                <div>
                  <p className="text-xs font-medium">Motivo original:</p>
                  <p className="text-xs text-muted-foreground">{validationData.appointment.notes}</p>
                </div>
              )}
              <Badge
                variant={validationData.appointment.status === "pending_validation" ? "outline" : "default"}
                data-testid="badge-status"
              >
                {validationData.appointment.status === "pending_validation"
                  ? "Pendiente de validación"
                  : validationData.appointment.status === "completed"
                    ? "Completada"
                    : validationData.appointment.status}
              </Badge>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              onClick={() => setIsConfirmOpen(true)}
              disabled={validateMutation.isPending}
              data-testid="button-validate-sidebar"
            >
              {validateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Validar y guardar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

