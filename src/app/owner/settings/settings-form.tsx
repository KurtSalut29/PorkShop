"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { saveSettingsAction } from "@/app/actions/admin";
import { errorFor, Field, FormAlert, SubmitButton } from "@/components/form";
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
  const [state, action] = useActionState(saveSettingsAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  useEffect(() => {
    if (state?.ok) toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="grid max-w-4xl gap-6">
      {state && !state.ok && <FormAlert state={state} />}
      <section className="rounded-xl border bg-card shadow-xs">
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

      <section className="rounded-xl border bg-card shadow-xs">
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

      <section className="rounded-xl border bg-card shadow-xs">
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
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </form>
  );
}
