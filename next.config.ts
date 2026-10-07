import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "exceljs"],
  experimental: {
    // La importación de jornales sube el .xlsx y después las filas leídas.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
