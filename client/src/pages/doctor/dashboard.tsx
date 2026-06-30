import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Clock,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import {
  formatDueLabel,
  urgencyStyles,
  type TaskUrgency,
} from "@shared/care-tasks";

type PendingTask = {
  id: number;
  text: string;
  dueAt: string;
  patientId: number;
  patientName: string;
  rut: string | null;
  createdByName: string;
  urgency: TaskUrgency;
};

type DashboardData = {
  greeting: string;
  dateLabel: string;
  timeLabel: string;
  stats: {
    totalResidents: number;
    assignedResidents: number;
    pendingTasks: number;
    criticalTasks: number;
    warningTasks: number;
  };
  pendingTasks: PendingTask[];
  taskStats: { critical: number; warning: number; normal: number };
  assignedResidents: Array<{
    id: number;
    firstName: string | null;
    lastName: string | null;
    rut: string | null;
  }>;
  recentResidents: Array<{
    id: number;
    firstName: string | null;
    lastName: string | null;
    rut: string | null;
  }>;
};

function TaskRow({ task }: { task: PendingTask }) {
  const style = urgencyStyles[task.urgency];
  return (
    <Link
      href={`/staff/patients/${task.patientId}`}
      className={`flex items-start gap-3 p-3 rounded-lg border ${style.border} ${style.bg} ${style.text} hover:opacity-95 transition-opacity`}
      data-testid={`task-${task.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-medium text-sm">{task.patientName}</span>
          {task.rut && (
            <span className={`text-xs font-mono ${style.muted}`}>{task.rut}</span>
          )}
          <Badge className={`text-[10px] px-1.5 py-0 ${style.badge}`}>{style.label}</Badge>
        </div>
        <p className="text-sm font-medium">{task.text}</p>
        <div className={`flex items-center gap-3 mt-1.5 text-xs ${style.muted}`}>
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

export default function StaffDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/staff/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid md:grid-cols-4 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-4">
        <p className="text-muted-foreground">No se pudo cargar el panel.</p>
        <Button onClick={() => refetch()}>Reintentar</Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto" data-testid="staff-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            Panel del hogar
          </h1>
          <p className="text-muted-foreground capitalize">{data.greeting} · {data.dateLabel}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {data.timeLabel}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Residentes</CardDescription>
            <CardTitle className="text-3xl">{data.stats.totalResidents}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>A tu cargo</CardDescription>
            <CardTitle className="text-3xl">{data.stats.assignedResidents}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tareas pendientes</CardDescription>
            <CardTitle className="text-3xl">{data.stats.pendingTasks}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-2">
            <CardDescription className="text-red-600 dark:text-red-400">Urgentes / vencidas</CardDescription>
            <CardTitle className="text-3xl text-red-600">{data.stats.criticalTasks}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader className="pb-2">
            <CardDescription className="text-amber-600 dark:text-amber-400">Próximas a vencer</CardDescription>
            <CardTitle className="text-3xl text-amber-600">{data.stats.warningTasks}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Tareas de cuidado del hogar
              </CardTitle>
              <CardDescription>
                Todas las actividades pendientes para los residentes, ordenadas por urgencia
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap text-xs font-medium">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-red-700 bg-red-300 text-red-950 dark:border-red-600 dark:bg-red-900 dark:text-red-50">
                Urgente / vencida
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber-600 bg-amber-100 text-amber-950 dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-50">
                Próxima
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-700 bg-blue-300 text-blue-950 dark:border-blue-600 dark:bg-blue-900 dark:text-blue-50">
                A tiempo
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.pendingTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2 py-4">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              No hay tareas pendientes en el hogar
            </p>
          ) : (
            data.pendingTasks.map((task) => <TaskRow key={task.id} task={task} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Residentes a tu cargo
            </CardTitle>
            <CardDescription>Acceso a todos los residentes del hogar</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/staff/patients">Ver todos</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {data.assignedResidents.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Aún no tienes residentes asignados. Al abrir una ficha quedarán a tu cargo.
              </p>
              <Button asChild>
                <Link href="/staff/patients">Ir a Residentes</Link>
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {data.assignedResidents.map((p) => (
                <Link
                  key={p.id}
                  href={`/staff/patients/${p.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                >
                  <div>
                    <div className="font-medium text-sm">
                      {p.firstName} {p.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.rut || "—"}</div>
                  </div>
                  <Badge variant="secondary">A cargo</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {data.recentResidents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Residentes recientes</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.recentResidents.map((p) => (
              <Link
                key={p.id}
                href={`/staff/patients/${p.id}`}
                className="p-3 rounded-lg border text-sm hover:bg-muted/50"
              >
                {p.firstName} {p.lastName}
                <div className="text-xs text-muted-foreground">{p.rut}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
