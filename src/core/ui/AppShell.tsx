import { icons } from "lucide-react";
import { APP_DESCRIPCION, APP_NOMBRE } from "@/core/config";
import { registry } from "@/core/modules/registry";
import { NavLink } from "./NavLink";

// La navegación se arma exclusivamente a partir del registro de módulos.
function Navegacion() {
  return registry.map((mod) => {
    const Icono = icons[mod.icon];
    return (
      <NavLink key={mod.id} href={mod.href}>
        <Icono className="size-4 shrink-0" aria-hidden />
        {mod.label}
      </NavLink>
    );
  });
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="px-5 py-4">
          <p className="text-base font-semibold">{APP_NOMBRE}</p>
          <p className="text-xs text-muted-foreground">{APP_DESCRIPCION}</p>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          <Navegacion />
        </nav>
      </aside>

      <header className="border-b bg-sidebar md:hidden">
        <p className="px-4 pt-3 text-base font-semibold">{APP_NOMBRE}</p>
        <nav className="flex gap-1 overflow-x-auto px-2 py-2">
          <Navegacion />
        </nav>
      </header>

      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
