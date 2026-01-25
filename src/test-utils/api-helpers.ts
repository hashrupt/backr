import { NextRequest } from "next/server";

/**
 * Create a NextRequest with the given URL and options.
 */
export function createRequest(
  path: string,
  options?: RequestInit
): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"), options);
}

/**
 * Create a NextRequest with a JSON body.
 */
export function createJsonRequest(
  path: string,
  body: unknown,
  method = "POST"
): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Parse a NextResponse's JSON body and status.
 */
export async function parseResponse(response: Response) {
  const json = await response.json();
  return { status: response.status, body: json };
}
