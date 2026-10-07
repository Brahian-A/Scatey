"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

/** Lee/escribe filtros en la query string; `null` borra el parámetro. */
export function useFiltrosUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  /** Cambia varios parámetros en una sola navegación. */
  const setFiltros = useCallback(
    (cambios: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams);
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === null) params.delete(clave);
        else params.set(clave, valor);
      }
      const qs = params.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [router, pathname, searchParams],
  );

  const setFiltro = useCallback(
    (clave: string, valor: string | null) => setFiltros({ [clave]: valor }),
    [setFiltros],
  );

  return { setFiltro, setFiltros, pendiente };
}
