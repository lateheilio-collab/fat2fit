"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Utensils,
  Dumbbell,
  TrendingUp,
  Settings,
  LogOut,
  Activity,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

const navItems = [
  { href: "/", label: "Tänään", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/meals", label: "Ateriat", icon: Activity },
  { href: "/nutrition-plan", label: "Ravinto-ohjelma", icon: Utensils },
  { href: "/plan", label: "Suunnitelma", icon: Dumbbell },
  { href: "/progress", label: "Kehitys", icon: TrendingUp },
];

export function Navigation() {
  const pathname = usePathname();
  const supabase = supabaseBrowser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <>
      {/* Desktop Sidebar (Hidden on Mobile) */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 glass-panel border-r border-border p-6 justify-between z-30">
        <div className="flex flex-col gap-8">
          {/* Logo / App Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center shadow-lg shadow-primary/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-xl tracking-tight leading-none bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Fat2Fit
              </h1>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                Valmentajasi
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Desktop Bottom Actions */}
        <div className="flex flex-col gap-2">
          <Link
            href="/settings"
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
              pathname.startsWith("/settings")
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <Settings className="w-5 h-5" />
            Asetukset
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 w-full text-left"
          >
            <LogOut className="w-5 h-5" />
            Kirjaudu ulos
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Bar (Hidden on Desktop) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-border px-2 py-1 flex justify-around items-center z-40 pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all duration-200 min-w-16 ${
                isActive
                  ? "text-primary scale-110"
                  : "text-muted-foreground active:scale-95"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold tracking-wide">
                {item.label}
              </span>
            </Link>
          );
        })}
        {/* Settings shortcut on Mobile */}
        <Link
          href="/settings"
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all duration-200 min-w-16 ${
            pathname.startsWith("/settings")
              ? "text-primary scale-110"
              : "text-muted-foreground active:scale-95"
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-wide">
            Profiili
          </span>
        </Link>
      </nav>
    </>
  );
}
