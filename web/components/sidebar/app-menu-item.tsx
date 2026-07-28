import {
    Activity,
    BookText,
    LayoutDashboard,
    MessagesSquare,
    ScrollText,
} from "lucide-react";
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
                    href: "/documents",
                    label: "Documents",
                    active: pathname.startsWith("/documents"),
                    icon: BookText,
                    submenus: [],
                },
                {
                    href: "/activity",
                    label: "Activity",
                    active: pathname === "/activity",
                    icon: Activity,
                    submenus: [],
                },
                {
                    href: "/logs",
                    label: "Logs",
                    active: pathname === "/logs",
                    icon: ScrollText,
                    submenus: [],
                },
            ],
        },
    ] satisfies SidebarGroup[];
}
