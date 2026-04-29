import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useRole, type UserRole } from "@/hooks/use-role";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Activity,
  ClipboardList,
  FlaskConical,
  Building2,
  CalendarClock,
  ShieldCheck,
} from "lucide-react";

type MenuItem = { title: string; url: string; icon: any; testId: string };

const PATIENT_MENU: MenuItem[] = [
  { title: "Inicio", url: "/", icon: Home, testId: "nav-home" },
  { title: "Mis Consultas", url: "/appointments", icon: Calendar, testId: "nav-appointments" },
  { title: "Datos de Salud", url: "/health-data", icon: Activity, testId: "nav-health-data" },
  { title: "Historial Clínico", url: "/records", icon: FileText, testId: "nav-records" },
  { title: "Recetas", url: "/prescriptions", icon: Pill, testId: "nav-prescriptions" },
  { title: "Indicaciones", url: "/indicaciones", icon: ClipboardList, testId: "nav-instructions" },
  { title: "Exámenes", url: "/examenes", icon: FlaskConical, testId: "nav-exam-orders" },
];

const DOCTOR_MENU: MenuItem[] = [
  { title: "Panel", url: "/doctor/dashboard", icon: LayoutDashboard, testId: "link-doctor-dashboard" },
  { title: "Mis Citas", url: "/doctor/appointments", icon: Calendar, testId: "link-doctor-appointments" },
  { title: "Pacientes", url: "/doctor/patients", icon: Users, testId: "link-doctor-patients" },
  { title: "Mi Perfil Profesional", url: "/doctor/profile", icon: User, testId: "link-doctor-profile" },
];

const ADMIN_MENU: MenuItem[] = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard, testId: "nav-admin-dashboard" },
  { title: "Doctor@s", url: "/admin/users", icon: Users, testId: "nav-admin-users" },
  { title: "Agendas", url: "/admin/schedules", icon: CalendarClock, testId: "nav-admin-schedules" },
];

const SUPERADMIN_MENU: MenuItem[] = [
  { title: "Plataforma", url: "/super-admin/dashboard", icon: ShieldCheck, testId: "nav-super-admin-dashboard" },
  { title: "Organizaciones", url: "/super-admin/organizations", icon: Building2, testId: "nav-super-admin-orgs" },
];

function menuForRole(role: UserRole): { items: MenuItem[]; label: string } {
  switch (role) {
    case "doctor":
      return { items: DOCTOR_MENU, label: "Panel Médico" };
    case "admin":
      return { items: ADMIN_MENU, label: "Administración" };
    case "superAdmin":
      return { items: SUPERADMIN_MENU, label: "Super Administración" };
    case "patient":
    default:
      return { items: PATIENT_MENU, label: "Menú Principal" };
  }
}

function roleLabel(role: UserRole): string {
  switch (role) {
    case "doctor": return "Médico";
    case "admin": return "Administrador";
    case "superAdmin": return "Super Admin";
    case "patient": default: return "Paciente";
  }
}

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { role } = useRole();
  const [location] = useLocation();
  const { items, label } = menuForRole(role);

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
        <SidebarGroup>
          <SidebarGroupLabel>{label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
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
                    <span className="text-xs text-muted-foreground" data-testid="text-user-role">
                      {roleLabel(role)}
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
                {role === "patient" || role === "doctor" ? (
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <Settings className="h-4 w-4 mr-2" />
                      Configuración
                    </Link>
                  </DropdownMenuItem>
                ) : null}
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
