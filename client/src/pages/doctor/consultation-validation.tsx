import { useState, useEffect } from "react";
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
} from "lucide-react";
import { ClinicalAssistant } from "@/components/clinical-assistant";

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

export default function ConsultationValidationPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomInput, setSymptomInput] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const [medications, setMedications] = useState<Medication[]>([]);
  const [instructions, setInstructions] = useState<MedicalInstructionDraft[]>([]);
  
  const [exams, setExams] = useState<Exam[]>([]);
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
        setInstructions(validationData.medicalInstructions.map(i => ({
          category: i.category,
          title: i.title,
          description: i.description,
          priority: i.priority,
        })));
      }

      if (validationData.examOrders) {
        setExams((validationData.examOrders.exams || []).map(e => ({
          name: e.name,
          justification: e.justification || "",
        })));
      }

      setIsInitialized(true);
    }
  }, [validationData, isInitialized]);

  const validateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/consultations/${id}/validate`, {
        clinicalRecord: {
          chiefComplaint,
          symptoms,
          diagnosis,
          notes: clinicalNotes,
        },
        prescription: medications.length > 0 ? {
          medications,
        } : null,
        medicalInstructions: instructions,
        examOrders: exams.length > 0 ? {
          exams,
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
        medicalInstructions: instructions.map(i => ({
          title: i.title,
          description: i.description,
          category: i.category,
        })),
        examOrders: exams.map(e => ({
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

  const addSymptom = () => {
    if (symptomInput.trim()) {
      setSymptoms(prev => [...prev, symptomInput.trim()]);
      setSymptomInput("");
    }
  };

  const removeSymptom = (index: number) => {
    setSymptoms(prev => prev.filter((_, i) => i !== index));
  };

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

  const addInstruction = () => {
    setInstructions(prev => [...prev, {
      category: "follow-up",
      title: "",
      description: "",
      priority: "normal",
    }]);
  };

  const updateInstruction = (index: number, field: keyof MedicalInstructionDraft, value: string) => {
    setInstructions(prev => prev.map((inst, i) =>
      i === index ? { ...inst, [field]: value } : inst
    ));
  };

  const removeInstruction = (index: number) => {
    setInstructions(prev => prev.filter((_, i) => i !== index));
  };

  const addExam = () => {
    setExams(prev => [...prev, { name: "", justification: "" }]);
  };

  const updateExam = (index: number, field: keyof Exam, value: string) => {
    setExams(prev => prev.map((exam, i) =>
      i === index ? { ...exam, [field]: value } : exam
    ));
  };

  const removeExam = (index: number) => {
    setExams(prev => prev.filter((_, i) => i !== index));
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
  const hasInstructionItems = instructions.length > 0;
  const hasExamItems = exams.length > 0;
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
                        <p className="text-xs text-muted-foreground">{instructions.length} indicación(es)</p>
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
                        <p className="text-xs text-muted-foreground">{exams.length} examen(es)</p>
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

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        onConfirm={() => {
          setIsConfirmOpen(false);
          validateMutation.mutate();
        }}
        title="¿Estás seguro que quieres terminar la consulta?"
        description="Esta acción guardará el registro clínico, la receta y las indicaciones de forma permanente."
        confirmText="Sí, terminar"
        cancelText="No, revisar"
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
                Registro
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
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Registro Clínico
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="chiefComplaint" data-testid="label-chief-complaint">Motivo de consulta</Label>
                    <Textarea
                      id="chiefComplaint"
                      value={chiefComplaint}
                      onChange={(e) => setChiefComplaint(e.target.value)}
                      placeholder="Describe el motivo principal de la consulta..."
                      className="mt-1.5"
                      data-testid="input-chief-complaint"
                    />
                  </div>

                  <div>
                    <Label data-testid="label-symptoms">Síntomas</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Input
                        value={symptomInput}
                        onChange={(e) => setSymptomInput(e.target.value)}
                        placeholder="Agregar síntoma..."
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSymptom())}
                        data-testid="input-symptom"
                      />
                      <Button variant="outline" size="icon" onClick={addSymptom} data-testid="button-add-symptom">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {symptoms.map((symptom, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => removeSymptom(i)}
                            data-testid={`badge-symptom-${i}`}
                          >
                            {symptom}
                            <Trash2 className="h-3 w-3 ml-1" />
                          </Badge>
                        ))}
                      </div>
                    )}
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

                  <div>
                    <Label htmlFor="clinicalNotes" data-testid="label-notes">Notas clínicas</Label>
                    <Textarea
                      id="clinicalNotes"
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      placeholder="Notas adicionales..."
                      className="mt-1.5"
                      data-testid="input-clinical-notes"
                    />
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
                    <div className="text-center py-8 text-muted-foreground" data-testid="prescription-empty">
                      <Pill className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No hay medicamentos en la receta</p>
                      <p className="text-xs mt-1">Agrega medicamentos manualmente</p>
                    </div>
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
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Indicaciones Médicas
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addInstruction} data-testid="button-add-instruction">
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {instructions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground" data-testid="instructions-empty">
                      <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No hay indicaciones médicas</p>
                      <p className="text-xs mt-1">Agrega indicaciones manualmente</p>
                    </div>
                  ) : (
                    instructions.map((inst, index) => (
                      <div key={index} className="border border-dashed rounded-md p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-medium text-muted-foreground">
                              Indicación {index + 1}
                            </h4>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeInstruction(index)}
                              data-testid={`button-remove-instruction-${index}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label>Categoría</Label>
                              <Select
                                value={inst.category}
                                onValueChange={(v) => updateInstruction(index, "category", v)}
                              >
                                <SelectTrigger className="mt-1" data-testid={`select-inst-category-${index}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="diet">Alimentación</SelectItem>
                                  <SelectItem value="exercise">Ejercicio</SelectItem>
                                  <SelectItem value="lifestyle">Estilo de vida</SelectItem>
                                  <SelectItem value="follow-up">Seguimiento</SelectItem>
                                  <SelectItem value="tests">Exámenes</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Prioridad</Label>
                              <Select
                                value={inst.priority}
                                onValueChange={(v) => updateInstruction(index, "priority", v)}
                              >
                                <SelectTrigger className="mt-1" data-testid={`select-inst-priority-${index}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Baja</SelectItem>
                                  <SelectItem value="normal">Normal</SelectItem>
                                  <SelectItem value="high">Alta</SelectItem>
                                  <SelectItem value="urgent">Urgente</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label>Título</Label>
                            <Input
                              value={inst.title}
                              onChange={(e) => updateInstruction(index, "title", e.target.value)}
                              placeholder="Título de la indicación"
                              className="mt-1"
                              data-testid={`input-inst-title-${index}`}
                            />
                          </div>
                          <div>
                            <Label>Descripción</Label>
                            <Textarea
                              value={inst.description}
                              onChange={(e) => updateInstruction(index, "description", e.target.value)}
                              placeholder="Descripción detallada..."
                              className="mt-1"
                              data-testid={`input-inst-description-${index}`}
                            />
                          </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="exams" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FlaskConical className="h-5 w-5" />
                    Órdenes de Exámenes
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addExam} data-testid="button-add-exam">
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {exams.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground" data-testid="exams-empty">
                      <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No hay exámenes solicitados</p>
                      <p className="text-xs mt-1">Agrega exámenes que el paciente debe realizarse</p>
                    </div>
                  ) : (
                    <>
                      {exams.map((exam, index) => (
                        <div key={index} className="border border-dashed rounded-md p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-medium text-muted-foreground">
                              Examen {index + 1}
                            </h4>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeExam(index)}
                              data-testid={`button-remove-exam-${index}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <div>
                            <Label>Nombre del examen</Label>
                            <Input
                              value={exam.name}
                              onChange={(e) => updateExam(index, "name", e.target.value)}
                              placeholder="Ej: Hemograma completo, Glicemia, TSH..."
                              className="mt-1"
                              data-testid={`input-exam-name-${index}`}
                            />
                          </div>
                          <div>
                            <Label>Justificación clínica</Label>
                            <Input
                              value={exam.justification || ""}
                              onChange={(e) => updateExam(index, "justification", e.target.value)}
                              placeholder="Ej: Sospecha de anemia ferropénica"
                              className="mt-1"
                              data-testid={`input-exam-justification-${index}`}
                            />
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <ClinicalAssistant appointmentId={id!} className="h-[350px]" />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Informe Médico
              </CardTitle>
            </CardHeader>
            <CardContent>
              {validationData.clinicalRecord.medicalReport ? (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-4 text-sm" data-testid="medical-report">
                    {(() => {
                      const r = validationData.clinicalRecord.medicalReport;
                      return (
                        <>
                          <div>
                            <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Datos del Paciente</h4>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <span>Nombre: {r.patientData.fullName}</span>
                              <span>Edad: {r.patientData.age ?? "No mencionada"}</span>
                              <span>Sexo: {r.patientData.sex}</span>
                              <span>Ocupación: {r.patientData.occupation}</span>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Motivo de Consulta</h4>
                            <p className="text-xs">{r.consultationData.reason}</p>
                          </div>
                          <div>
                            <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Enfermedad Actual</h4>
                            <div className="space-y-1 text-xs">
                              <p><strong>Descripción:</strong> {r.consultationData.currentIllness.description}</p>
                              <p><strong>Inicio:</strong> {r.consultationData.currentIllness.onset}</p>
                              <p><strong>Duración:</strong> {r.consultationData.currentIllness.duration}</p>
                              <p><strong>Síntomas asociados:</strong> {r.consultationData.currentIllness.associatedSymptoms}</p>
                              <p><strong>Factores modificadores:</strong> {r.consultationData.currentIllness.modifyingFactors}</p>
                              <p><strong>Tratamientos previos:</strong> {r.consultationData.currentIllness.previousTreatments}</p>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Antecedentes</h4>
                            <div className="space-y-1 text-xs">
                              <p><strong>Médicos:</strong> {r.medicalHistory.medical}</p>
                              <p><strong>Quirúrgicos:</strong> {r.medicalHistory.surgical}</p>
                              <p><strong>Alergias:</strong> {r.medicalHistory.allergies}</p>
                              <p><strong>Medicamentos:</strong> {r.medicalHistory.medications}</p>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Antecedentes Familiares</h4>
                            <p className="text-xs">{r.familyHistory}</p>
                          </div>
                          <div>
                            <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Hábitos</h4>
                            <div className="space-y-1 text-xs">
                              <p><strong>Alimentación:</strong> {r.habits.diet}</p>
                              <p><strong>Actividad física:</strong> {r.habits.physicalActivity}</p>
                              <p><strong>Sueño:</strong> {r.habits.sleep}</p>
                              <p><strong>Sustancias:</strong> {r.habits.substanceUse}</p>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Revisión por Sistemas</h4>
                            <p className="text-xs">{r.systemsReview}</p>
                          </div>
                          <div>
                            <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Examen Físico</h4>
                            <p className="text-xs">{r.physicalExam.systemsExploration}</p>
                          </div>
                          <div>
                            <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Impresión Diagnóstica</h4>
                            <p className="text-xs font-medium">{r.diagnosticImpression}</p>
                          </div>
                          <div>
                            <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Plan de Tratamiento</h4>
                            <div className="space-y-1 text-xs">
                              <p><strong>Tratamiento:</strong> {r.treatmentPlan.treatment}</p>
                              {r.treatmentPlan.tests.length > 0 && (
                                <div>
                                  <strong>Exámenes:</strong>
                                  <ul className="list-disc list-inside ml-2">
                                    {r.treatmentPlan.tests.map((t, i) => <li key={i}>{t}</li>)}
                                  </ul>
                                </div>
                              )}
                              {r.treatmentPlan.instructions.length > 0 && (
                                <div>
                                  <strong>Indicaciones:</strong>
                                  <ul className="list-disc list-inside ml-2">
                                    {r.treatmentPlan.instructions.map((inst, i) => <li key={i}>{inst}</li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-4 text-muted-foreground" data-testid="medical-report-empty">
                  <FileText className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  <p className="text-sm">No hay informe médico disponible</p>
                  <p className="text-xs mt-1">El informe se genera automáticamente a partir de la grabación de la consulta</p>
                </div>
              )}
            </CardContent>
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
                    <RefreshCw className="h-3.5 w-3.5" />
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
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2" data-testid="clinical-alerts-list">
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

