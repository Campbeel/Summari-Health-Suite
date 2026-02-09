import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Save, DollarSign } from "lucide-react";
import { useEffect } from "react";

const DAYS_OF_WEEK = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

interface DayAvailability {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

interface WeeklyAvailability {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

// API returns availability in a different format
interface ApiAvailability {
  [day: string]: { start: string; end: string }[] | undefined;
}

interface DoctorProfile {
  id: number;
  specialty: string;
  bio?: string;
  consultationFee: number; // in cents from API
  availability?: ApiAvailability;
}

// Transform API availability format to UI format
function transformAvailability(apiAvailability?: ApiAvailability): WeeklyAvailability {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
  const result = { ...defaultAvailability };
  
  if (!apiAvailability) return result;
  
  days.forEach((day) => {
    const slots = apiAvailability[day];
    if (slots && slots.length > 0) {
      result[day] = {
        enabled: true,
        startTime: slots[0].start || "09:00",
        endTime: slots[0].end || "17:00",
      };
    } else {
      result[day] = {
        enabled: false,
        startTime: "09:00",
        endTime: "17:00",
      };
    }
  });
  
  return result;
}

// Transform UI availability format back to API format
function transformToApiFormat(uiAvailability: WeeklyAvailability): ApiAvailability {
  const result: ApiAvailability = {};
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
  
  days.forEach((day) => {
    const dayData = uiAvailability[day];
    if (dayData.enabled) {
      result[day] = [{ start: dayData.startTime, end: dayData.endTime }];
    }
  });
  
  return result;
}

const profileSchema = z.object({
  bio: z.string().optional(),
  consultationFee: z.number().min(0, "La tarifa no puede ser negativa"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const defaultAvailability: WeeklyAvailability = {
  monday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  tuesday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  wednesday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  thursday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  friday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  saturday: { enabled: false, startTime: "09:00", endTime: "13:00" },
  sunday: { enabled: false, startTime: "09:00", endTime: "13:00" },
};

function formatCurrency(amount: number): string {
  return amount.toString();
}

function parseCurrency(value: string): number {
  const parsed = parseInt(value);
  if (isNaN(parsed)) return 0;
  return parsed;
}

export default function DoctorProfilePage() {
  const { toast } = useToast();

  const { data: profile, isLoading } = useQuery<DoctorProfile>({
    queryKey: ["/api/doctors/me"],
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      bio: "",
      consultationFee: 0,
    },
  });

  const availability = transformAvailability(profile?.availability);

  useEffect(() => {
    if (profile) {
      form.reset({
        bio: profile.bio || "",
        consultationFee: profile.consultationFee || 0,
      });
    }
  }, [profile, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const response = await apiRequest("PATCH", "/api/doctors/me/profile", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/me"] });
      toast({
        title: "Perfil actualizado",
        description: "Tu información profesional ha sido guardada correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el perfil",
        variant: "destructive",
      });
    },
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: async (data: WeeklyAvailability) => {
      // Transform to API format before sending
      const apiAvailability = transformToApiFormat(data);
      const response = await apiRequest("PATCH", "/api/doctors/me/availability", { availability: apiAvailability });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/me"] });
      toast({
        title: "Horario actualizado",
        description: "Tu disponibilidad ha sido guardada correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la disponibilidad",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileFormValues) => {
    updateProfileMutation.mutate(data);
  };

  const handleAvailabilityChange = (
    day: keyof WeeklyAvailability,
    field: keyof DayAvailability,
    value: boolean | string
  ) => {
    const newAvailability = {
      ...availability,
      [day]: {
        ...availability[day],
        [field]: value,
      },
    };
    updateAvailabilityMutation.mutate(newAvailability);
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-page-title">
          Mi Perfil Profesional
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tu información profesional y horarios
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información Profesional</CardTitle>
          <CardDescription>
            Esta información será visible para tus pacientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <FormLabel>Especialidad</FormLabel>
                <div className="mt-2">
                  <Badge variant="secondary" className="text-base px-3 py-1" data-testid="text-specialty">
                    {profile?.specialty || "No especificada"}
                  </Badge>
                </div>
                <FormDescription className="mt-1">
                  Contacta al administrador para cambiar tu especialidad
                </FormDescription>
              </div>

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Biografía Profesional</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Escribe una breve descripción sobre tu experiencia y formación..."
                        className="min-h-[120px] resize-none"
                        data-testid="input-bio"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Máximo 500 caracteres
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="consultationFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarifa de Consulta</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          placeholder="0"
                          className="pl-9"
                          data-testid="input-consultation-fee"
                          value={formatCurrency(field.value)}
                          onChange={(e) => field.onChange(parseCurrency(e.target.value))}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Tarifa en CLP para cada consulta
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateProfileMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horario de Disponibilidad</CardTitle>
          <CardDescription>
            Configura los días y horas en los que estás disponible para consultas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {DAYS_OF_WEEK.map(({ key, label }) => {
              const dayKey = key as keyof WeeklyAvailability;
              const dayAvailability = availability[dayKey];
              
              return (
                <div 
                  key={key} 
                  className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border"
                  data-testid={`availability-${key}`}
                >
                  <div className="flex items-center gap-3 min-w-[140px]">
                    <Switch
                      checked={dayAvailability.enabled}
                      onCheckedChange={(checked) => 
                        handleAvailabilityChange(dayKey, "enabled", checked)
                      }
                      data-testid={`switch-${key}`}
                    />
                    <span className={`font-medium ${!dayAvailability.enabled ? "text-muted-foreground" : ""}`}>
                      {label}
                    </span>
                  </div>
                  
                  {dayAvailability.enabled && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        type="time"
                        value={dayAvailability.startTime}
                        onChange={(e) => 
                          handleAvailabilityChange(dayKey, "startTime", e.target.value)
                        }
                        className="w-[130px]"
                        data-testid={`input-start-${key}`}
                      />
                      <span className="text-muted-foreground">a</span>
                      <Input
                        type="time"
                        value={dayAvailability.endTime}
                        onChange={(e) => 
                          handleAvailabilityChange(dayKey, "endTime", e.target.value)
                        }
                        className="w-[130px]"
                        data-testid={`input-end-${key}`}
                      />
                    </div>
                  )}
                  
                  {!dayAvailability.enabled && (
                    <span className="text-sm text-muted-foreground">No disponible</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
