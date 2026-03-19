import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, User, Calendar, Phone, Mail, Droplets, AlertTriangle,
  Heart, FileText, Pill, FlaskConical, Video, PhoneCall, Clock,
  ShieldAlert, ClipboardList
} from "lucide-react";

type PatientProfile = {
  id: number;
  userId: string;
  rut: string | null;
  email: string | null;
  whatsapp: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  bloodType: string | null;
  allergies: string[] | null;
  medicalHistory: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
};

type AppointmentHistory = {
  id: number;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  status: string;
  consultationType: string;
  notes: string | null;
  doctorName: string;
  doctorSpecialty: string | null;
  diagnosis: string | null;
  hasPrescription: boolean;
};

type ClinicalRecord = {
  id: number;
  recordDate: string;
  chiefComplaint: string | null;
  symptoms: string[] | null;
  diagnosis: string | null;
  notes: string | null;
  doctorName: string;
  doctorSpecialty: string | null;
  hasPrescription: boolean;
};

type Prescription = {
  id: number;
  medications: Array<{ name: string; dosage: string; frequency: string; duration: string }>;
  instructions: string | null;
  issuedAt: string;
  validUntil: string | null;
  status: string;
  doctorName: string;
  doctorSpecialty: string | null;
  appointmentId: number | null;
};

type ExamOrder = {
  id: number;
  exams: Array<{ name: string; instructions?: string }>;
  clinicalJustification: string | null;
  issuedAt: string;
  status: string;
  doctorName: string;
  doctorSpecialty: string | null;
  appointmentId: number | null;
};

function getAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return "";
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age}`;
}

function getInitials(first: string | null, last: string | null): string {
  return `${(first || "")[0] || ""}${(last || "")[0] || ""}`.toUpperCase() || "P";
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Programada", variant: "outline" },
  confirmed: { label: "Confirmada", variant: "secondary" },
  in_progress: { label: "En curso", variant: "default" },
  completed: { label: "Completada", variant: "default" },
  pending_validation: { label: "Pendiente validación", variant: "secondary" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

export default function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(patientId || "0");

  const { data: patient, isLoading: loadingProfile } = useQuery<PatientProfile>({
    queryKey: ["/api/doctors/me/patients", id],
    enabled: id > 0,
  });

  const { data: history, isLoading: loadingHistory } = useQuery<AppointmentHistory[]>({
    queryKey: ["/api/doctors/me/patients", id, "history"],
    enabled: id > 0,
  });

  const { data: records, isLoading: loadingRecords } = useQuery<ClinicalRecord[]>({
    queryKey: ["/api/doctors/me/patients", id, "records"],
    enabled: id > 0,
  });

  const { data: prescriptions, isLoading: loadingPrescriptions } = useQuery<Prescription[]>({
    queryKey: ["/api/doctors/me/patients", id, "prescriptions"],
    enabled: id > 0,
  });

  const { data: examOrders, isLoading: loadingExams } = useQuery<ExamOrder[]>({
    queryKey: ["/api/doctors/me/patients", id, "exam-orders"],
    enabled: id > 0,
  });

  if (loadingProfile) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-5xl space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-5xl text-center">
        <p className="text-muted-foreground">Paciente no encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/doctor/patients")}>
          Volver
        </Button>
      </div>
    );
  }

  const fullName = `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Paciente";
  const age = getAge(patient.dateOfBirth);

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 gap-1"
        onClick={() => navigate("/doctor/patients")}
        data-testid="button-back"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a pacientes
      </Button>

      <Card className="mb-6" data-testid="patient-profile-card">
        <CardContent className="py-5 px-5">
          <div className="flex flex-col sm:flex-row gap-5">
            <Avatar className="h-20 w-20 flex-shrink-0">
              <AvatarImage src={patient.profileImageUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                {getInitials(patient.firstName, patient.lastName)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-xl font-bold" data-testid="text-patient-name">{fullName}</h1>
                {patient.rut && (
                  <Badge variant="outline" className="font-mono text-xs">{patient.rut}</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                {age && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span>{age} años · {patient.gender || "—"}</span>
                  </div>
                )}
                {patient.bloodType && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Droplets className="h-3.5 w-3.5" />
                    <span>Grupo: {patient.bloodType}</span>
                  </div>
                )}
                {patient.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{patient.email}</span>
                  </div>
                )}
                {patient.whatsapp && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{patient.whatsapp}</span>
                  </div>
                )}
                {patient.emergencyContact && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>{patient.emergencyContact} ({patient.emergencyPhone || "—"})</span>
                  </div>
                )}
              </div>

              {patient.allergies && patient.allergies.length > 0 && (
                <div className="mt-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {patient.allergies.map((a, i) => (
                      <Badge key={i} variant="destructive" className="text-xs">{a}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {patient.medicalHistory && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Antecedentes médicos</p>
                  <p className="text-sm bg-muted/50 rounded-md p-2" data-testid="text-medical-history">
                    {patient.medicalHistory}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="history" data-testid="tab-history">
            <Calendar className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="records" data-testid="tab-records">
            <ClipboardList className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Fichas
          </TabsTrigger>
          <TabsTrigger value="prescriptions" data-testid="tab-prescriptions">
            <Pill className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Recetas
          </TabsTrigger>
          <TabsTrigger value="exams" data-testid="tab-exams">
            <FlaskConical className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Exámenes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <HistoryTab history={history} loading={loadingHistory} />
        </TabsContent>
        <TabsContent value="records">
          <RecordsTab records={records} loading={loadingRecords} />
        </TabsContent>
        <TabsContent value="prescriptions">
          <PrescriptionsTab prescriptions={prescriptions} loading={loadingPrescriptions} />
        </TabsContent>
        <TabsContent value="exams">
          <ExamsTab examOrders={examOrders} loading={loadingExams} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HistoryTab({ history, loading }: { history?: AppointmentHistory[]; loading: boolean }) {
  if (loading) return <LoadingSkeleton />;
  if (!history || history.length === 0) return <EmptyState text="No hay consultas registradas" icon={Calendar} />;

  return (
    <div className="space-y-2" data-testid="history-list">
      {history.map((appt) => {
        const cfg = statusConfig[appt.status] || { label: appt.status, variant: "outline" as const };
        return (
          <Card key={appt.id} data-testid={`history-item-${appt.id}`}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium">
                      {new Date(appt.scheduledDate).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{appt.scheduledTime.slice(0, 5)}</span>
                    {appt.consultationType === "video" ? (
                      <Video className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <PhoneCall className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                    {appt.hasPrescription && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Pill className="h-3 w-3" /> Receta
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {appt.doctorName}{appt.doctorSpecialty ? ` · ${appt.doctorSpecialty}` : ""}
                  </p>
                  {appt.diagnosis && (
                    <p className="text-xs mt-1"><span className="font-medium">Dx:</span> {appt.diagnosis}</p>
                  )}
                  {appt.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">{appt.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                  <Clock className="h-3 w-3" />
                  {appt.durationMinutes} min
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RecordsTab({ records, loading }: { records?: ClinicalRecord[]; loading: boolean }) {
  if (loading) return <LoadingSkeleton />;
  if (!records || records.length === 0) return <EmptyState text="No hay fichas clínicas" icon={ClipboardList} />;

  return (
    <div className="space-y-2" data-testid="records-list">
      {records.map((rec) => (
        <Card key={rec.id} data-testid={`record-item-${rec.id}`}>
          <CardContent className="py-3 px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-medium">
                    {new Date(rec.recordDate).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {rec.doctorName}{rec.doctorSpecialty ? ` · ${rec.doctorSpecialty}` : ""}
                  </span>
                  {rec.hasPrescription && (
                    <Badge variant="secondary" className="text-[10px] gap-1"><Pill className="h-3 w-3" /> Receta</Badge>
                  )}
                </div>
                {rec.chiefComplaint && (
                  <p className="text-xs"><span className="font-medium">Motivo:</span> {rec.chiefComplaint}</p>
                )}
                {rec.diagnosis && (
                  <p className="text-xs mt-0.5"><span className="font-medium">Diagnóstico:</span> {rec.diagnosis}</p>
                )}
                {rec.symptoms && rec.symptoms.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {rec.symptoms.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PrescriptionsTab({ prescriptions, loading }: { prescriptions?: Prescription[]; loading: boolean }) {
  if (loading) return <LoadingSkeleton />;
  if (!prescriptions || prescriptions.length === 0) return <EmptyState text="No hay recetas" icon={Pill} />;

  return (
    <div className="space-y-2" data-testid="prescriptions-list">
      {prescriptions.map((rx) => (
        <Card key={rx.id} data-testid={`prescription-item-${rx.id}`}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-sm font-medium">
                {new Date(rx.issuedAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
              <span className="text-xs text-muted-foreground">
                {rx.doctorName}{rx.doctorSpecialty ? ` · ${rx.doctorSpecialty}` : ""}
              </span>
              <Badge variant={rx.status === "active" ? "default" : "secondary"} className="text-[10px]">
                {rx.status === "active" ? "Activa" : rx.status === "expired" ? "Vencida" : rx.status}
              </Badge>
            </div>
            <div className="space-y-1">
              {rx.medications.map((med, i) => (
                <div key={i} className="text-xs bg-muted/50 rounded p-2">
                  <span className="font-medium">{med.name}</span>
                  <span className="text-muted-foreground"> — {med.dosage}, {med.frequency}, {med.duration}</span>
                </div>
              ))}
            </div>
            {rx.instructions && (
              <p className="text-xs text-muted-foreground mt-2">{rx.instructions}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ExamsTab({ examOrders, loading }: { examOrders?: ExamOrder[]; loading: boolean }) {
  if (loading) return <LoadingSkeleton />;
  if (!examOrders || examOrders.length === 0) return <EmptyState text="No hay órdenes de exámenes" icon={FlaskConical} />;

  return (
    <div className="space-y-2" data-testid="exams-list">
      {examOrders.map((eo) => (
        <Card key={eo.id} data-testid={`exam-item-${eo.id}`}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-sm font-medium">
                {new Date(eo.issuedAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
              <span className="text-xs text-muted-foreground">
                {eo.doctorName}{eo.doctorSpecialty ? ` · ${eo.doctorSpecialty}` : ""}
              </span>
              <Badge variant={eo.status === "pending" ? "secondary" : "default"} className="text-[10px]">
                {eo.status === "pending" ? "Pendiente" : eo.status === "completed" ? "Completado" : eo.status}
              </Badge>
            </div>
            <div className="space-y-1">
              {eo.exams.map((exam, i) => (
                <div key={i} className="text-xs bg-muted/50 rounded p-2">
                  <span className="font-medium">{exam.name}</span>
                  {exam.instructions && (
                    <span className="text-muted-foreground"> — {exam.instructions}</span>
                  )}
                </div>
              ))}
            </div>
            {eo.clinicalJustification && (
              <p className="text-xs text-muted-foreground mt-2">
                <span className="font-medium">Justificación:</span> {eo.clinicalJustification}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 w-full rounded-lg" />
      ))}
    </div>
  );
}

function EmptyState({ text, icon: Icon }: { text: string; icon: typeof Calendar }) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <Icon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">{text}</p>
      </CardContent>
    </Card>
  );
}
