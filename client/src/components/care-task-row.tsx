import { Link } from "wouter";
import { Clock, ChevronRight } from "lucide-react";
import { formatDueLabel, type TaskUrgency } from "@shared/care-tasks";
import { CareTaskUrgencyBadge } from "@/components/care-task-urgency-badge";

export type CareTaskRowData = {
  id: number;
  text: string;
  dueAt: string;
  patientId: number;
  patientName?: string;
  rut?: string | null;
  createdByName?: string;
  urgency: TaskUrgency;
};

type CareTaskRowProps = {
  task: CareTaskRowData;
  showResident?: boolean;
};

export function CareTaskRow({ task, showResident = true }: CareTaskRowProps) {
  return (
    <Link
      href={`/staff/patients/${task.patientId}`}
      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-foreground"
      data-testid={`task-${task.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {showResident && task.patientName && (
            <span className="font-medium text-sm">{task.patientName}</span>
          )}
          {showResident && task.rut && (
            <span className="text-xs font-mono text-muted-foreground">{task.rut}</span>
          )}
          <CareTaskUrgencyBadge dueAt={task.dueAt} urgency={task.urgency} />
        </div>
        <p className="text-sm">{task.text}</p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDueLabel(task.dueAt)}
          </span>
          {task.createdByName && <span>Asignada por {task.createdByName}</span>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 mt-1 text-muted-foreground" />
    </Link>
  );
}
