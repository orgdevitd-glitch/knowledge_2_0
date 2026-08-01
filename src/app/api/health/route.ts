import { NextResponse } from "next/server";

import { SERVICE_NAME } from "@/config/constants";
import { getAppEnvironment } from "@/config/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  const payload = {
    status: "ok" as const,
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    environment: getAppEnvironment(),
  };

  logger.info("Health check OK", {
    route: "/api/health",
    environment: payload.environment,
  });

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
