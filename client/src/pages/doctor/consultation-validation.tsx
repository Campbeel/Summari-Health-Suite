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
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  FileText,
  Pill,
  ClipboardList,
  Sparkles,
  Check,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  ArrowLeft,
  User,
  Mic,
  Save,
  Activity,
  Heart,
  FlaskConical,
  Mail,
  Send,
  CheckCircle,
} from "lucide-react";

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
  instructions?: string;
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
    dateOfBirth?: string;
    gender?: string;
    bloodType?: string;
    allergies?: string[];
  };
  clinicalRecord: {
    id: number;
    chiefComplaint?: string;
    symptoms?: string[];
    clinicalDiagnosis?: string; // Corrected field name if needed, or stick to diagnosis
    diagnosis?: string;
    notes?: string;
    transcription?: string;
  };
  prescription: {
    medications: Medication[];
    instructions?: string;
  } | null;
  medicalInstructions: MedicalInstructionDraft[];
  examOrders: {
    exams: Exam[];
    clinicalJustification?: string;
  } | null;
}

interface AISuggestions {
  clinicalSummary: {
    chiefComplaint?: string;
    symptoms?: string[];
    diagnosis?: string;
    notes?: string;
  } | null;
  prescription: {
    medications: Medication[];
    instructions?: string;
  } | null;
  medicalInstructions: MedicalInstructionDraft[];
  examOrders?: Exam[];
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
  const [prescriptionInstructions, setPrescriptionInstructions] = useState("");

  const [instructions, setInstructions] = useState<MedicalInstructionDraft[]>([]);
  
  const [exams, setExams] = useState<Exam[]>([]);
  const [clinicalJustification, setClinicalJustification] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [sendPrescription, setSendPrescription] = useState(true);
  const [sendInstructions, setSendInstructions] = useState(true);
  const [sendExams, setSendExams] = useState(true);
  const [emailSent, setEmailSent] = useState(false);

  const [isInitialized, setIsInitialized] = useState(false);

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
        setPrescriptionInstructions(validationData.prescription.instructions || "");
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
        setExams(validationData.examOrders.exams || []);
        setClinicalJustification(validationData.examOrders.clinicalJustification || "");
      }

      setIsInitialized(true);
    }
  }, [validationData, isInitialized]);

  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/consultations/${id}/generate-suggestions`);
      return response.json() as Promise<AISuggestions>;
    },
    onSuccess: (data) => {
      if (data.clinicalSummary) {
        if (data.clinicalSummary.chiefComplaint) setChiefComplaint(data.clinicalSummary.chiefComplaint);
        if (data.clinicalSummary.symptoms) setSymptoms(data.clinicalSummary.symptoms);
        if (data.clinicalSummary.diagnosis) setDiagnosis(data.clinicalSummary.diagnosis);
        if (data.clinicalSummary.notes) setClinicalNotes(data.clinicalSummary.notes);
      }
      if (data.prescription) {
        setMedications(data.prescription.medications || []);
        setPrescriptionInstructions(data.prescription.instructions || "");
      }
      if (data.medicalInstructions?.length > 0) {
        setInstructions(data.medicalInstructions);
      }
      if (data.examOrders && data.examOrders.length > 0) {
        setExams(data.examOrders);
      }
      toast({
        title: "Sugerencias generadas",
        description: "La IA ha analizado la transcripción. Revisa y edita la información.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron generar las sugerencias de la IA",
        variant: "destructive",
      });
    },
  });

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
          instructions: prescriptionInstructions,
        } : null,
        medicalInstructions: instructions,
        examOrders: exams.length > 0 ? {
          exams,
          clinicalJustification,
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
    setExams(prev => [...prev, { name: "", instructions: "" }]);
  };

  const updateExam = (index: number, field: keyof Exam, value: string) => {
    setExams(prev => prev.map((exam, i) =>
      i === index ? { ...exam, [field]: value } : exam
    ));
  };

  const removeExam = (index: number) => {
    setExams(prev => prev.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-96" />
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

  const hasTranscription = !!validationData.clinicalRecord.transcription;

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
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
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
          {hasTranscription && (
            <Button
              variant="outline"
              onClick={() => generateSuggestionsMutation.mutate()}
              disabled={generateSuggestionsMutation.isPending}
              data-testid="button-generate-suggestions"
            >
              {generateSuggestionsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generar sugerencias IA
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
                      <p className="text-xs mt-1">Agrega medicamentos manualmente o genera sugerencias con IA</p>
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
                      <div>
                        <Label htmlFor="prescriptionInstructions">Instrucciones generales</Label>
                        <Textarea
                          id="prescriptionInstructions"
                          value={prescriptionInstructions}
                          onChange={(e) => setPrescriptionInstructions(e.target.value)}
                          placeholder="Instrucciones generales para el paciente..."
                          className="mt-1.5"
                          data-testid="input-prescription-instructions"
                        />
                      </div>
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
                      <p className="text-xs mt-1">Agrega indicaciones manualmente o genera sugerencias con IA</p>
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
                            <Label>Instrucciones para el paciente</Label>
                            <Input
                              value={exam.instructions || ""}
                              onChange={(e) => updateExam(index, "instructions", e.target.value)}
                              placeholder="Ej: Ayuno de 12 horas"
                              className="mt-1"
                              data-testid={`input-exam-instructions-${index}`}
                            />
                          </div>
                        </div>
                      ))}
                      <div>
                        <Label htmlFor="clinicalJustification">Justificación clínica</Label>
                        <Textarea
                          id="clinicalJustification"
                          value={clinicalJustification}
                          onChange={(e) => setClinicalJustification(e.target.value)}
                          placeholder="Justificación clínica para los exámenes solicitados..."
                          className="mt-1.5"
                          data-testid="input-clinical-justification"
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Paciente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium" data-testid="text-patient-name">{validationData.patient.name}</p>
              {validationData.patient.gender && (
                <p className="text-sm text-muted-foreground">
                  Género: {validationData.patient.gender}
                </p>
              )}
              {validationData.patient.bloodType && (
                <p className="text-sm text-muted-foreground">
                  Tipo de sangre: {validationData.patient.bloodType}
                </p>
              )}
              {validationData.patient.allergies && validationData.patient.allergies.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Alergias
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {validationData.patient.allergies.map((a, i) => (
                      <Badge key={i} variant="destructive" className="text-xs" data-testid={`badge-allergy-${i}`}>
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Transcripción
              </CardTitle>
            </CardHeader>
            <CardContent>
              {validationData.clinicalRecord.transcription ? (
                <ScrollArea className="max-h-64">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-transcription">
                    {validationData.clinicalRecord.transcription}
                  </p>
                </ScrollArea>
              ) : (
                <div className="text-center py-4 text-muted-foreground" data-testid="transcription-empty">
                  <Mic className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  <p className="text-sm">No hay transcripción disponible</p>
                </div>
              )}
            </CardContent>
          </Card>

          <WearableInsightsCard patientId={validationData.patient.id} />

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
            {hasTranscription && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => generateSuggestionsMutation.mutate()}
                disabled={generateSuggestionsMutation.isPending}
                data-testid="button-generate-suggestions-sidebar"
              >
                {generateSuggestionsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Sugerencias IA
              </Button>
            )}
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

interface MetricSummary {
  metricType: string;
  avg: number;
  min: number;
  max: number;
  count: number;
  latestValue: string;
  unit: string;
}

const METRIC_LABELS: Record<string, string> = {
  heart_rate: "FC",
  steps: "Pasos",
  sleep_duration: "Sueño",
  spo2: "SpO₂",
  bp_systolic: "PA Sist.",
  bp_diastolic: "PA Diast.",
  weight: "Peso",
  temperature: "Temp.",
  calories: "Calorías",
};

function WearableInsightsCard({ patientId }: { patientId: number }) {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const { data: summary, isLoading } = useQuery<MetricSummary[]>({
    queryKey: [`/api/doctor/patients/${patientId}/wearable-metrics/summary`],
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/doctor/patients/${patientId}/wearable-metrics/ai-analysis`);
      return res.json();
    },
    onSuccess: (data: { analysis: string }) => {
      setAiAnalysis(data.analysis);
    },
    onError: () => {
      setAiAnalysis("Error al generar análisis");
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Datos Wearable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Datos Wearable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-2">Sin datos de dispositivos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Datos Wearable
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          {summary.map(s => (
            <div key={s.metricType} className="flex items-center justify-between text-sm" data-testid={`wearable-summary-${s.metricType}`}>
              <span className="text-muted-foreground">{METRIC_LABELS[s.metricType] || s.metricType}</span>
              <span className="font-medium">{s.latestValue} {s.unit}</span>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => aiMutation.mutate()}
          disabled={aiMutation.isPending}
          data-testid="button-ai-wearable-analysis"
        >
          {aiMutation.isPending ? (
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
          ) : (
            <Heart className="h-3 w-3 mr-1.5" />
          )}
          Análisis IA
        </Button>

        {aiAnalysis && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md whitespace-pre-wrap" data-testid="text-ai-wearable-analysis">
            {aiAnalysis}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
