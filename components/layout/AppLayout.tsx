"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";
import {
  History,
  Star,
  Settings,
  Menu,
  X,
  LogOut,
  MessageSquare,
} from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/dashboard", icon: MessageSquare, label: "New Chat" },
  { href: "/history", icon: History, label: "History" },
  { href: "/favorites", icon: Star, label: "Favorites" },
  { href: "/settings", icon: Settings, label: "Account" },
];

export function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleNewChatClick(e: React.MouseEvent) {
    e.preventDefault();
    setSidebarOpen(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("forceNewChat", Date.now().toString());
      window.dispatchEvent(new CustomEvent("biojarvis:new-chat"));
    }
    router.push("/dashboard");
  }

  return (
    <div className="flex h-screen bg-[#050505]">
      {/* Mobile sidebar toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden text-white/60 hover:text-white p-2"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar - Narrow Icon Rail */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-16 bg-[#0a0a0a] border-r border-white/[0.06] flex flex-col items-center py-6 transition-transform duration-300 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="mb-10">
          <div className="w-9 h-9 flex items-center justify-center">
            <Image
              src="/biojarvis-logo.svg"
              alt="BioJarvis"
              width={36}
              height={36}
              className="h-9 w-9 rounded-md object-cover drop-shadow-[0_0_8px_rgba(19,236,146,0.4)]"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 w-full px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const isNewChat = item.href === "/dashboard";

            if (isNewChat) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleNewChatClick}
                  className={cn(
                    "flex items-center justify-center w-full aspect-square rounded-lg transition-all duration-200 group relative",
                    isActive
                      ? "text-emerald-500 bg-emerald-500/10"
                      : "text-white/30 hover:text-white/60 hover:bg-white/[0.03]",
                  )}
                  title={item.label}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-emerald-500 rounded-r-full"></span>
                  )}
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center justify-center w-full aspect-square rounded-lg transition-all duration-200 group relative",
                  isActive
                    ? "text-emerald-500 bg-emerald-500/10"
                    : "text-white/30 hover:text-white/60 hover:bg-white/[0.03]",
                )}
                title={item.label}
              >
                <item.icon className="w-[18px] h-[18px]" />
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-emerald-500 rounded-r-full"></span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User avatar & Sign out */}
        <div className="w-full px-2 space-y-2 mt-auto">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.06] flex items-center justify-center text-emerald-500/80 mono-font text-[10px] font-bold uppercase">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center h-10 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{ flex: "1 1 0%", minWidth: 0, overflow: "hidden", width: 0 }}
      >
        {children}
      </main>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
