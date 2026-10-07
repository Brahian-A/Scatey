"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Campo } from "@/core/ui/Campo";
import { actualizarTrabajador, crearTrabajador } from "../actions";
import type { Trabajador } from "../queries";

type Errores = Record<string, string[] | undefined>;

export function TrabajadorSheet({
  abierto,
  onAbiertoChange,
  trabajador,
}: {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  /** `null` = alta de un trabajador nuevo. */
  trabajador: Trabajador | null;
}) {
  return (
    <Sheet open={abierto} onOpenChange={onAbiertoChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{trabajador ? "Editar trabajador" : "Nuevo trabajador"}</SheetTitle>
          <SheetDescription>Los nombres se guardan con mayúscula inicial.</SheetDescription>
        </SheetHeader>
        {/* `key` reinicia el formulario al cambiar de trabajador */}
        <Formulario key={trabajador?.id ?? "nuevo"} trabajador={trabajador} onListo={() => onAbiertoChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function Formulario({ trabajador, onListo }: { trabajador: Trabajador | null; onListo: () => void }) {
  const [errores, setErrores] = useState<Errores>({});
  const [pendiente, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      nombre: String(fd.get("nombre") ?? ""),
      apellido: String(fd.get("apellido") ?? ""),
      apodo: String(fd.get("apodo") ?? ""),
      telefono: String(fd.get("telefono") ?? ""),
      notas: String(fd.get("notas") ?? ""),
    };

    startTransition(async () => {
      const res = trabajador ? await actualizarTrabajador(trabajador.id, input) : await crearTrabajador(input);
      if (!res.ok) {
        setErrores(res.errores ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(trabajador ? "Trabajador actualizado." : "Trabajador creado.");
      onListo();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col">
      <div className="grid gap-4 px-4">
        <Campo id="nombre" label="Nombre" error={errores.nombre}>
          <Input id="nombre" name="nombre" defaultValue={trabajador?.nombre} required autoFocus autoComplete="off" />
        </Campo>
        <Campo id="apellido" label="Apellido" error={errores.apellido}>
          <Input id="apellido" name="apellido" defaultValue={trabajador?.apellido} autoComplete="off" />
        </Campo>
        <Campo id="apodo" label="Apodo" error={errores.apodo}>
          <Input id="apodo" name="apodo" defaultValue={trabajador?.apodo ?? ""} autoComplete="off" />
        </Campo>
        <Campo id="telefono" label="Teléfono" error={errores.telefono}>
          <Input id="telefono" name="telefono" type="tel" inputMode="tel" defaultValue={trabajador?.telefono ?? ""} placeholder="099 123 456" />
        </Campo>
        <Campo id="notas" label="Notas" error={errores.notas}>
          <Textarea id="notas" name="notas" defaultValue={trabajador?.notas ?? ""} rows={4} />
        </Campo>
      </div>
      <SheetFooter>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </Button>
      </SheetFooter>
    </form>
  );
}
