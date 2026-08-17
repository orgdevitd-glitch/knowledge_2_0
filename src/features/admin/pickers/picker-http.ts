import { NextResponse } from "next/server";

import { PICKER_CACHE_CONTROL } from "./picker-limits";

export function pickerOkJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": PICKER_CACHE_CONTROL },
  });
}

export function pickerMethodNotAllowed(): NextResponse {
  return new NextResponse(null, {
    status: 405,
    headers: {
      Allow: "GET",
      "Cache-Control": PICKER_CACHE_CONTROL,
    },
  });
}
