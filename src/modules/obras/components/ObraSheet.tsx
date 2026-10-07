"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { actualizarObra, crearObra } from "../actions";
import { ETIQUETA_TIPO, TIPOS_OBRA, type TipoObra } from "../constants";
import type { Obra } from "../queries";
import { ColorPicker } from "./ColorPicker";

type Errores = Record<string, string[] | undefined>;

export function ObraSheet({
  abierto,
  onAbiertoChange,
  obra,
  colorSugerido,
}: {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  /** `null` = alta de una obra nueva. */
  obra: Obra | null;
  colorSugerido: string;
}) {
  return (
    <Sheet open={abierto} onOpenChange={onAbiertoChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{obra ? "Editar obra" : "Nueva obra"}</SheetTitle>
          <SheetDescription>El color identifica a la obra en las planillas.</SheetDescription>
        </SheetHeader>
        <Formulario
          key={obra?.id ?? "nueva"}
          obra={obra}
          colorSugerido={colorSugerido}
          onListo={() => onAbiertoChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function Formulario({ obra, colorSugerido, onListo }: { obra: Obra | null; colorSugerido: string; onListo: () => void }) {
  const [errores, setErrores] = useState<Errores>({});
  const [tipo, setTipo] = useState<TipoObra>(obra?.tipo ?? "cliente");
  const [color, setColor] = useState(obra?.color ?? colorSugerido);
  const [pendiente, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      nombre: String(fd.get("nombre") ?? ""),
      ubicacion: String(fd.get("ubicacion") ?? ""),
      notas: String(fd.get("notas") ?? ""),
      tipo,
      color,
    };

    startTransition(async () => {
      const res = obra ? await actualizarObra(obra.id, input) : await crearObra(input);
      if (!res.ok) {
        setErrores(res.errores ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(obra ? "Obra actualizada." : "Obra creada.");
      onListo();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col">
      <div className="grid gap-4 px-4">
        <Campo id="nombre" label="Nombre" error={errores.nombre} ayuda="Por ejemplo, el nombre del cliente.">
          <Input id="nombre" name="nombre" defaultValue={obra?.nombre} required autoFocus autoComplete="off" />
        </Campo>
        <Campo id="tipo" label="Tipo" error={errores.tipo}>
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoObra)}>
            <SelectTrigger id="tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_OBRA.map((t) => (
                <SelectItem key={t} value={t}>
                  {ETIQUETA_TIPO[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo id="ubicacion" label="Ubicación" error={errores.ubicacion}>
          <Input id="ubicacion" name="ubicacion" defaultValue={obra?.ubicacion ?? ""} placeholder="El Pinar" autoComplete="off" />
        </Campo>
        <Campo id="color" label="Color" error={errores.color}>
          <ColorPicker id="color" value={color} onChange={setColor} />
        </Campo>
        <Campo id="notas" label="Notas" error={errores.notas}>
          <Textarea id="notas" name="notas" defaultValue={obra?.notas ?? ""} rows={4} />
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
