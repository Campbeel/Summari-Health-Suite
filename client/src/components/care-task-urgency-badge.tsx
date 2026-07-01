import { cn } from "@/lib/utils";
import { getUrgencyBadgeLabel, type TaskUrgency } from "@shared/care-tasks";

type CareTaskUrgencyBadgeProps = {
  dueAt: string;
  urgency: TaskUrgency;
  className?: string;
};

/** Clases literales aquí para que Tailwind las incluya en el bundle CSS */
function urgencyBadgeClasses(urgency: TaskUrgency): string {
  switch (urgency) {
    case "critical":
      return "bg-red-600 text-white dark:bg-red-600 dark:text-white";
    case "warning":
      return "bg-yellow-500 text-yellow-950 dark:bg-amber-500 dark:text-white";
    case "normal":
      return "bg-blue-600 text-white dark:bg-blue-600 dark:text-white";
  }
}

export function CareTaskUrgencyBadge({ dueAt, urgency, className }: CareTaskUrgencyBadgeProps) {
  const label = getUrgencyBadgeLabel(dueAt, urgency);

  return (
    <span
      data-testid={`urgency-badge-${urgency}`}
      className={cn(
        "whitespace-nowrap inline-flex items-center rounded-md px-1.5 py-0 text-[10px] font-semibold shrink-0",
        urgencyBadgeClasses(urgency),
        className,
      )}
    >
      {label}
    </span>
  );
}
