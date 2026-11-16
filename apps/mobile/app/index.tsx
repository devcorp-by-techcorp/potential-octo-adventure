/**
 * Entry route — resolves the persona from the session and redirects.
 * Restoring → splash; signed out → marketing site; client → client portal;
 * staff → studio. Unavailable keeps the user on a retry panel.
 */
import { Redirect } from "expo-router";
import { useSession } from "~/state/session";
import { Splash, RetryPanel } from "~/components/SessionGate";

export default function Index() {
  const { status } = useSession();
  switch (status) {
    case "restoring": return <Splash />;
    case "signed-out": return <Redirect href="/marketing" />;
    case "staff": return <Redirect href="/(admin)/dashboard" />;
    case "client": return <Redirect href="/(client)/home" />;
    case "unavailable": return <RetryPanel />;
  }
}
