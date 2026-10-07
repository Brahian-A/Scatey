"use client";

import { Eraser, Hourglass, StickyNote } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import type { ObraResumen } from "../queries";
import { MOTIVOS_AUSENCIA, type MotivoAusencia } from "../schema";
import type { Jornal } from "../validation";

export type ValorCelda = { estado: "trabajo"; obraId: string } | { estado: "ausente"; motivoAusencia: MotivoAusencia };

export function SelectorJornal({
  obrasActivas,
  actual,
  cantidad,
  conRegistro,
  todosMedio,
  onAsignar,
  onMedio,
  onNota,
  onVaciar,
}: {
  obrasActivas: ObraResumen[];
  /** Valor de la celda cuando hay una sola seleccionada. */
  actual: Jornal | undefined;
  /** Celdas seleccionadas. */
  cantidad: number;
  /** Cuántas de las seleccionadas tienen registro (medio jornal y nota solo aplican a esas). */
  conRegistro: number;
  todosMedio: boolean;
  onAsignar: (valor: ValorCelda) => void;
  onMedio: () => void;
  onNota: (nota: string) => void;
  onVaciar: () => void;
}) {
  const [modo, setModo] = useState<"lista" | "nota">("lista");

  if (modo === "nota") {
    return <EditorNota inicial={cantidad === 1 ? (actual?.nota ?? "") : ""} cantidad={conRegistro} onGuardar={onNota} />;
  }

  const clientes = obrasActivas.filter((o) => o.tipo === "cliente");
  const internas = obrasActivas.filter((o) => o.tipo === "interna");
  const grupoObras = (titulo: string, lista: ObraResumen[]) =>
    lista.length > 0 && (
      <CommandGroup heading={titulo}>
        {lista.map((o) => (
          <CommandItem
            key={o.id}
            value={`${o.nombre} ${o.id}`}
            keywords={[o.nombre]}
            data-checked={actual?.obraId === o.id}
            onSelect={() => onAsignar({ estado: "trabajo", obraId: o.id })}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.color }} aria-hidden />
            <span className="truncate">{o.nombre}</span>
          </CommandItem>
        ))}
      </CommandGroup>
    );

  return (
    <Command
      // Se filtra solo por el nombre visible (keywords), no por el id que va en `value`.
      filter={(_valor, busqueda, keywords) => {
        const texto = normalizar(keywords?.join(" ") ?? "");
        return normalizar(busqueda)
          .split(/\s+/)
          .every((parte) => texto.includes(parte))
          ? 1
          : 0;
      }}
    >
      <CommandInput placeholder={cantidad > 1 ? `Aplicar a ${cantidad} celdas…` : "Buscar obra o motivo…"} />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        {grupoObras("Obras de clientes", clientes)}
        {grupoObras("Internas", internas)}
        <CommandSeparator />
        <CommandGroup heading="Ausencia">
          {MOTIVOS_AUSENCIA.map((m) => (
            <CommandItem
              key={m.value}
              value={`motivo ${m.value}`}
              keywords={[m.label, "ausente", "ausencia"]}
              data-checked={actual?.motivoAusencia === m.value}
              onSelect={() => onAsignar({ estado: "ausente", motivoAusencia: m.value })}
            >
              <span
                className={m.value === "falta" ? "size-2.5 shrink-0 rounded-full bg-red-500" : "size-2.5 shrink-0 rounded-full bg-muted-foreground/40"}
                aria-hidden
              />
              {m.label}
              {m.value === "falta" && <CommandShortcut>F</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Opciones">
          <CommandItem
            value="opcion medio"
            keywords={["Medio jornal", "½"]}
            disabled={conRegistro === 0}
            data-checked={conRegistro > 0 && todosMedio}
            onSelect={onMedio}
          >
            <Hourglass /> Medio jornal
          </CommandItem>
          <CommandItem value="opcion nota" keywords={["Nota"]} disabled={conRegistro === 0} onSelect={() => setModo("nota")}>
            <StickyNote /> Nota…
          </CommandItem>
          <CommandItem value="opcion vaciar" keywords={["Vaciar", "borrar"]} disabled={conRegistro === 0} onSelect={onVaciar}>
            <Eraser /> Vaciar
            <CommandShortcut>Supr</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function EditorNota({ inicial, cantidad, onGuardar }: { inicial: string; cantidad: number; onGuardar: (nota: string) => void }) {
  const [nota, setNota] = useState(inicial);
  return (
    <form
      className="grid gap-2 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar(nota);
      }}
    >
      <Textarea
        autoFocus
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        maxLength={200}
        rows={3}
        placeholder={cantidad > 1 ? `Nota para ${cantidad} celdas` : "Nota"}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Enter guarda · Shift+Enter salto de línea</span>
        <Button type="submit" size="sm">
          Guardar
        </Button>
      </div>
    </form>
  );
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-UY")
    .trim();
}
