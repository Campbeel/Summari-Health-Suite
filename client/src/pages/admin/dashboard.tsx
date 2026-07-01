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
} from "lucide-react";
import { CareTasksPanel } from "@/components/care-tasks-panel";
import type { TaskUrgency } from "@shared/care-tasks";

interface AdminStats {
  staffCount: number;
  residentCount: number;
  pendingTasks: number;
  criticalTasks: number;
  warningTasks: number;
  normalTasks: number;
  resolvedTasks: number;
  dateLabel?: string;
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

      <CareTasksPanel tasks={stats.recentTasks} dateLabel={stats.dateLabel} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-pending-tasks">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Tareas hoy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="stat-pending-tasks">{stats.pendingTasks}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" /> Urgentes hoy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600" data-testid="stat-critical">{stats.criticalTasks}</p>
          </CardContent>
        </Card>
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
        <Card data-testid="card-resolved-tasks">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Completadas (total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="stat-resolved-tasks">{stats.resolvedTasks}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
