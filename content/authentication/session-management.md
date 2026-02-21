# Session Management (Next.js)

This page covers cookie-based session management for **[Next.js](https://nextjs.org/) frontend applications**. The Next.js app acts as a Backend-for-Frontend (BFF), storing tokens in HTTP-only cookies rather than localStorage for better XSS protection.

## How it works

The diagram below shows the session flow (production deployments include load balancers, WAF, CDN, etc.):

```
Browser --> LB/WAF/CDN --> Next.js BFF --> Kong --> API
```

**Login flow:**

```
Browser                 LB/WAF/CDN              Next.js BFF                 Kong → API
   │                        │                        │                          │
   │── Login request ──────>│───────────────────────>│                          │
   │                        │                        │── Forward credentials ──>│
   │                        │                        │<─── Return tokens ───────│
   │<── Set-Cookie ─────────│<───────────────────────│                          │
```

**Subsequent API requests:**

```
Browser                 LB/WAF/CDN              Next.js BFF                 Kong → API
   │                        │                        │                          │
   │── Request + cookie ───>│───────────────────────>│                          │
   │                        │                        │── Forward + JWT ────────>│
   │                        │                        │<─── Response ────────────│
   │<── Response ───────────│<───────────────────────│                          │
```

The Next.js frontend stores tokens in HTTP-only cookies and forwards them to the API on each request.

## Token cookie utilities

tsdevstack includes utility functions for cookie management:

```typescript
// lib/utils/token-cookies.ts
import { NextResponse } from "next/server";
import { setHttpOnlyCookie, clearCookie } from "./cookies";

export function setTokenCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
): NextResponse {
  setHttpOnlyCookie(response, "accessToken", accessToken, {
    maxAge: parseInt(process.env.ACCESS_TOKEN_TTL || "900", 10),
  });
  setHttpOnlyCookie(response, "refreshToken", refreshToken, {
    maxAge: parseInt(process.env.REFRESH_TOKEN_TTL || "604800", 10),
  });
  return response;
}

export function clearTokenCookies(response: NextResponse) {
  clearCookie(response, "accessToken");
  clearCookie(response, "refreshToken");
}
```

## Login API route

```typescript
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authClient } from "@/lib/externalApi/auth-service.api";
import { setTokenCookies } from "@/lib/utils/token-cookies";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;

  // Call auth service via generated client
  const response = await authClient.v1.login({ email, password });
  const { accessToken, refreshToken } = response.data;

  // Set HTTP-only cookies
  const res = NextResponse.json({ message: "Login successful" });
  setTokenCookies(res, accessToken, refreshToken);

  return res;
}
```

## Frontend login function

```typescript
// lib/auth.ts
export async function login(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',  // Important: include cookies
  });

  return response.json();
}
```

## Logout

```typescript
// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { clearTokenCookies } from "@/lib/utils/token-cookies";

export async function POST() {
  const res = NextResponse.json({ message: "Logged out" });
  clearTokenCookies(res);
  return res;
}
```

## Cookie configuration

The `setHttpOnlyCookie` utility applies secure defaults:

```typescript
// lib/utils/cookies.ts
export function setHttpOnlyCookie(
  response: NextResponse,
  name: string,
  value: string,
  options = {}
) {
  response.cookies.set(name, value, {
    httpOnly: true,                              // Cannot be accessed by JS
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod
    sameSite: "lax",                             // CSRF protection
    path: "/",
    ...options,
  });
}
```

## Security considerations

- **HTTP-only cookies** - Cannot be accessed by JavaScript (XSS protection)
- **Secure flag** - Only sent over HTTPS in production
- **SameSite=lax** - Protects against CSRF attacks
- **Short access token lifetime** - Limits exposure if compromised (15 min default)
- **BFF pattern** - Tokens never exposed to browser JavaScript

