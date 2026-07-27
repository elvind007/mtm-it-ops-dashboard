import AppContent from "@/components/admin/app-content";
import { NoRecordFound } from "@/components/placeholders";

export default function DashboardPage() {
    return (
        <AppContent
            title="Operational areas"
            description="Status pulled from Notion, enriched with AI summaries."
        >
            <NoRecordFound />
        </AppContent>
    );
}
