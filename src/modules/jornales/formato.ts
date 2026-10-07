const formatoJornales = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 1 });

/** 4.5 → "4,5" */
export function formatearJornales(n: number): string {
  return formatoJornales.format(n);
}
