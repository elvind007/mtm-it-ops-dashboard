import AppContent from "@/components/admin/app-content";
import { LogsView } from "./logs-view";

export default function LogsPage() {
    return (
        <AppContent
            title="Integration logs"
            description="What each integration did — Notion polls, AI calls, Slack alerts, RAG retrieval, and API requests."
        >
            <LogsView />
        </AppContent>
    );
}
