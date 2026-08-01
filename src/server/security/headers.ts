/**
 * Builds HTTP security headers for Next.js `headers()` config.
 *
 * Production CSP allows only the minimal Firebase Auth / Google Sign-In
 * origins required for Phase 5A. See docs/security/CSP-PHASE5.md.
 */
export type SecurityHeader = {
  key: string;
  value: string;
};

export type SecurityHeaderOptions = {
  isDevelopment: boolean;
  isProduction: boolean;
};

export function buildContentSecurityPolicy(options: {
  isDevelopment: boolean;
}): string {
  const { isDevelopment } = options;

  const scriptSrc = isDevelopment
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com https://apis.google.com"
    : "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com";

  const connectSrc = [
    "'self'",
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
    "https://www.googleapis.com",
    "https://firebaseinstallations.googleapis.com",
    ...(isDevelopment ? ["ws:", "wss:"] : []),
  ].join(" ");

  const directives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://www.gstatic.com https://lh3.googleusercontent.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ];

  return directives.join("; ");
}

export function buildSecurityHeaders(
  options: SecurityHeaderOptions,
): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy({
        isDevelopment: options.isDevelopment,
      }),
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
    { key: "X-Frame-Options", value: "DENY" },
  ];

  if (options.isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
