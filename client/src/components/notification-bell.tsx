import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell, Clock, UserCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDoctor } from "@/hooks/use-doctor";

type Notification = {
  id: string;
  type: "patient_online" | "patient_overtime" | "patient_waiting";
  appointmentId: number;
  patientId: number;
  patientName: string;
  title: string;
  message: string;
  timestamp: string;
  link: string;
};

const typeIcon = {
  patient_online: UserCheck,
  patient_waiting: Clock,
  patient_overtime: AlertCircle,
};

const typeColor = {
  patient_online: "text-green-600 dark:text-green-400",
  patient_waiting: "text-blue-600 dark:text-blue-400",
  patient_overtime: "text-amber-600 dark:text-amber-400",
};

export function NotificationBell() {
  const { isDoctor } = useDoctor();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/doctors/me/notifications"],
    enabled: isDoctor,
    refetchInterval: 15000,
  });

  if (!isDoctor) return null;

  const count = notifications.length;
  const hasOvertime = notifications.some((n) => n.type === "patient_overtime");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
          aria-label="Notificaciones"
        >
          <Bell className={`h-5 w-5 ${hasOvertime ? "text-amber-600 dark:text-amber-400" : ""}`} />
          {count > 0 && (
            <Badge
              variant={hasOvertime ? "destructive" : "default"}
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs flex items-center justify-center"
              data-testid="badge-notification-count"
            >
              {count > 9 ? "9+" : count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="popover-notifications">
        <div className="p-3 border-b">
          <h3 className="font-semibold text-sm" data-testid="text-notifications-title">
            Notificaciones
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {count === 0 ? "Sin notificaciones nuevas" : `${count} ${count === 1 ? "notificación" : "notificaciones"}`}
          </p>
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No tienes notificaciones nuevas.
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const Icon = typeIcon[n.type];
                return (
                  <Link key={n.id} href={n.link} data-testid={`notification-item-${n.id}`}>
                    <div className="p-3 hover:bg-accent cursor-pointer transition-colors">
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${typeColor[n.type]}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" data-testid={`text-notification-title-${n.id}`}>
                            {n.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
