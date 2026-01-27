import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  Calendar, 
  FileText, 
  CreditCard, 
  Mic, 
  Shield, 
  Clock,
  Stethoscope,
  Heart,
  Activity
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Stethoscope className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold">Summari</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                Características
              </a>
              <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                Cómo Funciona
              </a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                Precios
              </a>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button variant="outline" asChild data-testid="button-login">
                <a href="/api/login">Iniciar Sesión</a>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Heart className="h-4 w-4" />
                Atención médica de calidad desde casa
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                Tu salud, 
                <span className="text-primary"> simplificada</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg">
                Agenda consultas médicas, accede a tu historial clínico digital y recibe 
                recetas electrónicas. Todo en una plataforma segura y fácil de usar.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild data-testid="button-get-started">
                  <a href="/api/login">Comenzar Ahora</a>
                </Button>
                <Button size="lg" variant="outline" asChild data-testid="button-learn-more">
                  <a href="#features">Conocer Más</a>
                </Button>
              </div>
              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-secondary" />
                  <span className="text-sm text-muted-foreground">Datos protegidos</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-secondary" />
                  <span className="text-sm text-muted-foreground">Disponible 24/7</span>
                </div>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-3xl blur-3xl" />
              <div className="relative bg-card rounded-3xl p-8 border shadow-xl">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-background">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Próxima consulta</p>
                      <p className="text-sm text-muted-foreground">Dra. María García - Cardiología</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-background">
                    <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium">Receta disponible</p>
                      <p className="text-sm text-muted-foreground">Lista para descargar</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-background">
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                      <Activity className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium">Historial actualizado</p>
                      <p className="text-sm text-muted-foreground">Última visita: Hace 2 días</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Todo lo que necesitas para tu salud
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Una plataforma completa de telemedicina diseñada para pacientes y médicos
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Agendamiento Inteligente</h3>
                <p className="text-muted-foreground">
                  Reserva consultas con especialistas según su disponibilidad. 
                  Recibe recordatorios automáticos.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="text-xl font-semibold">Pagos Seguros</h3>
                <p className="text-muted-foreground">
                  Procesa pagos de consultas de forma segura con Stripe. 
                  Historial de transacciones disponible.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold">Fichas Clínicas Digitales</h3>
                <p className="text-muted-foreground">
                  Accede a tu historial médico completo durante las consultas. 
                  Información siempre actualizada.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mic className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Transcripción Automática</h3>
                <p className="text-muted-foreground">
                  Las consultas se transcriben automáticamente para mantener 
                  un registro preciso de cada visita.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="text-xl font-semibold">Recetas Electrónicas</h3>
                <p className="text-muted-foreground">
                  Genera y recibe recetas médicas digitales automáticamente 
                  al finalizar cada consulta.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold">Seguridad Garantizada</h3>
                <p className="text-muted-foreground">
                  Tus datos médicos están protegidos con los más altos 
                  estándares de seguridad y privacidad.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Cómo funciona
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              En solo tres pasos, accede a atención médica de calidad
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto">
                1
              </div>
              <h3 className="text-xl font-semibold">Crea tu cuenta</h3>
              <p className="text-muted-foreground">
                Regístrate en segundos y completa tu perfil médico básico
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto">
                2
              </div>
              <h3 className="text-xl font-semibold">Agenda tu consulta</h3>
              <p className="text-muted-foreground">
                Elige un especialista y selecciona el horario que mejor te convenga
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto">
                3
              </div>
              <h3 className="text-xl font-semibold">Recibe atención</h3>
              <p className="text-muted-foreground">
                Conéctate a tu consulta y recibe diagnóstico, recetas e indicaciones
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="medical-gradient rounded-3xl p-8 sm:p-12 text-center text-white">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Comienza a cuidar tu salud hoy
            </h2>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              Únete a miles de pacientes que ya confían en Summari para su atención médica
            </p>
            <Button size="lg" variant="secondary" asChild data-testid="button-cta-signup">
              <a href="/api/login">Crear Cuenta Gratis</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Stethoscope className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">Summari</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Summari. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
