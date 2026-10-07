"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/core/ui/PageHeader";
import { useFiltrosUrl } from "@/core/ui/useFiltrosUrl";
import { cn } from "@/lib/utils";
import { cambiarEstadoObra } from "../actions";
import { ETIQUETA_TIPO, PALETA_OBRAS } from "../constants";
import type { FiltrosObras, Obra } from "../queries";
import { ObraChip } from "./ObraChip";
import { ObraSheet } from "./ObraSheet";

export function ObrasView({ obras, filtros }: { obras: Obra[]; filtros: FiltrosObras }) {
  const { setFiltro } = useFiltrosUrl();
  const [sheet, setSheet] = useState<{ abierto: boolean; obra: Obra | null }>({ abierto: false, obra: null });
  const [, startTransition] = useTransition();

  const enUso = new Set(obras.filter((o) => o.estado === "activa").map((o) => o.color));
  const colorSugerido = (PALETA_OBRAS.find((c) => !enUso.has(c.hex)) ?? PALETA_OBRAS[0]).hex;

  function cambiarActiva(o: Obra, activa: boolean) {
    startTransition(async () => {
      const res = await cambiarEstadoObra(o.id, activa ? "activa" : "terminada");
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${o.nombre} marcada como ${activa ? "activa" : "terminada"}.`, {
        action: activa ? undefined : { label: "Deshacer", onClick: () => cambiarActiva(o, true) },
      });
    });
  }

  return (
    <>
      <PageHeader
        titulo="Obras"
        descripcion="Obras de clientes y trabajos internos."
        acciones={
          <>
            <Select value={filtros.estado} onValueChange={(v) => setFiltro("estado", v === "activa" ? null : v)}>
              <SelectTrigger className="w-36" aria-label="Filtrar por estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activa">Activas</SelectItem>
                <SelectItem value="terminada">Terminadas</SelectItem>
                <SelectItem value="todas">Todas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtros.tipo} onValueChange={(v) => setFiltro("tipo", v === "todos" ? null : v)}>
              <SelectTrigger className="w-36" aria-label="Filtrar por tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="interna">Interna</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setSheet({ abierto: true, obra: null })}>
              <Plus /> Nueva obra
            </Button>
          </>
        }
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Obra</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead className="w-24">Activa</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {obras.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No hay obras para mostrar.
                </TableCell>
              </TableRow>
            )}
            {obras.map((o) => {
              const activa = o.estado === "activa";
              return (
                <TableRow key={o.id} className={cn(!activa && "text-muted-foreground")}>
                  <TableCell>
                    <ObraChip nombre={o.nombre} color={o.color} className={cn(!activa && "opacity-60")} />
                    {!activa && (
                      <Badge variant="outline" className="ml-2">
                        Terminada
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={o.tipo === "cliente" ? "secondary" : "outline"}>{ETIQUETA_TIPO[o.tipo]}</Badge>
                  </TableCell>
                  <TableCell>{o.ubicacion ?? "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={activa}
                      onCheckedChange={(v) => cambiarActiva(o, v)}
                      aria-label={`Marcar ${o.nombre} como ${activa ? "terminada" : "activa"}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar ${o.nombre}`}
                      onClick={() => setSheet({ abierto: true, obra: o })}
                    >
                      <Pencil />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ObraSheet
        abierto={sheet.abierto}
        obra={sheet.obra}
        colorSugerido={colorSugerido}
        onAbiertoChange={(abierto) => setSheet((s) => ({ ...s, abierto }))}
      />
    </>
  );
}
