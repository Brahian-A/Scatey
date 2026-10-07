"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { esFechaIso, fechaCorta, presetDeRango, PRESETS_RANGO, rangoDePreset, type PresetRango, type Rango } from "../../fechas";

/** Mientras se escribe el año, el input pasa por años como 0002 o 0202: no se aplican. */
const fechaCompleta = (v: string) => esFechaIso(v) && v >= "2000-01-01";

export function SelectorRango({ rango, hoy, onCambiar }: { rango: Rango; hoy: string; onCambiar: (r: Rango) => void }) {
  const preset = presetDeRango(rango, hoy);
  // "Personalizado" se recuerda aunque las fechas elegidas coincidan con un preset.
  const [personalizado, setPersonalizado] = useState(preset === "personalizado");
  const valor: PresetRango = personalizado ? "personalizado" : preset;

  function elegir(v: string) {
    const p = v as PresetRango;
    setPersonalizado(p === "personalizado");
    if (p !== "personalizado") onCambiar(rangoDePreset(p, hoy));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={valor} onValueChange={elegir}>
        <SelectTrigger className="w-40" aria-label="Período">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS_RANGO.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {valor === "personalizado" ? (
        // key: si el servidor corrige el rango (invertido o más de un año), los inputs lo reflejan.
        <div key={`${rango.desde}|${rango.hasta}`} className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Desde"
            className="w-40"
            defaultValue={rango.desde}
            max={rango.hasta}
            onChange={(e) => fechaCompleta(e.target.value) && onCambiar({ ...rango, desde: e.target.value })}
          />
          <span className="text-sm text-muted-foreground">a</span>
          <Input
            type="date"
            aria-label="Hasta"
            className="w-40"
            defaultValue={rango.hasta}
            min={rango.desde}
            onChange={(e) => fechaCompleta(e.target.value) && onCambiar({ ...rango, hasta: e.target.value })}
          />
        </div>
      ) : (
        <span className="text-sm text-muted-foreground tabular-nums">
          {fechaCorta(rango.desde)} – {fechaCorta(rango.hasta)}
        </span>
      )}
    </div>
  );
}
