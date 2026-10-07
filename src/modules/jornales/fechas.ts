import { addDays, format, parseISO, startOfWeek } from "date-fns";
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
