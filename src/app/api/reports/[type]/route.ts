import { CATEGORY_LABEL, STOCK_TXN, type StockTxnType } from "@/lib/constants";
import { resolveRange } from "@/lib/dates";
import { formatDateTime } from "@/lib/format";
import { getCurrentUser } from "@/server/dal";
import { listStockTransactions } from "@/server/queries/inventory";
import { inventoryReport, movementReport, salesReport } from "@/server/queries/reports";

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number | null)[][]) {
  // UTF-8 BOM so Excel shows ₱ and accented names correctly.
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

const n2 = (v: number) => v.toFixed(2);
const n3 = (v: number) => Number(v.toFixed(3));

export async function GET(request: Request, ctx: { params: Promise<{ type: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") return new Response("Forbidden", { status: 403 });

  const { type } = await ctx.params;
  const url = new URL(request.url);
  const range = resolveRange(url.searchParams.get("from"), url.searchParams.get("to"), new Date());
  let rows: (string | number | null)[][];

  switch (type) {
    case "sales": {
      const r = await salesReport(range);
      rows = [
        ["Date", "Completed orders", "Revenue (PHP)"],
        ...r.series.map((d) => [d.day, d.orders, n2(d.revenue)]),
        [],
        ["Product", "Unit", "Quantity sold", "Orders", "Revenue (PHP)"],
        ...r.byProduct.map((p) => [p.name, p.unit, n3(p.qty), p.orders, n2(p.revenue)]),
        [],
        ["Total revenue", n2(r.totalRevenue)],
        ["Total orders", r.totalOrders],
        ["Average order", n2(r.averageOrder)],
        ["Cancelled orders", r.cancelled],
      ];
      break;
    }
    case "movements": {
      const r = await movementReport(range);
      rows = [
        ["Product", "Unit", "Stock in", "Withdrawn", "Returned", "Spoiled", "Corrections", "On hand now", "Spoilage value (PHP)"],
        ...r.table.map((p) => [
          p.name, p.unit, n3(p.stockIn), n3(p.withdrawn), n3(p.returned), n3(p.spoiled), n3(p.corrected), n3(p.onHand), n2(p.spoilageValue),
        ]),
      ];
      break;
    }
    case "inventory": {
      const r = await inventoryReport();
      rows = [
        ["SKU", "Product", "Category", "Unit", "Price (PHP)", "On hand", "Reserved", "Available", "Low-stock level", "Status", "Stock value (PHP)"],
        ...r.products.map((p) => [
          p.sku, p.name, CATEGORY_LABEL[p.category], p.unit, n2(p.price), n3(p.stockQty), n3(p.reservedQty), n3(p.available),
          n3(p.lowStockThreshold), p.level === "ok" ? "OK" : p.level === "low" ? "Low" : "Out", n2(p.stockQty * p.price),
        ]),
      ];
      break;
    }
    case "transactions": {
      const txns = await listStockTransactions({
        start: range.start,
        end: range.end,
        type: url.searchParams.get("type") ?? undefined,
        productId: url.searchParams.get("product") ?? undefined,
        take: 5000,
      });
      rows = [
        ["Date", "Product", "Type", "Quantity", "Balance after", "Reason", "Order", "Recorded by"],
        ...txns.map((t) => [
          formatDateTime(t.createdAt), t.product.name, STOCK_TXN[t.type as StockTxnType].label, n3(t.quantity), n3(t.balanceAfter),
          t.reason, t.order ? `#${String(t.order.number).padStart(6, "0")}` : "", t.actor?.name ?? "",
        ]),
      ];
      break;
    }
    default:
      return new Response("Unknown report", { status: 404 });
  }

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="porkshop-${type}-${range.fromKey}-to-${range.toKey}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
