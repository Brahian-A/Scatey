// Comparación de textos de la planilla vieja contra trabajadores y obras.
// Sin dependencias de servidor: se usa tanto en el parser como en las acciones.

/** "  Ramón   moreira " → "RAMON MOREIRA" (sin acentos, mayúsculas, espacios simples). */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Distancia de edición (inserciones, borrados y reemplazos de un carácter). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(anterior[j]! + 1, actual[j - 1]! + 1, anterior[j - 1]! + costo);
    }
    anterior = actual;
  }
  return anterior[b.length]!;
}

/** Distancia máxima para sugerir una coincidencia aproximada ("LUCAS MORERIA" → Lucas Moreira). */
export const MAX_DISTANCIA = 2;
/** Con textos más cortos, 2 cambios ya es otra palabra ("SOL" vs "SAL"). */
const LARGO_MINIMO_APROXIMADO = 5;

export type Coincidencia = { id: string; exacta: boolean };

/**
 * El candidato más parecido a `clave` (ya normalizada). Cada candidato puede tener
 * varios nombres (p. ej. nombre completo y apodo). Si dos candidatos distintos
 * empatan en la mejor distancia no se sugiere ninguno: es ambiguo.
 */
export function buscarCoincidencia(
  clave: string,
  candidatos: ReadonlyArray<{ id: string; nombres: string[] }>,
): Coincidencia | null {
  let mejor: { id: string; distancia: number } | null = null;
  let empate = false;
  for (const c of candidatos) {
    const distancia = Math.min(...c.nombres.map((n) => levenshtein(clave, normalizar(n))));
    if (!mejor || distancia < mejor.distancia) {
      mejor = { id: c.id, distancia };
      empate = false;
    } else if (distancia === mejor.distancia && c.id !== mejor.id) {
      empate = true;
    }
  }
  if (!mejor || empate) return null;
  if (mejor.distancia === 0) return { id: mejor.id, exacta: true };
  if (mejor.distancia <= MAX_DISTANCIA && clave.length >= LARGO_MINIMO_APROXIMADO) return { id: mejor.id, exacta: false };
  return null;
}
