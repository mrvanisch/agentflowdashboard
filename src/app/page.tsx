import Dashboard from "@/components/dashboard";
import { ensureRegistrationToken } from "@/lib/registration-token";
import { ensureAdminAccount } from "@/lib/auth";

export default async function Home() {
  await ensureRegistrationToken();
  await ensureAdminAccount();
  return <Dashboard />;
}
