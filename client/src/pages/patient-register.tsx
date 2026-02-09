import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Stethoscope } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

function validateRut(rut: string): boolean {
  const cleaned = rut.replace(/\./g, "").replace(/-/g, "");
  if (cleaned.length < 2) return false;

  const body = cleaned.slice(0, -1);
  const checkDigit = cleaned.slice(-1).toUpperCase();

  if (!/^\d+$/.test(body)) return false;

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  let expected: string;
  if (remainder === 11) expected = "0";
  else if (remainder === 10) expected = "K";
  else expected = remainder.toString();

  return checkDigit === expected;
}

const registrationSchema = z.object({
  rut: z
    .string()
    .min(1, "El RUT es obligatorio")
    .regex(/^(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])$/, "Formato de RUT inválido (ej: 12.345.678-9)")
    .refine((val) => validateRut(val), "El RUT ingresado no es válido"),
  email: z
    .string()
    .min(1, "El correo electrónico es obligatorio")
    .email("Correo electrónico inválido"),
  whatsapp: z
    .string()
    .min(1, "El número de WhatsApp es obligatorio")
    .regex(/^\+\d{8,15}$/, "Formato inválido (ej: +56912345678)"),
});

type RegistrationFormValues = z.infer<typeof registrationSchema>;

export default function PatientRegisterPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      rut: "",
      email: "",
      whatsapp: "+56",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegistrationFormValues) => {
      const response = await apiRequest("PUT", "/api/patients/profile", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients/registration-status"] });
      toast({
        title: "Registro completado",
        description: "Tu información ha sido guardada correctamente",
      });
      navigate("/");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo completar el registro. Verifica los datos ingresados.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegistrationFormValues) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
            <Stethoscope className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-register-title">Summari</h1>
          <p className="text-muted-foreground text-center text-sm">Telemedicina</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle data-testid="text-register-card-title">Completa tu registro</CardTitle>
            <CardDescription>
              Para continuar, necesitamos algunos datos obligatorios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="rut"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RUT</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="12.345.678-9"
                          {...field}
                          data-testid="input-rut"
                        />
                      </FormControl>
                      <FormDescription>
                        Ingresa tu RUT con puntos y guión
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo electrónico</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="tu@correo.cl"
                          {...field}
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+56912345678"
                          {...field}
                          data-testid="input-whatsapp"
                        />
                      </FormControl>
                      <FormDescription>
                        Número con código de país (ej: +56912345678)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                  data-testid="button-submit-registration"
                >
                  {registerMutation.isPending ? "Registrando..." : "Completar Registro"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
