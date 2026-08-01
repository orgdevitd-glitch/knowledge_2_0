import { NextResponse } from "next/server";

import { getOptionalAdminPrincipal } from "@/server/auth/guard";
import { toSafeAdminPrincipalView } from "@/server/auth/principal";

export const dynamic = "force-dynamic";

export async function GET() {
  const principal = await getOptionalAdminPrincipal();
  if (!principal) {
    return NextResponse.json(
      { authenticated: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      authenticated: true,
      principal: toSafeAdminPrincipalView(principal),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
