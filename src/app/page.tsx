import { FirstRunSetup } from "@/components/first-run-setup";
import { Homeboard } from "@/components/homeboard";
import { db } from "@/lib/db";
import { dashboardFor } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [household] = await db<{ id: string }[]>`SELECT id FROM households ORDER BY created_at LIMIT 1`;
  if (!household) return <FirstRunSetup />;
  return <Homeboard initialData={await dashboardFor(household.id)} />;
}
