"use client";

import * as React from "react";
import { ServerCog } from "lucide-react";

import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
} from "@/components/ui/sidebar";
import { AppSidebarMenu } from "./app-sidebar-menu";
import { useAppMenuItems } from "./app-menu-item";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const items = useAppMenuItems();

    return (
        <Sidebar
            collapsible="icon"
            variant="inset"
            {...props}
            className="bg-sidebar"
        >
            <SidebarHeader className="gap-4 px-3 pt-4 pb-2">
                <div className="flex h-9 items-center gap-2 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <ServerCog className="size-4" />
                    </div>
                    <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
                        IT Ops
                    </span>
                </div>
            </SidebarHeader>
            <SidebarContent className="gap-3">
                <AppSidebarMenu items={items} />
            </SidebarContent>
        </Sidebar>
    );
}
