import Link from "next/link";
import { cn } from "@/lib/utils";

/** Pestañas Semana / Reportes. Cada una conserva el período que se está mirando. */
export function JornalesTabs({
  actual,
  hrefSemana,
  hrefReportes,
}: {
  actual: "semana" | "reportes";
  hrefSemana: string;
  hrefReportes: string;
}) {
  const pestanas = [
    { id: "semana", label: "Semana", href: hrefSemana },
    { id: "reportes", label: "Reportes", href: hrefReportes },
  ] as const;
  return (
    <nav aria-label="Secciones de jornales" className="-mt-2 mb-4 flex gap-1 border-b">
      {pestanas.map((p) => (
        <Link
          key={p.id}
          href={p.href}
          aria-current={actual === p.id ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            actual === p.id
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
