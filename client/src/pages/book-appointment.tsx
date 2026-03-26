import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  ArrowRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Video, 
  Phone,
  Check,
  Stethoscope,
  CreditCard,
  Shield
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Doctor {
  id: number;
  userId: string;
  specialty: string;
  bio?: string;
  consultationFee: number;
  availability?: { [day: string]: { start: string; end: string }[] };
  userName?: string;
  userImage?: string;
}

const STEPS = ["Especialista", "Fecha y Hora", "Detalles", "Confirmar y Pagar"];

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00"
];

export default function BookAppointmentPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [consultationType, setConsultationType] = useState<"video" | "audio">("video");
  const [notes, setNotes] = useState("");
  const [stepError, setStepError] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");

  const { data: doctors, isLoading: loadingDoctors } = useQuery<Doctor[]>({
    queryKey: ["/api/doctors"],
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/appointments", {
        doctorId: selectedDoctor?.id,
        scheduledDate: format(selectedDate!, "yyyy-MM-dd"),
        scheduledTime: selectedTime,
        consultationType,
        notes,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      if (data.redirectUrl) {
        toast({
          title: "Redirigiendo al pago",
          description: "Serás redirigido a Flow para completar el pago de tu consulta.",
        });
        window.location.href = data.redirectUrl;
      } else if (data.paymentError) {
        toast({
          title: "Cita creada",
          description: data.paymentError,
          variant: "destructive",
        });
        navigate("/appointments");
      } else {
        navigate("/appointments");
      }
    },
    onError: (error: any) => {
      let message = "No se pudo agendar la consulta. Intenta nuevamente.";
      try {
        const errorText = error?.message || "";
        const jsonStart = errorText.indexOf("{");
        if (jsonStart >= 0) {
          const parsed = JSON.parse(errorText.substring(jsonStart));
          message = parsed.error || message;
        }
      } catch {}
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const canProceed = () => {
    switch (currentStep) {
      case 0: return !!selectedDoctor;
      case 1: return !!selectedDate && !!selectedTime && isSlotAvailable(selectedTime);
      case 2: return true;
      case 3: return true;
      default: return false;
    }
  };

  const getStepError = (): string => {
    switch (currentStep) {
      case 0: return !selectedDoctor ? "Selecciona un médico para continuar" : "";
      case 1:
        if (!selectedDate) return "Selecciona una fecha para tu consulta";
        if (!selectedTime) return "Selecciona un horario disponible";
        if (!isSlotAvailable(selectedTime)) return "El horario seleccionado no está disponible";
        return "";
      default: return "";
    }
  };

  const handleNext = () => {
    if (!canProceed()) {
      setStepError(getStepError());
      return;
    }
    setStepError("");
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      bookMutation.mutate();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate("/appointments");
    }
  };

  const formattedDate = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;

  const { data: bookedSlots = [] } = useQuery<string[]>({
    queryKey: ["/api/appointments/booked-slots", selectedDoctor?.id, formattedDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/appointments/booked-slots?doctorId=${selectedDoctor!.id}&date=${formattedDate}`);
      return res.json();
    },
    enabled: !!selectedDoctor && !!formattedDate,
  });

  const getChileanNow = () => {
    const now = new Date();
    const chileanTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" }));
    return chileanTime;
  };

  const isSlotAvailable = (time: string) => {
    if (!selectedDate) return false;
    const chileanNow = getChileanNow();
    const todayStr = format(chileanNow, "yyyy-MM-dd");
    const selectedStr = format(selectedDate, "yyyy-MM-dd");
    if (selectedStr === todayStr) {
      const [hours, minutes] = time.split(":").map(Number);
      const currentHours = chileanNow.getHours();
      const currentMinutes = chileanNow.getMinutes();
      if (hours < currentHours) return false;
      if (hours === currentHours && minutes <= currentMinutes) return false;
    }
    if (bookedSlots.includes(time)) return false;
    return true;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Agendar Consulta</h1>
          <p className="text-muted-foreground">Paso {currentStep + 1} de {STEPS.length}</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={step} className="flex items-center">
            <div className={`
              flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
              ${index < currentStep ? "bg-primary text-primary-foreground" : ""}
              ${index === currentStep ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : ""}
              ${index > currentStep ? "bg-muted text-muted-foreground" : ""}
            `}>
              {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            {index < STEPS.length - 1 && (
              <div className={`hidden sm:block w-16 lg:w-24 h-0.5 mx-2 ${index < currentStep ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep]}</CardTitle>
          <CardDescription>
            {currentStep === 0 && "Selecciona el médico con quien deseas agendar tu consulta"}
            {currentStep === 1 && "Elige la fecha y hora para tu consulta"}
            {currentStep === 2 && "Agrega detalles adicionales sobre tu consulta"}
            {currentStep === 3 && "Revisa los detalles y procede al pago"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 0: Select Doctor */}
          {currentStep === 0 && (
            <div className="space-y-4">
              {(() => {
                const specialties = [...new Set(doctors?.map(d => d.specialty) || [])].sort();
                return specialties.length > 1 ? (
                  <div className="flex items-center gap-3">
                    <Label className="text-sm font-medium whitespace-nowrap">Filtrar por especialidad:</Label>
                    <Select value={specialtyFilter} onValueChange={(val) => { setSpecialtyFilter(val); setSelectedDoctor(null); }}>
                      <SelectTrigger className="w-[250px]" data-testid="select-specialty-filter">
                        <SelectValue placeholder="Todas las especialidades" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las especialidades</SelectItem>
                        {specialties.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null;
              })()}
              {loadingDoctors ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                      <Skeleton className="h-16 w-16 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                  ))}
                </>
              ) : doctors && doctors.length > 0 ? (
                (specialtyFilter === "all" ? doctors : doctors.filter(d => d.specialty === specialtyFilter)).map((doctor) => (
                  <div
                    key={doctor.id}
                    onClick={() => { setSelectedDoctor(doctor); setStepError(""); }}
                    className={`
                      flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all
                      ${selectedDoctor?.id === doctor.id 
                        ? "border-primary bg-primary/5 ring-1 ring-primary" 
                        : "hover-elevate"}
                    `}
                    data-testid={`doctor-${doctor.id}`}
                  >
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={doctor.userImage} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xl">
                        <Stethoscope className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{doctor.userName || `Dr. ${doctor.userId}`}</h3>
                      <p className="text-muted-foreground">{doctor.specialty}</p>
                      {doctor.bio && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{doctor.bio}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">${doctor.consultationFee.toLocaleString()} CLP</p>
                      <p className="text-sm text-muted-foreground">por consulta</p>
                    </div>
                    {selectedDoctor?.id === doctor.id && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Stethoscope className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay médicos disponibles en este momento</p>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Select Date & Time */}
          {currentStep === 1 && (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label className="mb-3 block">Fecha</Label>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => { setSelectedDate(date); setSelectedTime(""); setStepError(""); }}
                  disabled={(date) => {
                    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
                    today.setHours(0, 0, 0, 0);
                    return date < today || date.getDay() === 0;
                  }}
                  className="rounded-md border"
                  locale={es}
                  data-testid="calendar-booking"
                />
              </div>
              <div>
                <Label className="mb-3 block">Hora disponible</Label>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_SLOTS.map((time) => (
                    <Button
                      key={time}
                      type="button"
                      variant={selectedTime === time ? "default" : "outline"}
                      disabled={!isSlotAvailable(time)}
                      onClick={() => { setSelectedTime(time); setStepError(""); }}
                      className="h-10"
                      data-testid={`time-slot-${time}`}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Additional Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <Label className="mb-3 block">Tipo de consulta</Label>
                <div
                  className="flex items-center gap-3 p-4 border rounded-lg bg-primary/5 ring-1 ring-primary"
                  data-testid="label-consultation-video"
                >
                  <Video className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Videollamada</p>
                    <p className="text-sm text-muted-foreground">Consulta con video en vivo</p>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="notes" className="mb-3 block">
                  Motivo de la consulta (opcional)
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Describe brevemente el motivo de tu consulta..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  data-testid="input-notes"
                />
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {currentStep === 3 && selectedDoctor && selectedDate && (
            <div className="space-y-6" data-testid="confirmation-summary">
              <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedDoctor.userImage} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      <Stethoscope className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg" data-testid="text-confirmation-doctor">{selectedDoctor.userName || `Dr. ${selectedDoctor.userId}`}</h3>
                    <p className="text-muted-foreground" data-testid="text-confirmation-specialty">{selectedDoctor.specialty}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Fecha</p>
                      <p className="font-medium" data-testid="text-confirmation-date">{format(selectedDate, "EEEE d 'de' MMMM, yyyy", { locale: es })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Hora</p>
                      <p className="font-medium" data-testid="text-confirmation-time">{selectedTime}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Video className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tipo</p>
                      <p className="font-medium" data-testid="text-confirmation-type">Videollamada</p>
                    </div>
                  </div>
                  </div>

                {notes && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-1">Notas</p>
                    <p>{notes}</p>
                  </div>
                )}
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <span className="font-medium">Total a pagar</span>
                  </div>
                  <span className="text-2xl font-bold" data-testid="text-payment-total">
                    ${selectedDoctor.consultationFee.toLocaleString()} CLP
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Pago seguro procesado por Flow</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Al continuar, serás redirigido a Flow para completar el pago. Tu cita se confirmará una vez procesado el pago.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {stepError && (
        <p className="text-sm text-destructive text-center" data-testid="error-step-validation">{stepError}</p>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} data-testid="button-prev-step">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 0 ? "Cancelar" : "Anterior"}
        </Button>
        <Button 
          onClick={handleNext} 
          disabled={bookMutation.isPending}
          data-testid="button-next-step"
        >
          {currentStep === STEPS.length - 1 ? (
            bookMutation.isPending ? "Procesando..." : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Pagar y Agendar
              </>
            )
          ) : (
            <>
              Siguiente
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
