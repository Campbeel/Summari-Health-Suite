export type TaskUrgency = "critical" | "warning" | "normal";

/** Urgente: vencida o vence en 15–30 min (también <15 min por inminencia) */
export const URGENCY_CRITICAL_MIN_MINUTES = 15;
export const URGENCY_CRITICAL_MAX_MINUTES = 30;
/** Próxima: entre 60 y 90 min antes del vencimiento */
export const URGENCY_WARNING_MIN_MINUTES = 60;
export const URGENCY_WARNING_MAX_MINUTES = 90;

export function getTaskUrgency(dueAt: string, now = new Date()): TaskUrgency {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "normal";
  const minutesUntil = (due.getTime() - now.getTime()) / (1000 * 60);

  if (minutesUntil < 0 || minutesUntil <= URGENCY_CRITICAL_MAX_MINUTES) return "critical";
  if (minutesUntil >= URGENCY_WARNING_MIN_MINUTES && minutesUntil <= URGENCY_WARNING_MAX_MINUTES) {
    return "warning";
  }
  return "normal";
}

const URGENCY_ORDER: Record<TaskUrgency, number> = {
  critical: 0,
  warning: 1,
  normal: 2,
};

export function isTaskDueToday(dueAt: string, now = new Date()): boolean {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

export function filterTodayTasks<T extends { dueAt: string }>(tasks: T[], now = new Date()): T[] {
  return tasks.filter((t) => isTaskDueToday(t.dueAt, now));
}

export function sortByUrgency<T extends { dueAt: string }>(tasks: T[], now = new Date()): T[] {
  return [...tasks].sort((a, b) => {
    const ua = getTaskUrgency(a.dueAt, now);
    const ub = getTaskUrgency(b.dueAt, now);
    if (ua !== ub) return URGENCY_ORDER[ua] - URGENCY_ORDER[ub];
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
}

export function formatDueLabel(dueAt: string, now = new Date()): string {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "Sin plazo";
  const diffMs = due.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 0) {
    const abs = Math.abs(diffMin);
    if (abs < 60) return `Vencida hace ${abs} min`;
    const h = Math.floor(abs / 60);
    return `Vencida hace ${h} h`;
  }
  if (diffMin < 60) return `En ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h < 24) return m > 0 ? `En ${h} h ${m} min` : `En ${h} h`;
  return due.toLocaleString("es-CL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getUrgencyBadgeLabel(
  dueAt: string,
  urgency: TaskUrgency,
  now = new Date(),
): string {
  if (urgency === "critical") {
    const due = new Date(dueAt);
    if (!Number.isNaN(due.getTime()) && due.getTime() < now.getTime()) {
      return "Vencida";
    }
    return "Urgente";
  }
  return urgencyStyles[urgency].label;
}

/** Solo el badge lleva color; la fila de tarea permanece neutra */
export const urgencyStyles: Record<TaskUrgency, { badge: string; label: string }> = {
  critical: {
    badge: "bg-red-600 text-white hover:bg-red-600 dark:bg-red-600 dark:text-white",
    label: "Urgente",
  },
  warning: {
    badge: "bg-yellow-500 text-yellow-950 hover:bg-yellow-500 dark:bg-amber-500 dark:text-white",
    label: "Próxima",
  },
  normal: {
    badge: "bg-blue-600 text-white hover:bg-blue-600 dark:bg-blue-600 dark:text-white",
    label: "A tiempo",
  },
};

export const urgencyLegend = [
  { urgency: "critical" as const, description: "Vencida o de 15 a 30 min antes del vencimiento" },
  { urgency: "warning" as const, description: "De 1 h a 1 h 30 min antes del vencimiento" },
  { urgency: "normal" as const, description: "Con más margen de tiempo" },
];
