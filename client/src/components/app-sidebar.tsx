import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useDoctor, type UserRole } from "@/hooks/use-doctor";
import { useAdmin } from "@/hooks/use-admin";
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
import { BrandLogo } from "@/components/brand-logo";
import { 
  Home, 
  Calendar, 
  FileText, 
  Settings, 
  LogOut,
  ChevronUp,
  Pill,
  LayoutDashboard,
  User,
  Users,
  Shield,
  Activity,
  ClipboardList,
  FlaskConical,
} from "lucide-react";

const patientMenuItems = [
  { title: "Inicio", url: "/", icon: Home, testId: "nav-home" },
  { title: "Mis Consultas", url: "/appointments", icon: Calendar, testId: "nav-appointments" },
  { title: "Datos de Salud", url: "/health-data", icon: Activity, testId: "nav-health-data" },
  { title: "Historial Clínico", url: "/records", icon: FileText, testId: "nav-records" },
  { title: "Recetas", url: "/prescriptions", icon: Pill, testId: "nav-prescriptions" },
  { title: "Indicaciones", url: "/indicaciones", icon: ClipboardList, testId: "nav-instructions" },
  { title: "Exámenes", url: "/examenes", icon: FlaskConical, testId: "nav-exam-orders" },
];

const doctorMenuItems = [
  { title: "Panel", url: "/doctor/dashboard", icon: LayoutDashboard, testId: "link-doctor-dashboard" },
  { title: "Mis Citas", url: "/doctor/appointments", icon: Calendar, testId: "link-doctor-appointments" },
  { title: "Pacientes", url: "/doctor/patients", icon: Users, testId: "link-doctor-patients" },
  { title: "Mi Perfil Profesional", url: "/doctor/profile", icon: User, testId: "link-doctor-profile" },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { isDoctor, currentRole, switchRole } = useDoctor();
  const { isAdmin } = useAdmin();
  const [location, navigate] = useLocation();

  const handleRoleSwitch = (role: "patient" | "doctor") => {
    switchRole(role);
    if (role === "doctor") {
      navigate("/doctor/dashboard");
    } else {
      navigate("/");
    }
  };

  const menuItems = currentRole === "doctor" ? doctorMenuItems : patientMenuItems;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-3" data-testid="link-sidebar-home">
          <BrandLogo variant="isotipo" className="h-10 w-10" />
          <div>
            <h1 className="font-semibold text-lg">Summari</h1>
            <p className="text-xs text-muted-foreground">Telemedicina</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {isDoctor && (
          <SidebarGroup className="px-2 py-2">
            <div className="flex gap-1 p-1 bg-muted/50 rounded-md">
              <Button
                variant={currentRole === "patient" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => handleRoleSwitch("patient")}
                data-testid="button-role-switch-patient"
              >
                Paciente
              </Button>
              <Button
                variant={currentRole === "doctor" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => handleRoleSwitch("doctor")}
                data-testid="button-role-switch-doctor"
              >
                Médico
              </Button>
            </div>
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

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === "/admin/users"}
                    data-testid="nav-admin-users"
                  >
                    <Link href="/admin/users">
                      <Shield className="h-4 w-4" />
                      <span>Gestionar Usuarios</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover-elevate data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
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
                </button>
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
