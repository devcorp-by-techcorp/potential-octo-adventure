/**
 * Entry route — resolves the persona from auth state and redirects.
 * Public visitor → marketing site; assigned client → client portal; admin → studio.
 */
import { Redirect } from "expo-router";
import { useSession } from "~/state/session";

export default function Index() {
  const { authed, role } = useSession();
  if (!authed) return <Redirect href="/marketing" />;
  return <Redirect href={role === "admin" ? "/(admin)/dashboard" : "/(client)/home"} />;
}
