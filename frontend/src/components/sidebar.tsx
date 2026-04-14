"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Truck,
  Users,
  Map,
  Package,
  HandCoins,
  Calculator,
  LayoutDashboard,
  LogOut,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: "/motoristas", label: "Motoristas", icon: Truck },
  { href: "/funcionarios", label: "Funcionários", icon: Users },
  { href: "/viagens", label: "Viagens", icon: Map },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/adiantamentos", label: "Adiantamentos", icon: HandCoins },
  { href: "/folha", label: "Folha de Pagamento", icon: Calculator },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [navigating, setNavigating] = useState<string | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-200 bg-slate-900 text-white">
      <div className="flex h-16 items-center gap-3 border-b border-slate-700 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-sm font-bold">
          N
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide">NOVALOG</p>
          <p className="text-[10px] uppercase tracking-widest text-slate-400">
            Recursos Humanos
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const isLoading = navigating === item.href && !isActive;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (!isActive) setNavigating(item.href);
              }}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : isLoading
                  ? "bg-slate-800 text-blue-300"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <item.icon className="h-4 w-4 shrink-0" />
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-700 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
