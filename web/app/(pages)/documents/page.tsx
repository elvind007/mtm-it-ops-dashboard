import { Suspense } from "react";

import AppContent from "@/components/admin/app-content";
import { LoadingData } from "@/components/placeholders";
import { DocumentsView } from "./documents-view";

export default function DocumentsPage() {
    return (
        <AppContent
            title="Documents"
            description="Indexed IT operations runbooks, SOPs, and notes the Ask answers ground on."
        >
            <Suspense fallback={<LoadingData rows={6} />}>
                <DocumentsView />
            </Suspense>
        </AppContent>
    );
}
