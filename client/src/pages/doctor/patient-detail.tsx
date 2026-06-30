import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { SpeechTextarea } from "@/components/speech-textarea";
import { PatientClinicalAssistant } from "@/components/patient-clinical-assistant";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Droplets,
  AlertTriangle,
  Plus,
  CheckCircle2,
  Loader2,
  Clock,
} from "lucide-react";
import {
  formatDueLabel,
  getTaskUrgency,
  urgencyStyles,
} from "@shared/care-tasks";

type PatientProfile = {
  id: number;
  rut: string | null;
  email: string | null;
  whatsapp: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  bloodType: string | null;
  allergies: string[] | null;
  medicalHistory: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
};

type CareSession = {
  id: number;
  anamnesis: string | null;
  status: string;
  completedByName: string | null;
  completedAt: string | null;
};

type ResidentTask = {
  id: number;
  text: string;
  dueAt: string;
  resolved: boolean;
  resolvedByName: string | null;
  createdByName: string;
  createdAt: string;
};

function defaultDueLocal(): string {
  const d = new Date();
  d.setHours(d.getHours() + 4, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  return `${(first || "")[0] || ""}${(last || "")[0] || ""}`.toUpperCase() || "R";
}

export default function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const id = parseInt(patientId || "0");

  const [anamnesis, setAnamnesis] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newTaskDueAt, setNewTaskDueAt] = useState(defaultDueLocal);

  const { data, isLoading } = useQuery<{ profile: PatientProfile; session: CareSession | null }>({
    queryKey: ["/api/staff/patients", id, "care"],
    queryFn: async () => {
      const res = await fetch(`/api/staff/patients/${id}/care`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("No se pudo cargar la ficha");
      return res.json();
    },
    enabled: id > 0,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<ResidentTask[]>({
    queryKey: ["/api/staff/patients", id, "tasks"],
    queryFn: async () => {
      const res = await fetch(`/api/staff/patients/${id}/tasks`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("No se pudieron cargar las tareas");
      return res.json();
    },
    enabled: id > 0,
  });

  useEffect(() => {
    if (data?.session) {
      setAnamnesis(data.session.anamnesis || data.profile.medicalHistory || "");
    } else if (data?.profile) {
      setAnamnesis(data.profile.medicalHistory || "");
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { anamnesis: string }) => {
      const res = await apiRequest("PUT", `/api/staff/patients/${id}/care`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/patients", id, "care"] });
      toast({ title: "Registro guardado" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/staff/patients/${id}/tasks`, {
        text: newTask.trim(),
        dueAt: new Date(newTaskDueAt).toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/patients", id, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/dashboard"] });
      setNewTask("");
      setNewTaskDueAt(defaultDueLocal());
      toast({ title: "Tarea asignada", description: "Aparecerá en el panel del hogar" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, resolved }: { taskId: number; resolved: boolean }) => {
      const res = await apiRequest("PATCH", `/api/staff/patients/${id}/tasks/${taskId}`, { resolved });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/patients", id, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/dashboard"] });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/staff/patients/${id}/care`, { anamnesis });
      const res = await apiRequest("POST", `/api/staff/patients/${id}/care/complete`);
      return res.json();
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/dashboard"] });
      toast({
        title: "Registro finalizado",
        description: `Realizado por ${session.completedByName}`,
      });
      navigate("/staff/dashboard");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 p-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const patient = data?.profile;
  if (!patient) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Residente no encontrado</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/staff/patients")}>
          Volver
        </Button>
      </div>
    );
  }

  const fullName = `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Residente";
  const isCompleted = data?.session?.status === "completed";
  const pendingTasks = tasks.filter((t) => !t.resolved);
  const resolvedTasks = tasks.filter((t) => t.resolved);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/staff/patients")} data-testid="button-back">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver a residentes
      </Button>

      <Card>
        <CardContent className="py-5">
          <div className="flex gap-4 flex-col sm:flex-row">
            <Avatar className="h-16 w-16">
              <AvatarImage src={patient.profileImageUrl || undefined} />
              <AvatarFallback>{getInitials(patient.firstName, patient.lastName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold" data-testid="text-patient-name">{fullName}</h1>
                {patient.rut && <Badge variant="outline" className="font-mono">{patient.rut}</Badge>}
                {isCompleted && (
                  <Badge variant="secondary">
                    Registro por {data?.session?.completedByName}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {patient.dateOfBirth && (
                  <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{getAge(patient.dateOfBirth)} años</span>
                )}
                {patient.bloodType && (
                  <span className="flex items-center gap-1"><Droplets className="h-3.5 w-3.5" />{patient.bloodType}</span>
                )}
                {patient.email && (
                  <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{patient.email}</span>
                )}
                {patient.whatsapp && (
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{patient.whatsapp}</span>
                )}
              </div>
              {patient.allergies && patient.allergies.length > 0 && (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {patient.allergies.map((a, i) => (
                      <Badge key={i} variant="destructive" className="text-xs">{a}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Registro de cuidado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SpeechTextarea
              value={anamnesis}
              onChange={setAnamnesis}
              placeholder="Notas sobre el residente. Usa el botón de escucha para dictar..."
              rows={10}
              data-testid="input-anamnesis"
            />
            <Button
              variant="outline"
              onClick={() => saveMutation.mutate({ anamnesis })}
              disabled={saveMutation.isPending || isCompleted}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar registro
            </Button>
          </CardContent>
        </Card>

        <PatientClinicalAssistant patientId={id} className="min-h-[420px]" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tareas de cuidado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="new-task">Actividad</Label>
              <Input
                id="new-task"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Ej: Administrar medicamento, acompañar al comedor..."
                disabled={isCompleted}
                data-testid="input-new-task"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Vence</Label>
              <Input
                id="task-due"
                type="datetime-local"
                value={newTaskDueAt}
                onChange={(e) => setNewTaskDueAt(e.target.value)}
                disabled={isCompleted}
                data-testid="input-task-due"
              />
            </div>
            <Button
              onClick={() => createTaskMutation.mutate()}
              disabled={isCompleted || !newTask.trim() || createTaskMutation.isPending}
              data-testid="button-add-task"
            >
              {createTaskMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>

          {tasksLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : pendingTasks.length === 0 && resolvedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin tareas. Las actividades asignadas aparecerán en el panel del hogar con código de colores según su plazo.
            </p>
          ) : (
            <div className="space-y-2">
              {pendingTasks.map((task) => {
                const dueIso = typeof task.dueAt === "string" ? task.dueAt : new Date(task.dueAt).toISOString();
                const urgency = getTaskUrgency(dueIso);
                const style = urgencyStyles[urgency];
                return (
                  <label
                    key={task.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${style.border} ${style.bg} ${style.text}`}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={false}
                      onCheckedChange={() => toggleTaskMutation.mutate({ taskId: task.id, resolved: true })}
                      disabled={toggleTaskMutation.isPending}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{task.text}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 ${style.badge}`}>{style.label}</Badge>
                      </div>
                      <div className={`flex items-center gap-3 mt-1 text-xs ${style.muted}`}>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDueLabel(dueIso)}
                        </span>
                        <span>Por {task.createdByName}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
              {resolvedTasks.length > 0 && (
                <div className="pt-2 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Completadas</p>
                  {resolvedTasks.map((task) => (
                    <label
                      key={task.id}
                      className="flex items-center gap-3 p-2 rounded-lg border opacity-60"
                    >
                      <Checkbox
                        checked
                        onCheckedChange={() => toggleTaskMutation.mutate({ taskId: task.id, resolved: false })}
                      />
                      <span className="text-sm line-through flex-1">{task.text}</span>
                      {task.resolvedByName && (
                        <span className="text-xs text-muted-foreground">por {task.resolvedByName}</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!isCompleted && (
        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending}
            data-testid="button-complete-care"
          >
            {completeMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Finalizar registro
          </Button>
        </div>
      )}
    </div>
  );
}
