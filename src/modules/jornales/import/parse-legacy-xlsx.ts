import ExcelJS from "exceljs";
import { esFechaIso, lunesDe, sumarDias } from "../fechas";
import { normalizar } from "./coincidencias";

// Planilla vieja (hoja "Jornales"): semanas apiladas una debajo de la otra.
//
//   SEMANA DEL 28/09 AL 03/10
//   LUNES  | OBRA        | MARTES | OBRA | … | VIERNES | OBRA  (| SABADO | OBRA)
//   RAMON  | EL PINAR    | RAMON  | XXXX | …
//   …hasta una fila vacía o la próxima SEMANA.
//
// Este archivo solo lee y valida: no toca la base.

const TITULO_SEMANA = /SEMANA DEL (\d{2})\/(\d{2}) AL (\d{2})\/(\d{2})/i;
/** Cualquier cantidad de X: el trabajador faltó. */
const FALTA = /^X+$/i;
const DIAS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"] as const;
const ENCABEZADO_DESTINO = /^(OBRAS?|DESTINO)\b/;

export interface FilaLegacy {
  /** Fila de Excel (1 = primera) donde está el dato, para reportar errores. */
  fila: number;
  fecha: string;
  /** Nombre del trabajador tal como está escrito. */
  trabajador: string;
  /** Texto del destino tal como está escrito, o null si es una falta (XXX). */
  destino: string | null;
}

export interface SemanaLegacy {
  fila: number;
  /** Lunes… según las columnas del encabezado; `desde`/`hasta` salen del título. */
  desde: string;
  hasta: string;
}

export interface Advertencia {
  fila: number;
  mensaje: string;
}

export interface ResultadoParseo {
  semanas: SemanaLegacy[];
  filas: FilaLegacy[];
  /** Celdas con trabajador pero sin destino: no generan registro. */
  sinDestino: number;
  advertencias: Advertencia[];
}

/** Error que impide leer el archivo entero (no es un .xlsx, falta la hoja…). */
export class ErrorPlanilla extends Error {}

/** Texto visible de una celda. Las celdas combinadas solo cuentan en la primera. */
function textoCelda(celda: ExcelJS.Cell): string {
  if (celda.isMerged && celda.master.address !== celda.address) return "";
  if (celda.value === null || celda.value === undefined) return "";
  return celda.text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function textosFila(hoja: ExcelJS.Worksheet, fila: number): string[] {
  const textos: string[] = [];
  hoja.getRow(fila).eachCell({ includeEmpty: false }, (celda, columna) => {
    textos[columna] = textoCelda(celda);
  });
  return textos;
}

const filaVacia = (textos: string[]) => textos.every((t) => !t);

type Par = { dia: number; columnaNombre: number; columnaDestino: number };

/**
 * Pares [DÍA, OBRA] del encabezado. El día se reconoce por el nombre (con o sin
 * tilde) y su destino es la columna OBRA que lo sigue antes del próximo día.
 */
function leerEncabezado(textos: string[]): { pares: Par[]; problemas: string[] } {
  const dias: Array<{ dia: number; columna: number }> = [];
  const destinos: number[] = [];
  textos.forEach((texto, columna) => {
    const n = normalizar(texto ?? "");
    const dia = DIAS.findIndex((d) => n === d || n.startsWith(`${d} `));
    if (dia >= 0) dias.push({ dia, columna });
    else if (ENCABEZADO_DESTINO.test(n)) destinos.push(columna);
  });

  const pares: Par[] = [];
  const problemas: string[] = [];
  dias.forEach(({ dia, columna }, i) => {
    const limite = dias[i + 1]?.columna ?? Infinity;
    const destino = destinos.find((c) => c > columna && c < limite);
    if (destino === undefined) problemas.push(`${DIAS[dia]} no tiene columna OBRA al lado.`);
    else pares.push({ dia, columnaNombre: columna, columnaDestino: destino });
  });
  if (new Set(pares.map((p) => p.dia)).size !== pares.length) problemas.push("Hay un día repetido en el encabezado.");
  return { pares, problemas };
}

function fechaIso(anio: number, mes: number, dia: number): string | null {
  const iso = `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return esFechaIso(iso) ? iso : null;
}

const ddmm = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

/**
 * Lee la planilla vieja. Los títulos no traen año: `anioInicial` es el de la
 * primera semana y se suma uno cada vez que se pasa de diciembre a enero.
 */
export async function parsearPlanillaLegacy(archivo: ArrayBuffer, anioInicial: number): Promise<ResultadoParseo> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(archivo);
  } catch {
    throw new ErrorPlanilla("No se pudo leer el archivo. ¿Es un Excel .xlsx?");
  }
  const hoja =
    libro.worksheets.find((h) => normalizar(h.name) === "JORNALES") ??
    (libro.worksheets.length === 1 ? libro.worksheets[0] : undefined);
  if (!hoja) throw new ErrorPlanilla('El archivo no tiene una hoja llamada "Jornales".');

  const resultado: ResultadoParseo = { semanas: [], filas: [], sinDestino: 0, advertencias: [] };
  const advertir = (fila: number, mensaje: string) => resultado.advertencias.push({ fila, mensaje });
  /** fecha|trabajador normalizado → fila donde apareció primero. */
  const vistos = new Map<string, number>();

  let anio = anioInicial;
  let anterior: { mes: number; dia: number } | null = null;
  const ultimaFila = hoja.actualRowCount > 0 ? hoja.lastRow?.number ?? 0 : 0;
  let r = 1;

  while (r <= ultimaFila) {
    const titulo = TITULO_SEMANA.exec(textoCelda(hoja.getRow(r).getCell(1)));
    if (!titulo) {
      if (!filaVacia(textosFila(hoja, r))) advertir(r, "Fila fuera de una semana (no hay un título SEMANA DEL … arriba): se ignora.");
      r++;
      continue;
    }

    const filaTitulo = r;
    const [diaDesde, mesDesde, diaHasta, mesHasta] = titulo.slice(1).map(Number) as [number, number, number, number];

    // Año: si el título vuelve atrás en el calendario, se pasó de diciembre a enero.
    if (anterior && (mesDesde < anterior.mes || (mesDesde === anterior.mes && diaDesde < anterior.dia))) {
      if (anterior.mes >= 11 && mesDesde <= 2) anio++;
      else advertir(filaTitulo, "Esta semana es anterior a la de arriba: se asume el mismo año.");
    }
    anterior = { mes: mesDesde, dia: diaDesde };

    const desde = fechaIso(anio, mesDesde, diaDesde);
    const hasta = fechaIso(mesHasta < mesDesde ? anio + 1 : anio, mesHasta, diaHasta);

    // Encabezado: la fila siguiente (se toleran filas vacías en el medio).
    r++;
    while (r <= ultimaFila && filaVacia(textosFila(hoja, r))) r++;
    const { pares, problemas } = leerEncabezado(textosFila(hoja, r));
    const filaEncabezado = r;
    r++;

    // Las fechas de cada columna se cuentan desde el lunes de la semana del título.
    const lunes = desde ? lunesDe(desde) : "";
    let semanaValida = true;
    if (!desde || !hasta) {
      advertir(filaTitulo, `Fecha inválida en "${titulo[0]}": se ignora la semana.`);
      semanaValida = false;
    } else if (pares.length === 0) {
      advertir(filaEncabezado, "No se encontró el encabezado LUNES / OBRA … debajo del título: se ignora la semana.");
      semanaValida = false;
    } else {
      for (const p of problemas) advertir(filaEncabezado, p);
      const primerDia = Math.min(...pares.map((p) => p.dia));
      if (sumarDias(lunes, primerDia) !== desde) {
        advertir(filaTitulo, `El ${ddmm(desde)}/${anio} no cae ${DIAS[primerDia]!.toLowerCase()}: revisá el año elegido.`);
      }
      if (hasta < desde || sumarDias(desde, 6) < hasta) {
        advertir(filaTitulo, `El rango ${ddmm(desde)} al ${ddmm(hasta)} no es una semana.`);
      }
      resultado.semanas.push({ fila: filaTitulo, desde, hasta });
    }

    // Datos: hasta una fila vacía o el próximo título.
    const columnasConocidas = new Set(pares.flatMap((p) => [p.columnaNombre, p.columnaDestino]));
    for (; r <= ultimaFila; r++) {
      const textos = textosFila(hoja, r);
      if (filaVacia(textos) || TITULO_SEMANA.test(textos[1] ?? "")) break;
      if (!semanaValida) continue;

      const huerfanas = textos.flatMap((t, c) => (t && !columnasConocidas.has(c) ? [t] : []));
      if (huerfanas.length > 0) advertir(r, `Datos en columnas sin encabezado de día ("${huerfanas.join('", "')}"): se ignoran.`);

      for (const { dia, columnaNombre, columnaDestino } of pares) {
        const trabajador = textos[columnaNombre] ?? "";
        const destino = textos[columnaDestino] ?? "";
        if (!trabajador) {
          if (destino) advertir(r, `${DIAS[dia]}: hay destino "${destino}" sin trabajador: se ignora.`);
          continue;
        }
        if (!destino) {
          resultado.sinDestino++;
          continue;
        }
        const fecha = sumarDias(lunes, dia);
        const clave = `${fecha}|${normalizar(trabajador)}`;
        const previa = vistos.get(clave);
        if (previa !== undefined) {
          advertir(r, `${trabajador} ya tiene un registro el ${ddmm(fecha)} (fila ${previa}): se usa el primero.`);
          continue;
        }
        vistos.set(clave, r);
        resultado.filas.push({ fila: r, fecha, trabajador, destino: FALTA.test(destino) ? null : destino });
      }
    }
  }

  return resultado;
}
