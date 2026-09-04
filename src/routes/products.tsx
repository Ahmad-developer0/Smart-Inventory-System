import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, SlidersHorizontal, Loader2, X } from "lucide-react";
import { AppShell } from "@/components/met/AppShell";
import { ProductListItem } from "@/components/met/ProductListItem";
import { useRole } from "@/lib/auth-store";
import { useProducts, useCategories } from "@/lib/db-service";

export const Route = createFileRoute("/products")({
  head: () => ({ meta: [{ title: "Products — MET" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const role = useRole();
  const isAdmin = role !== "viewer";
  const { data: productsList, isLoading } = useProducts();
  const { data: categoriesList } = useCategories();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const filtered = useMemo(() => {
    if (!productsList) return [];
    const q = query.trim().toLowerCase();
    return productsList.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) {
        return false;
      }
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (lowStockOnly && p.stock >= 5) return false;
      return true;
    });
  }, [productsList, query, categoryFilter, statusFilter, lowStockOnly]);

  const hasActiveFilter = categoryFilter !== "all" || statusFilter !== "all" || lowStockOnly;

  return (
    <AppShell title="Products">
      <div className="px-5 pt-4 space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setQuery("");
            }}
            className={`h-10 w-10 rounded-full border flex items-center justify-center shrink-0 ${
              searchOpen ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-primary"
            }`}
            aria-label="Search products"
          >
            {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
          {isAdmin && (
            <Link
              to="/add"
              search={{ type: "product" }}
              className="flex-1 h-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Product
            </Link>
          )}
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`h-10 px-4 rounded-full border text-sm font-medium inline-flex items-center gap-1.5 shrink-0 ${
              filterOpen || hasActiveFilter
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filter
          </button>
        </div>

        {searchOpen && (
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products by name or category..."
            className="w-full h-11 px-4 rounded-xl bg-muted border border-transparent focus:border-primary focus:bg-card outline-none text-sm"
          />
        )}

        {filterOpen && (
          <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3 text-sm">
            <div>
              <label className="font-semibold block mb-1.5">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-muted outline-none"
              >
                <option value="all">All categories</option>
                {categoriesList?.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1.5">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="w-full h-10 px-3 rounded-xl bg-muted outline-none"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="accent-[color:var(--primary)] h-4 w-4"
              />
              Low stock only (&lt; 5)
            </label>
            {hasActiveFilter && (
              <button
                onClick={() => {
                  setCategoryFilter("all");
                  setStatusFilter("all");
                  setLowStockOnly(false);
                }}
                className="text-primary font-semibold"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12 text-primary">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.length > 0 ? (
              filtered.map((p) => <ProductListItem key={p.id} product={p} />)
            ) : (
              <p className="text-center py-10 text-sm text-muted-foreground">
                {query || hasActiveFilter ? "No products match your search/filter." : "No products found."}
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
