"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCheck, History, MoreHorizontal, PackagePlus, Trash2, Undo2 } from "lucide-react";
import { CountCorrectionForm, StockMovementForm } from "@/components/staff/stock-forms";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProductOption } from "@/server/queries/inventory";

type Mode = "STOCK_IN" | "SPOILAGE" | "RETURN" | "COUNT";

const TITLES: Record<Mode, { title: string; description: string }> = {
  STOCK_IN: { title: "Record delivery", description: "Add received stock. It becomes available to customers immediately." },
  SPOILAGE: { title: "Record spoilage", description: "Write off product that can't be sold. Only unreserved stock can be removed." },
  RETURN: { title: "Record return", description: "Put product back into inventory." },
  COUNT: { title: "Count correction", description: "Set on-hand stock to what you physically counted. The difference is logged." },
};

function StockDialog({
  mode,
  products,
  productId,
  onOpenChange,
}: {
  mode: Mode | null;
  products: ProductOption[];
  productId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!mode} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {mode && (
          <>
            <DialogHeader>
              <DialogTitle>{TITLES[mode].title}</DialogTitle>
              <DialogDescription>{TITLES[mode].description}</DialogDescription>
            </DialogHeader>
            {mode === "COUNT" ? (
              <CountCorrectionForm products={products} defaultProductId={productId} onDone={() => onOpenChange(false)} />
            ) : (
              <StockMovementForm kind={mode} products={products} defaultProductId={productId} onDone={() => onOpenChange(false)} />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RecordDeliveryButton({ products }: { products: ProductOption[] }) {
  const [mode, setMode] = useState<Mode | null>(null);
  return (
    <>
      <Button onClick={() => setMode("STOCK_IN")}>
        <PackagePlus className="size-4" /> Record delivery
      </Button>
      <StockDialog mode={mode} products={products} onOpenChange={(o) => !o && setMode(null)} />
    </>
  );
}

export function RowStockMenu({ productId, products, name }: { productId: string; products: ProductOption[]; name: string }) {
  const [mode, setMode] = useState<Mode | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Stock actions for ${name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setMode("STOCK_IN")}>
            <PackagePlus /> Add stock
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMode("COUNT")}>
            <ClipboardCheck /> Count correction
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMode("RETURN")}>
            <Undo2 /> Record return
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setMode("SPOILAGE")}>
            <Trash2 /> Record spoilage
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/owner/transactions?product=${productId}`}>
              <History /> View history
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <StockDialog mode={mode} products={products} productId={productId} onOpenChange={(o) => !o && setMode(null)} />
    </>
  );
}
