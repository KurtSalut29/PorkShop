"use client";

import { useState } from "react";
import { saveSettingsAction } from "@/app/actions/admin";
import { useConfirmedFormAction } from "@/components/feedback/confirm";
import { errorFor, Field, SubmitButton } from "@/components/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PhotoUpload } from "../products/photo-upload";

type Settings = {
  shopName: string;
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  slotCapacity: number;
  leadTimeMinutes: number;
  advanceDays: number;
  maxActiveOrdersPerWorker: number;
  gcashEnabled: boolean;
  gcashName: string;
  gcashNumber: string;
  gcashQrUrl: string;
  paymentWindowMinutes: number;
  pickupHoldHours: number;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const [qr, setQr] = useState(settings.gcashQrUrl);
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
        gcashEnabled: "GCash payments",
        gcashName: "GCash account name",
        gcashNumber: "GCash number",
        gcashQrUrl: "GCash QR code",
        paymentWindowMinutes: "Time to pay (GCash)",
        pickupHoldHours: "Pickup hold (cash)",
      };
      // How a value reads in the confirmation list.
      const show = (k: keyof Settings, v: string | number | boolean) =>
        k === "gcashEnabled" ? (v ? "On" : "Off") : k === "gcashQrUrl" ? (v ? "Uploaded" : "None") : String(v) || "—";
      const after = (k: keyof Settings): string | boolean =>
        k === "gcashEnabled" ? fd.get(k) === "on" : String(fd.get(k) ?? "");
      const changes = (Object.keys(labels) as (keyof Settings)[])
        .filter((k) => (k === "gcashEnabled" ? after(k) !== settings[k] : String(after(k)) !== String(settings[k])))
        .map((k) => ({
          label: labels[k],
          value: k === "gcashQrUrl" ? (after(k) ? "New QR code" : "Removed") : `${show(k, settings[k])} → ${show(k, after(k))}`,
        }));
      return {
        title: changes.length
          ? `Save ${changes.length} setting change${changes.length > 1 ? "s" : ""}?`
          : "Save without changes?",
        description: changes.length
          ? "New values apply right away. Orders already placed keep their pickup times and payment deadlines."
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

      <SettingsRow
        title="GCash payments"
        description="Let customers pay online before pickup, so the cuts you set aside are paid for. Customers scan this QR code or send to this number, then upload their receipt."
      >
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <label htmlFor="gcashEnabled" className="flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/40 p-4 sm:col-span-2">
            <Checkbox id="gcashEnabled" name="gcashEnabled" defaultChecked={settings.gcashEnabled} className="mt-0.5" />
            <span className="text-sm">
              <span className="font-medium">Accept GCash payments</span>
              <span className="mt-0.5 block text-muted-foreground">
                Customers can choose GCash at checkout. Cash at pickup stays available either way.
              </span>
            </span>
          </label>
          <Field label="GCash account name" htmlFor="gcashName" error={errorFor(fe, "gcashName")} hint="As shown in the GCash app">
            <Input id="gcashName" name="gcashName" defaultValue={settings.gcashName} placeholder="e.g. Juan D." aria-invalid={!!errorFor(fe, "gcashName")} />
          </Field>
          <Field label="GCash number" htmlFor="gcashNumber" error={errorFor(fe, "gcashNumber")}>
            <Input
              id="gcashNumber"
              name="gcashNumber"
              inputMode="tel"
              defaultValue={settings.gcashNumber}
              placeholder="0917 123 4567"
              className="num"
              aria-invalid={!!errorFor(fe, "gcashNumber")}
            />
          </Field>
          <Field label="GCash QR code" htmlFor="gcashQr" className="sm:col-span-2">
            <PhotoUpload
              id="gcashQr"
              name="gcashQrUrl"
              value={qr}
              onChange={({ url }) => setQr(url)}
              error={errorFor(fe, "gcashQrUrl")}
              title="GCash QR code"
              description="Customers scan this to pay."
              tip="In the GCash app, open “Receive” → “QR” → Download, then upload the saved image here."
              fit="contain"
              savedHint="Save settings to show it to customers."
              removedHint="Save settings to apply. Customers can’t pay by GCash without a QR code."
            />
          </Field>
        </div>
      </SettingsRow>

      <SettingsRow
        title="Payment and pickup time limits"
        description="Orders that aren’t paid for or collected in time are cancelled automatically and their cuts go back on sale. Customers are told these limits when they order."
      >
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field
            label="Time to pay by GCash (minutes)"
            htmlFor="paymentWindowMinutes"
            error={errorFor(fe, "paymentWindowMinutes")}
            hint="Customers who choose GCash must submit their payment within this time."
          >
            <Input id="paymentWindowMinutes" name="paymentWindowMinutes" inputMode="numeric" defaultValue={settings.paymentWindowMinutes} className="num" />
          </Field>
          <Field
            label="Pickup hold for cash orders (hours)"
            htmlFor="pickupHoldHours"
            error={errorFor(fe, "pickupHoldHours")}
            hint="A packed order paid in cash is released if not picked up this long after its pickup time."
          >
            <Input id="pickupHoldHours" name="pickupHoldHours" inputMode="numeric" defaultValue={settings.pickupHoldHours} className="num" />
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
