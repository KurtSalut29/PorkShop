import type { Metadata } from "next";
import { PageHeader } from "@/components/page";
import { requireRole } from "@/server/dal";
import { getSettings } from "@/server/settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole("OWNER");
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Settings" description="Shop hours, pickup capacity and assignment rules. Changes are audited." />
      <SettingsForm
        settings={{
          shopName: s.shopName,
          openTime: s.openTime,
          closeTime: s.closeTime,
          slotMinutes: s.slotMinutes,
          slotCapacity: s.slotCapacity,
          leadTimeMinutes: s.leadTimeMinutes,
          advanceDays: s.advanceDays,
          maxActiveOrdersPerWorker: s.maxActiveOrdersPerWorker,
        }}
      />
    </>
  );
}
