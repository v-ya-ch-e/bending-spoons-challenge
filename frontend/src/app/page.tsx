import { cookies } from "next/headers";

import { AppShell } from "@/components/app-shell";
import {
  parseSidebarCollapsed,
  parseThemeMode,
  sidebarCollapsedCookieName,
  themeModeCookieName,
} from "@/lib/ui-preferences";

export default async function Home() {
  const cookieStore = await cookies();

  return (
    <AppShell
      initialSidebarCollapsed={parseSidebarCollapsed(
        cookieStore.get(sidebarCollapsedCookieName)?.value
      )}
      initialThemeMode={parseThemeMode(cookieStore.get(themeModeCookieName)?.value)}
    />
  );
}
