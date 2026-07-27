import { Activity, LayoutDashboard, MessagesSquare } from "lucide-react";
import { usePathname } from "next/navigation";

import type { SidebarGroup } from "../../types/sidebar";

export function useAppMenuItems(): SidebarGroup[] {
    const pathname = usePathname();

    return [
        {
            groupLabel: "Menu",
            menus: [
                {
                    href: "/dashboard",
                    label: "Dashboard",
                    active: pathname === "/dashboard",
                    icon: LayoutDashboard,
                    submenus: [],
                },
                {
                    href: "/ask",
                    label: "Ask",
                    active: pathname === "/ask",
                    icon: MessagesSquare,
                    submenus: [],
                },
                {
                    href: "/activity",
                    label: "Activity",
                    active: pathname === "/activity",
                    icon: Activity,
                    submenus: [],
                },
            ],
        },
    ] satisfies SidebarGroup[];
}
