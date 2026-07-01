import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CareTasksPanel } from "@/components/care-tasks-panel";
import {
  LayoutDashboard,
  Users,
  Clock,
} from "lucide-react";
import type { TaskUrgency } from "@shared/care-tasks";

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

export default function StaffDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/staff/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
        <div className="grid md:grid-cols-4 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
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

      <CareTasksPanel tasks={data.pendingTasks} dateLabel={data.dateLabel} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tareas hoy</CardDescription>
            <CardTitle className="text-3xl">{data.stats.pendingTasks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-red-600 dark:text-red-400">Urgentes hoy</CardDescription>
            <CardTitle className="text-3xl text-red-600">{data.stats.criticalTasks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-amber-600 dark:text-amber-400">Próximas hoy</CardDescription>
            <CardTitle className="text-3xl text-amber-600">{data.stats.warningTasks}</CardTitle>
          </CardHeader>
        </Card>
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
      </div>

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
