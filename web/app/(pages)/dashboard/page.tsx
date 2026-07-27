import AppContent from "@/components/admin/app-content";
import { DashboardView } from "./dashboard-view";

export default function DashboardPage() {
    return (
        <AppContent
            title="Operational areas"
            description="Status sourced from Notion, enriched with cached AI summaries."
        >
            <DashboardView />
        </AppContent>
    );
}
