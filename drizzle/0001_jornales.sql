CREATE TABLE `jornales` (
	`id` text PRIMARY KEY NOT NULL,
	`fecha` text NOT NULL,
	`trabajador_id` text NOT NULL,
	`estado` text NOT NULL,
	`obra_id` text,
	`motivo_ausencia` text,
	`fraccion` real DEFAULT 1 NOT NULL,
	`nota` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trabajador_id`) REFERENCES `trabajadores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "jornales_estado_check" CHECK(("jornales"."estado" = 'trabajo' AND "jornales"."obra_id" IS NOT NULL AND "jornales"."motivo_ausencia" IS NULL)
        OR ("jornales"."estado" = 'ausente' AND "jornales"."obra_id" IS NULL AND "jornales"."motivo_ausencia" IS NOT NULL)),
	CONSTRAINT "jornales_fraccion_check" CHECK("jornales"."fraccion" IN (1, 0.5)),
	CONSTRAINT "jornales_fecha_check" CHECK("jornales"."fecha" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jornales_fecha_trabajador_uq` ON `jornales` (`fecha`,`trabajador_id`);