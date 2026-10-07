import { TZDate } from "@date-fns/tz";
import { endOfWeek, format, startOfWeek, type Locale } from "date-fns";
import { es } from "date-fns/locale";

export const ZONA_HORARIA = "America/Montevideo";
export const LOCALE: Locale = es;
/** Las semanas empiezan el lunes. */
export const WEEK_STARTS_ON = 1 as const;

/** Fecha/hora actual en Montevideo. */
export function ahora(): TZDate {
  return TZDate.tz(ZONA_HORARIA);
}

export function enMontevideo(fecha: Date | number): TZDate {
  return new TZDate(typeof fecha === "number" ? fecha : fecha.getTime(), ZONA_HORARIA);
}

export function formatear(fecha: Date | number, patron: string): string {
  return format(enMontevideo(fecha), patron, { locale: LOCALE });
}

export function rangoSemana(fecha: Date | number = ahora()): { inicio: TZDate; fin: TZDate } {
  const f = enMontevideo(fecha);
  return {
    inicio: startOfWeek(f, { weekStartsOn: WEEK_STARTS_ON }),
    fin: endOfWeek(f, { weekStartsOn: WEEK_STARTS_ON }),
  };
}
