import "server-only";
import ExcelJS from "exceljs";
import { diaMes, fechaUtc, nombreDia, sumarDias, type Rango } from "./fechas";
import { obtenerGrillaSemana, reporteDetalle, reportePorObra, reportePorTrabajador } from "./queries";
import { ETIQUETA_MOTIVO, MOTIVOS_AUSENCIA } from "./schema";
import { claveCelda } from "./validation";

const FORMATO_FECHA = "dd/mm/yyyy";
const MEDIO = "½";

// Colores ARGB (Excel no entiende "#rrggbb").
const ROJO_CLARO = "FFFEE2E2";
const ROJO_TEXTO = "FFB91C1C";
const GRIS_CLARO = "FFF1F5F9";
const GRIS_TEXTO = "FF64748B";
const ENCABEZADO = "FFE2E8F0";

function argb(hex: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex) ? `FF${hex.slice(1).toUpperCase()}` : "FF94A3B8";
}

/** Texto negro o blanco según qué se lea mejor sobre el color de la obra. */
function textoSobre(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0);
  return (0.299 * r! + 0.587 * g! + 0.114 * b!) / 255 > 0.6 ? "FF000000" : "FFFFFFFF";
}

const relleno = (color: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: color } });

function nuevoLibro(): ExcelJS.Workbook {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Scatey";
  libro.created = new Date();
  return libro;
}

/** Hoja con encabezado en negrita, primera fila fija y anchos de columna. */
function nuevaHoja(
  libro: ExcelJS.Workbook,
  nombre: string,
  columnas: Array<Partial<ExcelJS.Column>>,
  fijarColumnas = 0,
): ExcelJS.Worksheet {
  const hoja = libro.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1, xSplit: fijarColumnas }] });
  hoja.columns = columnas;
  hoja.getRow(1).eachCell((celda) => {
    celda.font = { bold: true };
    celda.fill = relleno(ENCABEZADO);
    celda.alignment = { vertical: "middle" };
  });
  return hoja;
}

const filtroEncabezado = (hoja: ExcelJS.Worksheet) => {
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columnCount } };
};

export type ArchivoExcel = { nombre: string; contenido: ArrayBuffer };

/** Un .xlsx con los tres reportes del rango: Por trabajador, Por obra y Detalle. */
export async function excelReportes(rango: Rango): Promise<ArchivoExcel> {
  const [porTrabajador, porObra, detalle] = await Promise.all([
    reportePorTrabajador(rango),
    reportePorObra(rango),
    reporteDetalle(rango),
  ]);
  const libro = nuevoLibro();

  const h1 = nuevaHoja(libro, "Por trabajador", [
    { header: "Trabajador", key: "trabajador", width: 28 },
    { header: "Jornales", key: "jornales", width: 11 },
    ...MOTIVOS_AUSENCIA.map((m) => ({ header: m.label, key: m.value, width: 12 })),
    { header: "Días sin registro", key: "sinRegistro", width: 17 },
  ]);
  for (const f of porTrabajador) {
    h1.addRow({
      trabajador: f.activo ? f.nombre : `${f.nombre} (inactivo)`,
      jornales: f.jornales,
      ...f.ausencias,
      sinRegistro: f.sinRegistro,
    });
  }
  filtroEncabezado(h1);

  const h2 = nuevaHoja(libro, "Por obra", [
    { header: "Obra / trabajador", key: "nombre", width: 32 },
    { header: "Jornales", key: "jornales", width: 11 },
    { header: "Trabajadores", key: "trabajadores", width: 13 },
    { header: "Primer día", key: "primerDia", width: 12, style: { numFmt: FORMATO_FECHA } },
    { header: "Último día", key: "ultimoDia", width: 12, style: { numFmt: FORMATO_FECHA } },
  ]);
  // Las filas de cada trabajador quedan agrupadas (nivel 1) debajo de su obra.
  h2.properties.outlineProperties = { summaryBelow: false, summaryRight: false };
  h2.properties.outlineLevelRow = 1;
  for (const o of porObra) {
    const fila = h2.addRow({
      nombre: o.nombre,
      jornales: o.jornales,
      trabajadores: o.trabajadores,
      primerDia: fechaUtc(o.primerDia),
      ultimoDia: fechaUtc(o.ultimoDia),
    });
    fila.font = { bold: true };
    fila.getCell("nombre").fill = relleno(argb(o.color));
    fila.getCell("nombre").font = { bold: true, color: { argb: textoSobre(o.color) } };
    for (const t of o.porTrabajador) {
      const sub = h2.addRow({ nombre: t.nombre, jornales: t.jornales });
      sub.outlineLevel = 1;
      sub.getCell("nombre").alignment = { indent: 2 };
    }
  }

  const h3 = nuevaHoja(libro, "Detalle", [
    { header: "Fecha", key: "fecha", width: 12, style: { numFmt: FORMATO_FECHA } },
    { header: "Trabajador", key: "trabajador", width: 28 },
    { header: "Obra / motivo", key: "obraMotivo", width: 30 },
    { header: "Fracción", key: "fraccion", width: 10 },
    { header: "Nota", key: "nota", width: 50 },
  ]);
  for (const f of detalle.filas) {
    h3.addRow({
      fecha: fechaUtc(f.fecha),
      trabajador: f.trabajador,
      obraMotivo: f.obra?.nombre ?? (f.motivoAusencia ? ETIQUETA_MOTIVO[f.motivoAusencia] : ""),
      fraccion: f.fraccion,
      nota: f.nota ?? "",
    });
  }
  filtroEncabezado(h3);

  return {
    nombre: `jornales_${rango.desde}_a_${rango.hasta}.xlsx`,
    contenido: (await libro.xlsx.writeBuffer()) as ArrayBuffer,
  };
}

/**
 * La semana como se ve en la grilla: trabajadores en filas, días en columnas,
 * el nombre de la obra con su color en cada celda y las faltas en rojo claro.
 */
export async function excelSemana(semana: string, conSabado: boolean): Promise<ArchivoExcel> {
  const dias = Array.from({ length: conSabado ? 6 : 5 }, (_, i) => sumarDias(semana, i));
  const [grilla, totales] = await Promise.all([
    obtenerGrillaSemana(semana),
    reportePorTrabajador({ desde: semana, hasta: sumarDias(semana, 6) }),
  ]);
  const totalPorTrabajador = new Map(totales.map((t) => [t.id, t.jornales]));
  const porClave = new Map(grilla.registros.map((r) => [claveCelda(r), r]));
  const obrasPorId = new Map(grilla.obras.map((o) => [o.id, o]));

  const libro = nuevoLibro();
  const hoja = nuevaHoja(
    libro,
    `Semana del ${diaMes(semana).replace("/", "-")}`,
    [
      { header: "Trabajador", key: "trabajador", width: 26 },
      ...dias.map((d) => ({ header: `${nombreDia(d)} ${diaMes(d)}`, key: d, width: 18 })),
      { header: "Total", key: "total", width: 8 },
    ],
    1,
  );
  const borde: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };
  hoja.getRow(1).eachCell((c) => {
    c.border = borde;
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  hoja.getRow(1).getCell(1).alignment = { vertical: "middle" };

  for (const t of grilla.trabajadores) {
    const fila = hoja.addRow({
      trabajador: t.activo ? t.nombre : `${t.nombre} (inactivo)`,
      total: totalPorTrabajador.get(t.id) ?? 0,
    });
    fila.height = 20;
    fila.getCell("trabajador").font = { bold: true };
    fila.getCell("total").font = { bold: true };

    for (const d of dias) {
      const celda = fila.getCell(d);
      celda.border = borde;
      celda.alignment = { horizontal: "center", vertical: "middle" };
      const reg = porClave.get(claveCelda({ fecha: d, trabajadorId: t.id }));
      if (!reg) continue;

      const medio = reg.fraccion === 0.5 ? ` ${MEDIO}` : "";
      if (reg.estado === "trabajo") {
        const obra = obrasPorId.get(reg.obraId);
        const color = obra?.color ?? "#94a3b8";
        celda.value = `${obra?.nombre ?? "Obra"}${medio}`;
        celda.fill = relleno(argb(color));
        celda.font = { color: { argb: textoSobre(color) } };
      } else if (reg.motivoAusencia === "falta") {
        celda.value = `FALTA${medio}`;
        celda.fill = relleno(ROJO_CLARO);
        celda.font = { bold: true, color: { argb: ROJO_TEXTO } };
      } else {
        celda.value = `${ETIQUETA_MOTIVO[reg.motivoAusencia]}${medio}`;
        celda.fill = relleno(GRIS_CLARO);
        celda.font = { color: { argb: GRIS_TEXTO } };
      }
      if (reg.nota) celda.note = reg.nota;
    }
    fila.getCell("trabajador").border = borde;
    fila.getCell("total").border = borde;
  }

  return {
    nombre: `jornales_semana_${semana}.xlsx`,
    contenido: (await libro.xlsx.writeBuffer()) as ArrayBuffer,
  };
}

/** Respuesta HTTP que el navegador descarga como archivo. */
export function descargarExcel({ nombre, contenido }: ArchivoExcel): Response {
  return new Response(contenido, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
