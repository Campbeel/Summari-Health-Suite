import { Link, useLocation } from "wouter";

import { useAuth } from "@/hooks/use-auth";

import { useRole } from "@/hooks/use-role";

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

  useSidebar,

} from "@/components/ui/sidebar";

import {

  DropdownMenu,

  DropdownMenuContent,

  DropdownMenuItem,

  DropdownMenuLabel,

  DropdownMenuSeparator,

  DropdownMenuTrigger,

} from "@/components/ui/dropdown-menu";

import { BrandLogo } from "@/components/brand-logo";

import {

  LogOut,

  ChevronUp,

  LayoutDashboard,

  Users,

} from "lucide-react";



const STAFF_MENU = [

  { title: "Panel", url: "/staff/dashboard", icon: LayoutDashboard, testId: "link-staff-dashboard" },

  { title: "Residentes", url: "/staff/patients", icon: Users, testId: "link-staff-patients" },

];



const ADMIN_MENU = [

  { title: "Panel", url: "/admin/dashboard", icon: LayoutDashboard, testId: "link-admin-dashboard" },

  { title: "Personal", url: "/admin/users", icon: Users, testId: "link-admin-users" },

];



function SidebarUserMenu() {

  const { user, logout } = useAuth();

  const { role } = useRole();

  const { isMobile } = useSidebar();



  const roleLabel = role === "admin" ? "Administrador" : "Staff";

  const roleDescription = role === "admin" ? "Administrador del hogar" : "Personal de cuidado";



  return (

    <DropdownMenu modal={false}>

      <DropdownMenuTrigger asChild>

        <Button

          type="button"

          variant="ghost"

          className="h-12 w-full justify-start gap-2 px-2 font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent"

          data-testid="button-sidebar-user-menu"

        >

          <Avatar className="h-8 w-8 rounded-lg shrink-0">

            <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || ""} />

            <AvatarFallback className="rounded-lg">

              {user?.firstName?.[0]}{user?.lastName?.[0]}

            </AvatarFallback>

          </Avatar>

          <div className="grid flex-1 text-left text-sm leading-tight min-w-0">

            <span className="truncate font-semibold">{user?.firstName} {user?.lastName}</span>

            <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>

          </div>

          <ChevronUp className="ml-auto size-4 shrink-0 opacity-70" />

        </Button>

      </DropdownMenuTrigger>

      <DropdownMenuContent

        className="z-[200] min-w-56 rounded-lg"

        side={isMobile ? "top" : "right"}

        align="end"

        sideOffset={8}

        collisionPadding={16}

      >

        <DropdownMenuLabel className="font-normal">

          <div className="flex flex-col gap-0.5">

            <span className="font-medium">{user?.firstName} {user?.lastName}</span>

            <span className="text-xs text-muted-foreground">{roleDescription}</span>

          </div>

        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem

          className="cursor-pointer"

          onSelect={(e) => {

            e.preventDefault();

            logout();

          }}

          data-testid="button-logout"

        >

          <LogOut className="mr-2 h-4 w-4" />

          Cerrar sesión

        </DropdownMenuItem>

      </DropdownMenuContent>

    </DropdownMenu>

  );

}



export function AppSidebar() {

  const { role } = useRole();

  const [location] = useLocation();



  const menu = role === "admin" ? ADMIN_MENU : STAFF_MENU;

  const homeUrl = role === "admin" ? "/admin/dashboard" : "/staff/dashboard";



  return (

    <Sidebar>

      <SidebarHeader className="p-4">

        <Link href={homeUrl} className="flex items-center gap-3" data-testid="link-sidebar-home">

          <BrandLogo variant="isotipo" className="h-10 w-10" />

          <div>

            <h1 className="font-semibold text-lg">Summari</h1>

            <p className="text-xs text-muted-foreground">Hogar de ancianos</p>

          </div>

        </Link>

      </SidebarHeader>



      <SidebarContent>

        <SidebarGroup>

          <SidebarGroupLabel>Atención</SidebarGroupLabel>

          <SidebarGroupContent>

            <SidebarMenu>

              {menu.map((item) => (

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



      <SidebarFooter>

        <SidebarMenu>

          <SidebarMenuItem>

            <SidebarUserMenu />

          </SidebarMenuItem>

        </SidebarMenu>

      </SidebarFooter>

    </Sidebar>

  );

}


