"use client";

import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/core/ui/PageHeader";
import { useFiltrosUrl } from "@/core/ui/useFiltrosUrl";
import { cn } from "@/lib/utils";
import { cambiarActivoTrabajador, reordenarTrabajadores } from "../actions";
import { nombreCompleto } from "../format";
import type { Trabajador } from "../queries";
import { TrabajadorSheet } from "./TrabajadorSheet";

export function PersonalView({
  trabajadores,
  mostrarInactivos,
}: {
  trabajadores: Trabajador[];
  mostrarInactivos: boolean;
}) {
  const { setFiltro } = useFiltrosUrl();
  const [sheet, setSheet] = useState<{ abierto: boolean; trabajador: Trabajador | null }>({
    abierto: false,
    trabajador: null,
  });
  const [lista, moverOptimista] = useOptimistic(trabajadores, (actual, ids: string[]) =>
    ids.map((id) => actual.find((t) => t.id === id)!).filter(Boolean),
  );
  const [, startTransition] = useTransition();

  function mover(indice: number, delta: -1 | 1) {
    const destino = indice + delta;
    if (destino < 0 || destino >= lista.length) return;
    const ids = lista.map((t) => t.id);
    [ids[indice], ids[destino]] = [ids[destino]!, ids[indice]!];
    startTransition(async () => {
      moverOptimista(ids);
      const res = await reordenarTrabajadores(ids);
      if (!res.ok) toast.error(res.error);
    });
  }

  function cambiarActivo(t: Trabajador, activo: boolean) {
    startTransition(async () => {
      const res = await cambiarActivoTrabajador(t.id, activo);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${nombreCompleto(t)} ${activo ? "activado" : "desactivado"}.`, {
        action: activo ? undefined : { label: "Deshacer", onClick: () => cambiarActivo(t, true) },
      });
    });
  }

  return (
    <>
      <PageHeader
        titulo="Personal"
        descripcion="Trabajadores de la empresa. El orden se usa en las planillas de jornales."
        acciones={
          <>
            <div className="flex items-center gap-2">
              <Switch
                id="mostrar-inactivos"
                checked={mostrarInactivos}
                onCheckedChange={(v) => setFiltro("inactivos", v ? "1" : null)}
              />
              <Label htmlFor="mostrar-inactivos">Mostrar inactivos</Label>
            </div>
            <Button onClick={() => setSheet({ abierto: true, trabajador: null })}>
              <Plus /> Nuevo trabajador
            </Button>
          </>
        }
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Orden</TableHead>
              <TableHead>Nombre completo</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="w-24">Activo</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No hay trabajadores para mostrar.
                </TableCell>
              </TableRow>
            )}
            {lista.map((t, i) => (
              <TableRow key={t.id} className={cn(!t.activo && "text-muted-foreground")}>
                <TableCell>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Subir a ${nombreCompleto(t)}`}
                      disabled={i === 0}
                      onClick={() => mover(i, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Bajar a ${nombreCompleto(t)}`}
                      disabled={i === lista.length - 1}
                      onClick={() => mover(i, 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  {nombreCompleto(t)}
                  {t.apodo && <span className="ml-2 font-normal text-muted-foreground">“{t.apodo}”</span>}
                  {!t.activo && (
                    <Badge variant="outline" className="ml-2">
                      Inactivo
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{t.telefono ?? "—"}</TableCell>
                <TableCell>
                  <Switch
                    checked={t.activo}
                    onCheckedChange={(v) => cambiarActivo(t, v)}
                    aria-label={`${t.activo ? "Desactivar" : "Activar"} a ${nombreCompleto(t)}`}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar a ${nombreCompleto(t)}`}
                    onClick={() => setSheet({ abierto: true, trabajador: t })}
                  >
                    <Pencil />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TrabajadorSheet
        abierto={sheet.abierto}
        trabajador={sheet.trabajador}
        onAbiertoChange={(abierto) => setSheet((s) => ({ ...s, abierto }))}
      />
    </>
  );
}
