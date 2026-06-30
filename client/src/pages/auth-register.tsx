import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { loginWithToken } from "@/hooks/use-auth";
import { Eye, EyeOff } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

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

type FieldErrorsType = {
  rut?: string; firstName?: string; lastName?: string; email?: string;
  whatsapp?: string; password?: string; confirmPassword?: string;
};

export default function AuthRegisterPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [rut, setRut] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("+56");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrorsType>({});

  const registerMutation = useMutation({
    mutationFn: async (data: { rut: string; email: string; whatsapp: string; password: string; firstName: string; lastName: string }) => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al crear la cuenta");
      }
      return response.json();
    },
    onSuccess: (data) => {
      loginWithToken(data.token);
      toast({ title: "Cuenta creada", description: "Tu cuenta ha sido creada exitosamente" });
      navigate("/");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const clearFieldError = (field: keyof FieldErrorsType) => {
    setFieldErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrorsType = {};

    if (!rut.trim()) {
      errors.rut = "Ingresa tu RUT";
    } else if (!/^(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])$/.test(rut)) {
      errors.rut = "Formato de RUT inválido (ej: 12.345.678-9)";
    } else if (!validateRut(rut)) {
      errors.rut = "El RUT ingresado no es válido";
    }
    if (!firstName.trim()) errors.firstName = "Ingresa tu nombre";
    if (!lastName.trim()) errors.lastName = "Ingresa tu apellido";
    if (!email.trim()) {
      errors.email = "Ingresa tu correo electrónico";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Correo electrónico inválido";
    }
    if (!whatsapp.trim() || whatsapp === "+56") {
      errors.whatsapp = "Ingresa tu número de WhatsApp";
    } else if (!/^\+\d{8,15}$/.test(whatsapp)) {
      errors.whatsapp = "Formato inválido (ej: +56912345678)";
    }
    if (!password) {
      errors.password = "Ingresa una contraseña";
    } else if (password.length < 6) {
      errors.password = "La contraseña debe tener al menos 6 caracteres";
    }
    if (!confirmPassword) {
      errors.confirmPassword = "Confirma tu contraseña";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Las contraseñas no coinciden";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    registerMutation.mutate({ rut, email, whatsapp, password, firstName, lastName });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Link href="/" data-testid="text-register-title">
            <BrandLogo variant="logotype" className="h-10" />
          </Link>
          <p className="text-muted-foreground text-sm">Telemedicina</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl" data-testid="text-register-card-title">Crear Cuenta</CardTitle>
            <CardDescription>Completa tus datos para registrarte</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rut">RUT</Label>
                <Input
                  id="rut"
                  placeholder="12.345.678-9"
                  value={rut}
                  onChange={(e) => { setRut(e.target.value); clearFieldError("rut"); }}
                  className={fieldErrors.rut ? "border-destructive" : ""}
                  data-testid="input-register-rut"
                />
                {fieldErrors.rut && (
                  <p className="text-sm text-destructive" data-testid="error-register-rut">{fieldErrors.rut}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nombre</Label>
                  <Input
                    id="firstName"
                    placeholder="Juan"
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); clearFieldError("firstName"); }}
                    className={fieldErrors.firstName ? "border-destructive" : ""}
                    data-testid="input-register-firstname"
                  />
                  {fieldErrors.firstName && (
                    <p className="text-sm text-destructive" data-testid="error-register-firstname">{fieldErrors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Apellido</Label>
                  <Input
                    id="lastName"
                    placeholder="Pérez"
                    value={lastName}
                    onChange={(e) => { setLastName(e.target.value); clearFieldError("lastName"); }}
                    className={fieldErrors.lastName ? "border-destructive" : ""}
                    data-testid="input-register-lastname"
                  />
                  {fieldErrors.lastName && (
                    <p className="text-sm text-destructive" data-testid="error-register-lastname">{fieldErrors.lastName}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                  className={fieldErrors.email ? "border-destructive" : ""}
                  data-testid="input-register-email"
                />
                {fieldErrors.email && (
                  <p className="text-sm text-destructive" data-testid="error-register-email">{fieldErrors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  placeholder="+56912345678"
                  value={whatsapp}
                  onChange={(e) => { setWhatsapp(e.target.value); clearFieldError("whatsapp"); }}
                  className={fieldErrors.whatsapp ? "border-destructive" : ""}
                  data-testid="input-register-whatsapp"
                />
                {fieldErrors.whatsapp && (
                  <p className="text-sm text-destructive" data-testid="error-register-whatsapp">{fieldErrors.whatsapp}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                    className={fieldErrors.password ? "border-destructive" : ""}
                    data-testid="input-register-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {fieldErrors.password && (
                  <p className="text-sm text-destructive" data-testid="error-register-password">{fieldErrors.password}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword"); }}
                  className={fieldErrors.confirmPassword ? "border-destructive" : ""}
                  data-testid="input-register-confirm-password"
                />
                {fieldErrors.confirmPassword && (
                  <p className="text-sm text-destructive" data-testid="error-register-confirm">{fieldErrors.confirmPassword}</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={registerMutation.isPending}
                data-testid="button-register-submit"
              >
                {registerMutation.isPending ? "Creando cuenta..." : "Crear Cuenta"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">¿Ya tienes cuenta? </span>
              <Link href="/" className="text-primary font-medium hover:underline" data-testid="link-login">
                Iniciar sesión
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
