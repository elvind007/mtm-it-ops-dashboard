import AppContent from "@/components/admin/app-content";
import { AskView } from "./ask-view";

export default function AskPage() {
    return (
        <AppContent
            title="Ask"
            description="Answers grounded in the indexed IT operations documents."
        >
            <AskView />
        </AppContent>
    );
}
