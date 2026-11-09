"use client";
import { useEffect } from "react";
import { toast } from "sonner";
export default function P() {
  useEffect(() => {
    const t = setTimeout(() => {
      toast.loading("Saving product…", { duration: Infinity });
      toast.info("Order #1042 is ready for pickup", { description: "Maria packed it. Head to the counter when you arrive.", duration: Infinity });
      toast.warning("2 items in your cart need attention", { description: "Pork Head sold out while you were shopping.", duration: Infinity });
      toast.error("Couldn’t reach the shop’s server", { description: "Check your internet connection and try again. Nothing was changed.", duration: Infinity });
      toast.success("Added 1 kg Pork Belly", { description: "Estimate ₱390.00", duration: Infinity, action: { label: "View cart", onClick: () => {} }, cancel: { label: "Undo", onClick: () => {} } });
    }, 300);
    return () => clearTimeout(t);
  }, []);
  return <div className="min-h-screen bg-background p-10"><div className="mx-auto mt-40 h-60 max-w-3xl rounded-2xl border bg-card" /></div>;
}
