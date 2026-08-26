import { AdminSidebar } from "@/components/admin/sidebar";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr] bg-stone-50">
      <AdminSidebar />
      <main className="p-6">{children}</main>
    </div>
  );
}
