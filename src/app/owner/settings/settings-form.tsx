"use client";

import { saveSettingsAction } from "@/app/actions/admin";
import { useConfirmedFormAction } from "@/components/feedback/confirm";
import { errorFor, Field, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";

type Settings = {
  shopName: string;
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  slotCapacity: number;
  leadTimeMinutes: number;
  advanceDays: number;
  maxActiveOrdersPerWorker: number;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const { onSubmit, pending, fieldErrors: fe } = useConfirmedFormAction(saveSettingsAction, {
    loading: "Saving settings…",
    confirm: (fd) => {
      const labels: Record<keyof Settings, string> = {
        shopName: "Shop name",
        openTime: "Opens at",
        closeTime: "Closes at",
        slotMinutes: "Slot length",
        slotCapacity: "Orders per slot",
        leadTimeMinutes: "Lead time",
        advanceDays: "Booking window",
        maxActiveOrdersPerWorker: "Orders per worker",
      };
      const changes = (Object.keys(labels) as (keyof Settings)[])
        .filter((k) => String(fd.get(k) ?? "") !== String(settings[k]))
        .map((k) => ({ label: labels[k], value: `${settings[k]} → ${String(fd.get(k) ?? "")}` }));
      return {
        title: changes.length ? `Save ${changes.length} setting change${changes.length > 1 ? "s" : ""}?` : "Save without changes?",
        description: changes.length
          ? "Pickup slots and automatic assignment use the new values immediately. Existing orders keep their pickup times."
          : "Nothing has changed.",
        details: changes,
        confirmLabel: "Save settings",
        tone: changes.length ? "warning" : "default",
      };
    },
  });

  return (
    <form onSubmit={onSubmit} className="grid max-w-4xl gap-6" noValidate>
      <section className="rounded-2xl border bg-card shadow-[0_1px_2px_oklch(0.2_0.01_240/0.05)]">
        <header className="border-b px-5 py-4">
          <h2 className="font-semibold">Shop</h2>
        </header>
        <div className="grid gap-5 p-5 sm:grid-cols-3">
          <Field label="Shop name" htmlFor="shopName" error={errorFor(fe, "shopName")}>
            <Input id="shopName" name="shopName" defaultValue={settings.shopName} />
          </Field>
          <Field label="Opens at" htmlFor="openTime" error={errorFor(fe, "openTime")}>
            <Input id="openTime" name="openTime" type="time" defaultValue={settings.openTime} className="num" />
          </Field>
          <Field label="Closes at" htmlFor="closeTime" error={errorFor(fe, "closeTime")}>
            <Input id="closeTime" name="closeTime" type="time" defaultValue={settings.closeTime} className="num" />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border bg-card shadow-[0_1px_2px_oklch(0.2_0.01_240/0.05)]">
        <header className="border-b px-5 py-4">
          <h2 className="font-semibold">Pickup slots</h2>
          <p className="text-sm text-muted-foreground">Controls the time slots customers can book at checkout.</p>
        </header>
        <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Slot length (minutes)" htmlFor="slotMinutes" error={errorFor(fe, "slotMinutes")} hint="30, 60, 90 or 120">
            <Input id="slotMinutes" name="slotMinutes" inputMode="numeric" defaultValue={settings.slotMinutes} className="num" />
          </Field>
          <Field label="Orders per slot" htmlFor="slotCapacity" error={errorFor(fe, "slotCapacity")}>
            <Input id="slotCapacity" name="slotCapacity" inputMode="numeric" defaultValue={settings.slotCapacity} className="num" />
          </Field>
          <Field label="Preparation lead time (min)" htmlFor="leadTimeMinutes" error={errorFor(fe, "leadTimeMinutes")} hint="Earliest pickup after ordering">
            <Input id="leadTimeMinutes" name="leadTimeMinutes" inputMode="numeric" defaultValue={settings.leadTimeMinutes} className="num" />
          </Field>
          <Field label="Book up to (days ahead)" htmlFor="advanceDays" error={errorFor(fe, "advanceDays")}>
            <Input id="advanceDays" name="advanceDays" inputMode="numeric" defaultValue={settings.advanceDays} className="num" />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border bg-card shadow-[0_1px_2px_oklch(0.2_0.01_240/0.05)]">
        <header className="border-b px-5 py-4">
          <h2 className="font-semibold">Automatic assignment</h2>
          <p className="text-sm text-muted-foreground">
            Orders go to the on-duty worker with the fewest active orders, up to this limit.
          </p>
        </header>
        <div className="grid gap-5 p-5 sm:grid-cols-3">
          <Field
            label="Max active orders per worker"
            htmlFor="maxActiveOrdersPerWorker"
            error={errorFor(fe, "maxActiveOrdersPerWorker")}
            hint="Individual workers can override this"
          >
            <Input id="maxActiveOrdersPerWorker" name="maxActiveOrdersPerWorker" inputMode="numeric" defaultValue={settings.maxActiveOrdersPerWorker} className="num" />
          </Field>
        </div>
      </section>

      <div>
        <SubmitButton pending={pending}>Save settings</SubmitButton>
      </div>
    </form>
  );
}
