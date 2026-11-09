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
  const {
    onSubmit,
    pending,
    fieldErrors: fe,
  } = useConfirmedFormAction(saveSettingsAction, {
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
        .map((k) => ({
          label: labels[k],
          value: `${settings[k]} → ${String(fd.get(k) ?? "")}`,
        }));
      return {
        title: changes.length
          ? `Save ${changes.length} setting change${changes.length > 1 ? "s" : ""}?`
          : "Save without changes?",
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
    <form onSubmit={onSubmit} className="grid gap-6 xl:gap-8" noValidate>
      <SettingsRow
        title="Shop"
        description="Your shop’s name and opening hours. Pickup slots are offered only while you’re open."
      >
        <div className="grid gap-5 p-5 sm:grid-cols-3">
          <Field
            label="Shop name"
            htmlFor="shopName"
            error={errorFor(fe, "shopName")}
          >
            <Input
              id="shopName"
              name="shopName"
              defaultValue={settings.shopName}
            />
          </Field>
          <Field
            label="Opens at"
            htmlFor="openTime"
            error={errorFor(fe, "openTime")}
          >
            <Input
              id="openTime"
              name="openTime"
              type="time"
              defaultValue={settings.openTime}
              className="num"
            />
          </Field>
          <Field
            label="Closes at"
            htmlFor="closeTime"
            error={errorFor(fe, "closeTime")}
          >
            <Input
              id="closeTime"
              name="closeTime"
              type="time"
              defaultValue={settings.closeTime}
              className="num"
            />
          </Field>
        </div>
      </SettingsRow>

      <SettingsRow
        title="Pickup slots"
        description="Controls the time slots customers can book at checkout."
      >
        <div className="grid gap-5 p-5 sm:grid-cols-2 2xl:grid-cols-4">
          <Field
            label="Slot length (minutes)"
            htmlFor="slotMinutes"
            error={errorFor(fe, "slotMinutes")}
            hint="30, 60, 90 or 120"
          >
            <Input
              id="slotMinutes"
              name="slotMinutes"
              inputMode="numeric"
              defaultValue={settings.slotMinutes}
              className="num"
            />
          </Field>
          <Field
            label="Orders per slot"
            htmlFor="slotCapacity"
            error={errorFor(fe, "slotCapacity")}
          >
            <Input
              id="slotCapacity"
              name="slotCapacity"
              inputMode="numeric"
              defaultValue={settings.slotCapacity}
              className="num"
            />
          </Field>
          <Field
            label="Preparation lead time (min)"
            htmlFor="leadTimeMinutes"
            error={errorFor(fe, "leadTimeMinutes")}
            hint="Earliest pickup after ordering"
          >
            <Input
              id="leadTimeMinutes"
              name="leadTimeMinutes"
              inputMode="numeric"
              defaultValue={settings.leadTimeMinutes}
              className="num"
            />
          </Field>
          <Field
            label="Book up to (days ahead)"
            htmlFor="advanceDays"
            error={errorFor(fe, "advanceDays")}
          >
            <Input
              id="advanceDays"
              name="advanceDays"
              inputMode="numeric"
              defaultValue={settings.advanceDays}
              className="num"
            />
          </Field>
        </div>
      </SettingsRow>

      <SettingsRow
        title="Automatic assignment"
        description="Orders go to the on-duty worker with the fewest active orders, up to this limit."
      >
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field
            label="Max active orders per worker"
            htmlFor="maxActiveOrdersPerWorker"
            error={errorFor(fe, "maxActiveOrdersPerWorker")}
            hint="Individual workers can override this"
          >
            <Input
              id="maxActiveOrdersPerWorker"
              name="maxActiveOrdersPerWorker"
              inputMode="numeric"
              defaultValue={settings.maxActiveOrdersPerWorker}
              className="num"
            />
          </Field>
        </div>
      </SettingsRow>

      <div className="lg:pl-[calc(17rem+2rem)]">
        <SubmitButton pending={pending}>Save settings</SubmitButton>
      </div>
    </form>
  );
}

/** One settings group: what it controls on the left, its fields on the right (stacked on small screens). */
function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
      <header className="lg:pt-4">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </header>
      <div className="rounded-2xl border bg-card shadow-[0_1px_2px_oklch(0.2_0.01_240/0.05)]">
        {children}
      </div>
    </section>
  );
}
