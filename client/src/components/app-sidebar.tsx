import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useDoctor, type UserRole } from "@/hooks/use-doctor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Home, 
  Calendar, 
  FileText, 
  CreditCard, 
  Settings, 
  Stethoscope,
  LogOut,
  ChevronUp,
  Pill,
  LayoutDashboard,
  User
} from "lucide-react";

const patientMenuItems = [
  { title: "Inicio", url: "/", icon: Home, testId: "nav-home" },
  { title: "Mis Consultas", url: "/appointments", icon: Calendar, testId: "nav-appointments" },
  { title: "Historial Clínico", url: "/records", icon: FileText, testId: "nav-records" },
  { title: "Recetas", url: "/prescriptions", icon: Pill, testId: "nav-prescriptions" },
  { title: "Pagos", url: "/payments", icon: CreditCard, testId: "nav-payments" },
];

const doctorMenuItems = [
  { title: "Panel", url: "/doctor/dashboard", icon: LayoutDashboard, testId: "link-doctor-dashboard" },
  { title: "Mis Citas", url: "/doctor/appointments", icon: Calendar, testId: "link-doctor-appointments" },
  { title: "Mi Perfil Profesional", url: "/doctor/profile", icon: User, testId: "link-doctor-profile" },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { isDoctor, currentRole, switchRole } = useDoctor();
  const [location] = useLocation();

  const menuItems = currentRole === "doctor" ? doctorMenuItems : patientMenuItems;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Stethoscope className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">Summari</h1>
            <p className="text-xs text-muted-foreground">Telemedicina</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {isDoctor && (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="px-2 flex gap-1">
                <Button
                  variant={currentRole === "patient" ? "default" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => switchRole("patient")}
                  data-testid="button-role-switch-patient"
                >
                  Vista de Paciente
                </Button>
                <Button
                  variant={currentRole === "doctor" ? "default" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => switchRole("doctor")}
                  data-testid="button-role-switch-doctor"
                >
                  Vista de Doctor
                </Button>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>
            {currentRole === "doctor" ? "Panel Médico" : "Menú Principal"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={item.testId}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {currentRole === "patient" && (
          <SidebarGroup>
            <SidebarGroupLabel>Acciones Rápidas</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2">
                <Button className="w-full" asChild data-testid="sidebar-new-appointment">
                  <Link href="/appointments/new">
                    <Calendar className="h-4 w-4 mr-2" />
                    Nueva Consulta
                  </Link>
                </Button>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  data-testid="user-menu-trigger"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm">
                    <span className="font-medium truncate max-w-[120px]">
                      {user?.firstName && user?.lastName 
                        ? `${user.firstName} ${user.lastName}`
                        : user?.email || "Usuario"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {currentRole === "doctor" ? "Médico" : "Paciente"}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56"
                side="top"
                align="start"
                sideOffset={8}
              >
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />
                    Configuración
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => logout()}
                  className="text-destructive focus:text-destructive cursor-pointer"
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
