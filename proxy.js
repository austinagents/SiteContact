import { NextResponse } from "next/server";

export function proxy(request) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const extensionToken = process.env.EXTENSION_API_TOKEN;
  const suppliedToken = request.headers.get("x-extension-token");

  if (extensionToken && suppliedToken === extensionToken) return NextResponse.next();
  if (!username || !password) {
    return new NextResponse("Server authentication is not configured.", { status: 503 });
  }

  const authorization = request.headers.get("authorization") || "";
  if (authorization.startsWith("Basic ")) {
    try {
      const decoded = atob(authorization.slice(6));
      const separator = decoded.indexOf(":");
      if (decoded.slice(0, separator) === username && decoded.slice(separator + 1) === password) {
        return NextResponse.next();
      }
    } catch {}
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SiteContact Operator", charset="UTF-8"' }
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
