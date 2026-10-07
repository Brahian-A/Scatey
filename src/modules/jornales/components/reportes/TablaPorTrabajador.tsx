import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatearJornales } from "../../formato";
import type { FilaPorTrabajador } from "../../queries";
import { MOTIVOS_AUSENCIA } from "../../schema";

const AYUDA_SIN_REGISTRO =
  "Días hábiles hasta hoy sin ningún registro. Cuentan de lunes a viernes, y los sábados solo si en el período hay jornales cargados algún sábado.";

function Numero({ valor, resaltar }: { valor: number; resaltar?: boolean }) {
  return (
    <TableCell
      className={cn(
        "text-right tabular-nums",
        valor === 0 ? "text-muted-foreground/60" : resaltar && "font-medium text-red-700",
      )}
    >
      {valor === 0 ? "—" : formatearJornales(valor)}
    </TableCell>
  );
}

export function TablaPorTrabajador({ filas }: { filas: FilaPorTrabajador[] }) {
  return (
    <div className="grid gap-2">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trabajador</TableHead>
              <TableHead className="text-right">Jornales</TableHead>
              {MOTIVOS_AUSENCIA.map((m) => (
                <TableHead key={m.value} className="text-right">
                  {m.label}
                </TableHead>
              ))}
              <TableHead className="text-right" title={AYUDA_SIN_REGISTRO}>
                Días sin registro
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 && (
              <TableRow>
                <TableCell colSpan={MOTIVOS_AUSENCIA.length + 3} className="py-10 text-center text-muted-foreground">
                  No hay trabajadores para mostrar.
                </TableCell>
              </TableRow>
            )}
            {filas.map((f) => (
              <TableRow key={f.id} className={cn(!f.activo && "text-muted-foreground")}>
                <TableCell className="font-medium">
                  {f.nombre}
                  {!f.activo && <span className="ml-1.5 text-xs font-normal">(inactivo)</span>}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatearJornales(f.jornales)}</TableCell>
                {MOTIVOS_AUSENCIA.map((m) => (
                  <Numero key={m.value} valor={f.ausencias[m.value]} resaltar={m.value === "falta"} />
                ))}
                <Numero valor={f.sinRegistro} resaltar />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Medio jornal cuenta 0,5. {AYUDA_SIN_REGISTRO}</p>
    </div>
  );
}
