import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Building2,
  Users,
  UserCog,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
} from "lucide-react";
import {
  formatDueLabel,
  urgencyStyles,
  type TaskUrgency,
} from "@shared/care-tasks";

interface AdminStats {
  staffCount: number;
  residentCount: number;
  pendingTasks: number;
  criticalTasks: number;
  warningTasks: number;
  normalTasks: number;
  resolvedTasks: number;
  recentTasks: Array<{
    id: number;
    text: string;
    dueAt: string;
    patientId: number;
    patientName: string;
    rut: string | null;
    createdByName: string;
    urgency: TaskUrgency;
  }>;
}

interface OrgInfo {
  id: string;
  name: string;
  rut: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
}

function TaskRow({ task }: { task: AdminStats["recentTasks"][number] }) {
  const style = urgencyStyles[task.urgency];
  return (
    <Link
      href={`/staff/patients/${task.patientId}`}
      className={`flex items-start gap-3 p-3 rounded-lg border ${style.border} ${style.bg} ${style.text} hover:opacity-95 transition-opacity`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-medium text-sm">{task.patientName}</span>
          {task.rut && <span className={`text-xs font-mono ${style.muted}`}>{task.rut}</span>}
          <Badge className={`text-[10px] px-1.5 py-0 ${style.badge}`}>{style.label}</Badge>
        </div>
        <p className="text-sm font-medium">{task.text}</p>
        <div className={`flex items-center gap-3 mt-1 text-xs ${style.muted}`}>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDueLabel(task.dueAt)}
          </span>
          <span>Asignada por {task.createdByName}</span>
        </div>
      </div>
      <ChevronRight className={`h-4 w-4 shrink-0 mt-1 ${style.muted}`} />
    </Link>
  );
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useQuery<AdminStats>({ queryKey: ["/api/admin/stats"] });
  const { data: org } = useQuery<OrgInfo>({ queryKey: ["/api/admin/me/organization"] });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return <div className="p-6">No hay estadísticas disponibles</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-admin-title">Panel del hogar</h1>
          {org && (
            <p className="text-muted-foreground flex items-center gap-2 mt-1" data-testid="text-org-name">
              <Building2 className="h-4 w-4" /> {org.name}
            </p>
          )}
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/users">Gestionar personal</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-residents">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Residentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="stat-residents">{stats.residentCount}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-staff">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <UserCog className="h-4 w-4" /> Personal activo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="stat-staff">{stats.staffCount}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-pending-tasks">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Tareas pendientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="stat-pending-tasks">{stats.pendingTasks}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-resolved-tasks">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Tareas completadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="stat-resolved-tasks">{stats.resolvedTasks}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" /> Urgentes / vencidas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600" data-testid="stat-critical">{stats.criticalTasks}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader className="pb-2">
            <CardDescription className="text-amber-600 dark:text-amber-400">Próximas a vencer</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600" data-testid="stat-warning">{stats.warningTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>A tiempo</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600" data-testid="stat-normal">{stats.normalTasks}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tareas de cuidado pendientes</CardTitle>
          <CardDescription>Actividades del hogar que requieren atención del personal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {stats.recentTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No hay tareas pendientes en el hogar
            </p>
          ) : (
            stats.recentTasks.map((task) => <TaskRow key={task.id} task={task} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
