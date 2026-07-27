"use client";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { ChevronRightIcon, Folder, FolderOpen } from "lucide-react";
import Link from "next/link";

import type { SidebarGroup as SidebarGroupItem } from "../../types/sidebar";

type AppSidebarMenuProps = {
    items: SidebarGroupItem[];
};

export function AppSidebarMenu({ items }: AppSidebarMenuProps) {
    return items.map((group, groupIndex) => (
        <SidebarGroup
            key={`${group.groupLabel}-${groupIndex}`}
            className="gap-1 px-3 py-1"
        >
            {group.groupLabel && (
                <SidebarGroupLabel className="h-7 px-1 text-[11px] font-normal text-muted-foreground">
                    {group.groupLabel}
                </SidebarGroupLabel>
            )}

            <SidebarMenu>
                {group.menus.map((menu) => {
                    const Icon = menu.icon;
                    const hasSubmenus = menu.submenus.length > 0;

                    if (!hasSubmenus) {
                        return (
                            <SidebarMenuItem key={menu.href}>
                                <SidebarMenuButton
                                    isActive={menu.active}
                                    tooltip={menu.label}
                                    className="h-8 rounded-lg px-2 data-active:bg-primary data-active:font-medium data-active:text-primary-foreground data-active:hover:bg-primary/90 data-active:hover:text-primary-foreground"
                                    render={
                                        <Link
                                            href={menu.href}
                                            aria-current={
                                                menu.active ? "page" : undefined
                                            }
                                        />
                                    }
                                >
                                    <Icon />
                                    <span>{menu.label}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    }

                    const isOpen =
                        menu.active ||
                        menu.submenus.some((submenu) => submenu.active);

                    return (
                        <Collapsible
                            key={menu.href}
                            defaultOpen={isOpen}
                            className="group/collapsible"
                            render={<SidebarMenuItem />}
                        >
                            <CollapsibleTrigger
                                render={
                                    <SidebarMenuButton
                                        isActive={isOpen}
                                        tooltip={menu.label}
                                        className="h-8 rounded-lg px-2 data-active:bg-primary data-active:font-medium data-active:text-primary-foreground data-active:hover:bg-primary/90 data-active:hover:text-primary-foreground data-active:data-open:bg-primary data-active:data-open:text-primary-foreground"
                                    />
                                }
                            >
                                <Icon />
                                <span>{menu.label}</span>
                                <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                                <SidebarMenuSub className="mt-1 gap-0.5 border-sidebar-border/80">
                                    {menu.submenus.map((submenu) => (
                                        <SidebarMenuSubItem key={submenu.href}>
                                            <SidebarMenuSubButton
                                                isActive={submenu.active}
                                                className="h-8 data-active:bg-transparent data-active:font-semibold data-active:text-primary data-active:hover:bg-sidebar-accent/60 data-active:hover:text-primary"
                                                render={
                                                    <Link
                                                        href={submenu.href}
                                                        aria-current={
                                                            submenu.active
                                                                ? "page"
                                                                : undefined
                                                        }
                                                    />
                                                }
                                            >
                                                <span className="flex shrink-0 items-center">
                                                    {submenu.active ? (
                                                        <FolderOpen
                                                            size={16}
                                                            className="me-2"
                                                        />
                                                    ) : (
                                                        <Folder
                                                            size={16}
                                                            className="me-2"
                                                        />
                                                    )}
                                                    {submenu.label}
                                                </span>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                    ))}
                                </SidebarMenuSub>
                            </CollapsibleContent>
                        </Collapsible>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    ));
}
