import { LucideIcon } from "lucide-react";

export type SidebarSubmenu = {
    href: string;
    label: string;
    active: boolean;
};

export type SidebarMenu = {
    href: string;
    label: string;
    active: boolean;
    icon: LucideIcon;
    submenus: SidebarSubmenu[];
};

export type SidebarGroup = {
    groupLabel: string;
    menus: SidebarMenu[];
};
