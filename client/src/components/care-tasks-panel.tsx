import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import { urgencyLegend } from "@shared/care-tasks";
import { CareTaskRow, type CareTaskRowData } from "@/components/care-task-row";
import { CareTaskUrgencyBadge } from "@/components/care-task-urgency-badge";

type CareTasksPanelProps = {
  tasks: CareTaskRowData[];
  dateLabel?: string;
};

export function CareTasksPanel({ tasks, dateLabel }: CareTasksPanelProps) {
  return (
    <Card data-testid="care-tasks-panel">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Tareas de cuidado del día
            </CardTitle>
            <CardDescription>
              {dateLabel
                ? `Pendientes para hoy · ${dateLabel}`
                : "Solo actividades con vencimiento hoy"}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {urgencyLegend.map((item) => (
              <span key={item.urgency} className="flex items-center gap-2">
                <CareTaskUrgencyBadge
                  dueAt={
                    item.urgency === "critical"
                      ? new Date(Date.now() - 5 * 60 * 1000).toISOString()
                      : item.urgency === "warning"
                        ? new Date(Date.now() + 75 * 60 * 1000).toISOString()
                        : new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
                  }
                  urgency={item.urgency}
                />
                <span>{item.description}</span>
              </span>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2 py-4">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            No hay tareas pendientes para hoy
          </p>
        ) : (
          tasks.map((task) => <CareTaskRow key={task.id} task={task} />)
        )}
      </CardContent>
    </Card>
  );
}
