import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(error: unknown) {
  if (error instanceof Error && error.name === "UnauthorizedError") {
    return fail("Musisz sie zalogowac.", 401);
  }
  const message = error instanceof Error ? error.message : "Nieznany blad.";
  return fail(message, 400);
}
