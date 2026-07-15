import { Navigation } from "@/components/layout/Navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar & Bottom Nav Shell */}
      <Navigation />

      {/* Main App Container */}
      <main className="flex-1 flex flex-col md:pl-64 pb-16 md:pb-0 min-h-screen overflow-x-hidden">
        <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
