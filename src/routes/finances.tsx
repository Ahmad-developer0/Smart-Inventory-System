import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart, CircleDollarSign, TrendingUp, Loader2, Package } from "lucide-react";
import { AppShell } from "@/components/met/AppShell";
import { useFinanceProducts } from "@/lib/db-service";
import { formatPKR as money } from "@/lib/currency";

export const Route = createFileRoute("/finances")({
  head: () => ({ meta: [{ title: "Finances — MET" }] }),
  component: FinancesPage,
});

function FinancesPage() {
  const { data: rows, isLoading, isError } = useFinanceProducts();

  const totalPurchase = rows?.reduce((sum, r) => sum + r.totalPurchase, 0) ?? 0;
  const totalSelling = rows?.reduce((sum, r) => sum + r.totalSelling, 0) ?? 0;
  const totalProfit = totalSelling - totalPurchase;
  const totalMargin = totalSelling > 0 ? (totalProfit / totalSelling) * 100 : 0;

  return (
    <AppShell title="Finances">
      <div className="px-4 pt-4 pb-6 space-y-4">
        <h2 className="text-xl font-extrabold">Finances</h2>

        {isLoading ? (
          <div className="flex justify-center py-12 text-primary">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : isError ? (
          <p className="text-center py-10 text-sm text-muted-foreground">
            Couldn't load financial data. Please check your connection.
          </p>
        ) : (
          <>
            {/* Summary cards */}
            <div className="space-y-3">
              <SummaryCard
                icon={<ShoppingCart className="h-4 w-4 text-blue-600" />}
                iconBg="bg-blue-100"
                label="Total Purchase Value"
                value={money(totalPurchase)}
                valueCls="text-blue-600"
                sub={`Across ${rows?.length ?? 0} products`}
              />
              <SummaryCard
                icon={<CircleDollarSign className="h-4 w-4 text-purple-600" />}
                iconBg="bg-purple-100"
                label="Total Selling Value"
                value={money(totalSelling)}
                valueCls="text-purple-600"
                sub="Potential revenue"
              />
              <SummaryCard
                icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
                iconBg="bg-emerald-100"
                label="Total Profit"
                value={money(totalProfit)}
                valueCls="text-emerald-600"
                sub={`${totalMargin.toFixed(1)}% margin`}
              />
            </div>

            {/* Product financial breakdown */}
            <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
              <h3 className="font-bold text-base px-4 pt-4 pb-2">Product Financial Breakdown</h3>
              {rows && rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[760px]">
                    <thead>
                      <tr className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                        <th className="text-left font-semibold px-4 py-2.5">Product</th>
                        <th className="text-left font-semibold px-3 py-2.5">Category</th>
                        <th className="text-right font-semibold px-3 py-2.5">Stock</th>
                        <th className="text-right font-semibold px-3 py-2.5">Unit Purchase</th>
                        <th className="text-right font-semibold px-3 py-2.5">Unit Selling</th>
                        <th className="text-right font-semibold px-3 py-2.5">Total Purchase</th>
                        <th className="text-right font-semibold px-3 py-2.5">Total Selling</th>
                        <th className="text-right font-semibold px-3 py-2.5">Profit</th>
                        <th className="text-right font-semibold px-4 py-2.5">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-3 font-semibold whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <Package className="h-3.5 w-3.5 text-primary shrink-0" />
                              {r.name}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{r.category}</td>
                          <td className="px-3 py-3 text-right">{r.stock}</td>
                          <td className="px-3 py-3 text-right">{money(r.unitPurchase)}</td>
                          <td className="px-3 py-3 text-right">{money(r.unitSelling)}</td>
                          <td className="px-3 py-3 text-right">{money(r.totalPurchase)}</td>
                          <td className="px-3 py-3 text-right">{money(r.totalSelling)}</td>
                          <td className="px-3 py-3 text-right font-semibold text-emerald-600">
                            {money(r.profit)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <MarginBadge value={r.margin} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-purple-50 font-bold">
                        <td className="px-4 py-3 text-purple-700" colSpan={5}>
                          Totals
                        </td>
                        <td className="px-3 py-3 text-right text-purple-700">{money(totalPurchase)}</td>
                        <td className="px-3 py-3 text-right text-purple-700">{money(totalSelling)}</td>
                        <td className="px-3 py-3 text-right text-emerald-600">{money(totalProfit)}</td>
                        <td className="px-4 py-3 text-right">
                          <MarginBadge value={totalMargin} />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-sm text-muted-foreground">
                  No products yet — add products to see the financial breakdown.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function SummaryCard({
  icon,
  iconBg,
  label,
  value,
  valueCls,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueCls: string;
  sub: string;
}) {
  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
      <div className="flex items-center gap-2.5">
        <div className={`h-8 w-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-extrabold mt-2.5 ${valueCls}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function MarginBadge({ value }: { value: number }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold whitespace-nowrap">
      {value.toFixed(1)}%
    </span>
  );
}
