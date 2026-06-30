export type TaskUrgency = "critical" | "warning" | "normal";

/** Horas hasta el vencimiento: rojo ≤2h (incluye vencidas), amarillo ≤24h, azul el resto */
export const URGENCY_CRITICAL_HOURS = 2;
export const URGENCY_WARNING_HOURS = 24;

export function getTaskUrgency(dueAt: string, now = new Date()): TaskUrgency {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "warning";
  const hoursUntil = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntil <= URGENCY_CRITICAL_HOURS) return "critical";
  if (hoursUntil <= URGENCY_WARNING_HOURS) return "warning";
  return "normal";
}

const URGENCY_ORDER: Record<TaskUrgency, number> = {
  critical: 0,
  warning: 1,
  normal: 2,
};

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
  if (h < 24) return `En ${h} h`;
  return due.toLocaleString("es-CL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const urgencyStyles: Record<
  TaskUrgency,
  { border: string; bg: string; text: string; muted: string; badge: string; label: string }
> = {
  critical: {
    border: "border-red-700 dark:border-red-600",
    bg: "bg-red-300 dark:bg-red-900",
    text: "text-red-950 dark:text-red-50",
    muted: "text-red-900/90 dark:text-red-100/90",
    badge: "bg-red-800 text-white dark:bg-red-700",
    label: "Urgente / vencida",
  },
  warning: {
    border: "border-amber-600 dark:border-amber-500",
    bg: "bg-amber-100 dark:bg-amber-950/60",
    text: "text-amber-950 dark:text-amber-50",
    muted: "text-amber-900/85 dark:text-amber-100/85",
    badge: "bg-amber-600 text-white dark:bg-amber-600",
    label: "Próxima",
  },
  normal: {
    border: "border-blue-700 dark:border-blue-600",
    bg: "bg-blue-300 dark:bg-blue-900",
    text: "text-blue-950 dark:text-blue-50",
    muted: "text-blue-900/90 dark:text-blue-100/90",
    badge: "bg-blue-800 text-white dark:bg-blue-700",
    label: "A tiempo",
  },
};
