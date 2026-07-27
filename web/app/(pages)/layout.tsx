import AppLayout from "@/components/admin/app-layout";

export default function PageLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <AppLayout>{children}</AppLayout>;
}
