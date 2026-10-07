import { addDays, differenceInCalendarDays, endOfMonth, format, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ahora, formatear, WEEK_STARTS_ON } from "@/core/lib/fecha";

// Las fechas de jornales son strings YYYY-MM-DD sin hora: se operan como fechas
// locales "puras" para que el resultado no dependa de la zona del servidor.

const PATRON = "yyyy-MM-dd";

export function esFechaIso(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = parseISO(valor);
  return !Number.isNaN(d.getTime()) && format(d, PATRON) === valor;
}

export function sumarDias(fecha: string, dias: number): string {
  return format(addDays(parseISO(fecha), dias), PATRON);
}

/** Hoy en Montevideo. */
export function hoyIso(): string {
  return formatear(ahora(), PATRON);
}

export function lunesDe(fecha: string): string {
  return format(startOfWeek(parseISO(fecha), { weekStartsOn: WEEK_STARTS_ON }), PATRON);
}

/** `?semana=` válido → su lunes; cualquier otra cosa → lunes de la semana actual. */
export function parsearSemana(valor: unknown): string {
  return lunesDe(esFechaIso(valor) ? valor : hoyIso());
}

/** "2026-10-05" → "05/10" */
export function diaMes(fecha: string): string {
  return format(parseISO(fecha), "dd/MM");
}

const NOMBRES_DIA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

/** "2026-10-05" → "Lun" */
export function nombreDia(fecha: string): string {
  return NOMBRES_DIA[parseISO(fecha).getDay()]!;
}

/** "2026-10-05" → "05/10/2026" */
export function fechaCorta(fecha: string): string {
  return format(parseISO(fecha), "dd/MM/yyyy");
}

/** Fecha pura → Date a medianoche UTC (lo que Excel espera para no correr el día). */
export function fechaUtc(fecha: string): Date {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, d!));
}

// ── Rangos para reportes ─────────────────────────────────────────────────────

export type Rango = { desde: string; hasta: string };

export const PRESETS_RANGO = [
  { value: "esta_semana", label: "Esta semana" },
  { value: "semana_pasada", label: "Semana pasada" },
  { value: "este_mes", label: "Este mes" },
  { value: "mes_pasado", label: "Mes pasado" },
  { value: "personalizado", label: "Personalizado" },
] as const;
export type PresetRango = (typeof PRESETS_RANGO)[number]["value"];

/** Rango más largo que se puede pedir (un año). */
export const MAX_DIAS_RANGO = 366;

function mes(fecha: string, atras: number): Rango {
  const d = subMonths(parseISO(fecha), atras);
  return { desde: format(startOfMonth(d), PATRON), hasta: format(endOfMonth(d), PATRON) };
}

export function rangoDePreset(preset: Exclude<PresetRango, "personalizado">, hoy: string): Rango {
  const lunes = lunesDe(hoy);
  switch (preset) {
    case "esta_semana":
      return { desde: lunes, hasta: sumarDias(lunes, 6) };
    case "semana_pasada":
      return { desde: sumarDias(lunes, -7), hasta: sumarDias(lunes, -1) };
    case "este_mes":
      return mes(hoy, 0);
    case "mes_pasado":
      return mes(hoy, 1);
  }
}

/** Qué preset corresponde a un rango, o "personalizado" si no coincide con ninguno. */
export function presetDeRango({ desde, hasta }: Rango, hoy: string): PresetRango {
  for (const { value } of PRESETS_RANGO) {
    if (value === "personalizado") continue;
    const r = rangoDePreset(value, hoy);
    if (r.desde === desde && r.hasta === hasta) return value;
  }
  return "personalizado";
}

/**
 * `?desde=&hasta=` → rango válido. Sin fechas válidas se usa esta semana; si vienen
 * invertidas se dan vuelta y si superan un año se recorta `hasta`.
 */
export function parsearRango(desde: unknown, hasta: unknown, hoy = hoyIso()): Rango {
  if (!esFechaIso(desde) || !esFechaIso(hasta)) return rangoDePreset("esta_semana", hoy);
  const [a, b] = desde <= hasta ? [desde, hasta] : [hasta, desde];
  const largo = differenceInCalendarDays(parseISO(b), parseISO(a)) + 1;
  return { desde: a, hasta: largo > MAX_DIAS_RANGO ? sumarDias(a, MAX_DIAS_RANGO - 1) : b };
}
