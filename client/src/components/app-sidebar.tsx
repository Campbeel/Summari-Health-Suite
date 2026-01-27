import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
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
  Users, 
  CreditCard, 
  Settings, 
  Stethoscope,
  LogOut,
  ChevronUp,
  Pill,
  ClipboardList
} from "lucide-react";

const patientMenuItems = [
  { title: "Inicio", url: "/", icon: Home },
  { title: "Mis Consultas", url: "/appointments", icon: Calendar },
  { title: "Historial Clínico", url: "/records", icon: FileText },
  { title: "Recetas", url: "/prescriptions", icon: Pill },
  { title: "Pagos", url: "/payments", icon: CreditCard },
];

const doctorMenuItems = [
  { title: "Inicio", url: "/", icon: Home },
  { title: "Agenda", url: "/schedule", icon: Calendar },
  { title: "Pacientes", url: "/patients", icon: Users },
  { title: "Consultas Hoy", url: "/consultations", icon: ClipboardList },
];

interface AppSidebarProps {
  userRole?: "patient" | "doctor";
}

export function AppSidebar({ userRole = "patient" }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const menuItems = userRole === "doctor" ? doctorMenuItems : patientMenuItems;

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
        <SidebarGroup>
          <SidebarGroupLabel>
            {userRole === "doctor" ? "Panel Médico" : "Menú Principal"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace("/", "") || "home"}`}
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

        {userRole === "patient" && (
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
                      {userRole === "doctor" ? "Médico" : "Paciente"}
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
