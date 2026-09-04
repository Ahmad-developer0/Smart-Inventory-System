import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, AlertTriangle, Loader2 } from "lucide-react";
import { AppShell } from "@/components/met/AppShell";
import { CategoryIcon } from "@/components/met/CategoryIcon";
import { useCategories, useStores, useProducts } from "@/lib/db-service";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MET — Dashboard" },
      { name: "description", content: "Quick overview of activity, sales, categories and stores." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: categoriesList, isLoading: catsLoading } = useCategories();
  const { data: storesList, isLoading: storesLoading } = useStores();
  const { data: productsList, isLoading: productsLoading } = useProducts();

  const lowStock = productsList ? productsList.filter((p) => p.stock < 5).length : 0;
  const categoriesCount = categoriesList ? categoriesList.length : 0;
  const topCategories = categoriesList ? categoriesList.slice(0, 6) : [];

  return (
    <AppShell title="MET">
      <div className="px-5 pt-4 space-y-7">
        {/* Top item categories from DB */}
        <section>
          <h2 className="text-base font-bold mb-3">Top item categories</h2>
          {catsLoading ? (
            <div className="flex justify-center py-6 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {topCategories.map((c) => (
                  <div key={c.id} className="aspect-square rounded-2xl bg-accent flex items-center justify-center">
                    <CategoryIcon name={c.icon || "Shirt"} className="h-9 w-9 text-primary-deep" />
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground mt-3">View more</p>
            </>
          )}
        </section>

        {/* Inventory stats from DB */}
        <section className="bg-muted rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-sm">Low stock items</span>
            </div>
            <span className="text-sm font-bold text-primary">
              {productsLoading ? <Loader2 className="h-3 w-3 animate-spin inline" /> : lowStock}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Item categories</span>
            <span className="text-sm font-bold">
              {catsLoading ? <Loader2 className="h-3 w-3 animate-spin inline" /> : categoriesCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Total products</span>
            <span className="text-sm font-bold">
              {productsLoading ? <Loader2 className="h-3 w-3 animate-spin inline" /> : productsList?.length ?? 0}
            </span>
          </div>
        </section>

        {/* Stores list from DB */}
        <section>
          <h2 className="text-base font-bold mb-3">Stores list</h2>
          {storesLoading ? (
            <div className="flex justify-center py-6 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="bg-card rounded-2xl shadow-sm border border-border/50 divide-y divide-border/60">
              {storesList && storesList.length > 0 ? (
                storesList.map((s) => (
                  <Link
                    key={s.id}
                    to="/stores/$storeId"
                    params={{ storeId: (s as { slug?: string }).slug || s.id }}
                    className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/40"
                  >
                    <span className="text-sm font-medium">{s.location || s.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))
              ) : (
                <p className="text-center py-6 text-sm text-muted-foreground">No stores yet.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
