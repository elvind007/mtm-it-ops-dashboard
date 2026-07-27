import { SidebarTrigger } from "../ui/sidebar";
import AppCrumb from "./app-crumb";

const AppHeader = () => {
    return (
        <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
            <div className="flex w-full items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <AppCrumb />
            </div>
        </header>
    );
};

export default AppHeader;
