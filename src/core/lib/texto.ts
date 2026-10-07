// Palabras que van en minúscula dentro de un nombre (salvo al inicio).
const CONECTORES = new Set(["de", "del", "la", "las", "los", "y", "e", "el", "en", "a", "al", "da", "do", "das", "dos"]);

function capitalizar(palabra: string): string {
  return palabra
    .split(/([-'])/)
    .map((parte) =>
      parte.length > 0 ? parte.charAt(0).toLocaleUpperCase("es-UY") + parte.slice(1).toLocaleLowerCase("es-UY") : parte,
    )
    .join("");
}

/**
 * Normaliza un nombre a Title Case: "lucas moreira" → "Lucas Moreira".
 * Respeta siglas cortas en mayúsculas ("ODS varias" → "ODS Varias") y
 * conectores en español ("casa DE piedra" → "Casa de Piedra").
 */
export function aTitleCase(valor: string): string {
  const palabras = valor.trim().split(/\s+/).filter(Boolean);
  // Si todo viene en mayúsculas ("JOSE ROSA") no hay forma de distinguir siglas.
  const todoMayusculas = valor === valor.toLocaleUpperCase("es-UY");
  return palabras
    .map((palabra, i) => {
      const minuscula = palabra.toLocaleLowerCase("es-UY");
      if (i > 0 && CONECTORES.has(minuscula)) return minuscula;
      const esSigla = !todoMayusculas && /^[A-ZÁÉÍÓÚÑÜ]{2,4}$/.test(palabra);
      if (esSigla) return palabra;
      return capitalizar(palabra);
    })
    .join(" ");
}

/** Convierte strings vacíos (o solo espacios) en null. */
export function vacioANull(valor: string | null | undefined): string | null {
  const limpio = valor?.trim();
  return limpio ? limpio : null;
}
