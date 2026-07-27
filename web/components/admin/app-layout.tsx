import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "../sidebar/app-sidebar";
import AppHeader from "./app-header";
import AppFooter from "./app-footer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="overflow-hidden border bg-background shadow-none">
                <AppHeader />
                <div className="max-h-[90vh] overflow-auto">
                    <div className="flex flex-1 flex-col gap-4 p-4 pt-0 mt-3 min-h-[85vh]">
                        {children}
                    </div>
                    <AppFooter />
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
