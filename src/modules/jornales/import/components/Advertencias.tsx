"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Advertencia } from "../parse-legacy-xlsx";

const VISIBLES = 20;

/** Lista de avisos con la fila de Excel donde está cada problema. */
export function Advertencias({ titulo, advertencias }: { titulo: string; advertencias: Advertencia[] }) {
  const [todas, setTodas] = useState(false);
  const lista = todas ? advertencias : advertencias.slice(0, VISIBLES);
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <p className="mb-2 flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-200">
        <TriangleAlert className="size-4" /> {titulo} ({advertencias.length})
      </p>
      <ul className="grid gap-1">
        {lista.map((a, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-16 shrink-0 font-mono text-xs leading-5 text-muted-foreground tabular-nums">Fila {a.fila}</span>
            <span>{a.mensaje}</span>
          </li>
        ))}
      </ul>
      {advertencias.length > VISIBLES && (
        <Button variant="link" size="sm" className="mt-1 h-auto p-0" onClick={() => setTodas(!todas)}>
          {todas ? "Ver menos" : `Ver los ${advertencias.length}`}
        </Button>
      )}
    </div>
  );
}
