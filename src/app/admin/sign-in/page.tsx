import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Container, Stack } from "@/components/layout";
import { getAuthMode } from "@/config/env";
import { getOptionalAdminPrincipal } from "@/server/auth/guard";
import { GoogleSignInButton } from "@/features/admin/ui/google-sign-in-button";
import { Link } from "@/components/ui/Link";

export const metadata: Metadata = {
  title: "Вход администратора",
  robots: { index: false, follow: false },
};

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const principal = await getOptionalAdminPrincipal();
  if (principal) {
    redirect("/admin");
  }

  const params = await searchParams;
  const reason = Array.isArray(params.reason) ? params.reason[0] : params.reason;
  const authMode = getAuthMode();

  let disabledReason: string | undefined;
  if (authMode === "disabled") {
    disabledReason =
      "Административный вход отключён в этом окружении (AUTH_MODE=disabled).";
  }

  return (
    <Container width="standard">
      <Stack gap={5} style={{ paddingBlock: "var(--space-7)", maxWidth: "28rem" }}>
        <header>
          <h1 style={{ margin: "0 0 0.5rem" }}>Вход для администраторов</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Доступ только для разрешённых аккаунтов Google. Самостоятельная
            регистрация недоступна.
          </p>
        </header>
        {reason === "unauthenticated" ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Требуется вход для доступа к административной части.
          </p>
        ) : null}
        <GoogleSignInButton disabledReason={disabledReason} />
        <p style={{ margin: 0 }}>
          <Link href="/" variant="subtle">
            На публичный портал
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
