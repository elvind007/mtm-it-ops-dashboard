import AppContent from "@/components/admin/app-content";
import { ActivityView } from "./activity-view";

export default function ActivityPage() {
    return (
        <AppContent
            title="Activity"
            description="Every observed status change, and whether an alert was delivered."
        >
            <ActivityView />
        </AppContent>
    );
}
