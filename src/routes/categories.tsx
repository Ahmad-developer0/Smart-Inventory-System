import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, SlidersHorizontal, Loader2, X, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/met/AppShell";
import { CategoryIcon } from "@/components/met/CategoryIcon";
import { useRole } from "@/lib/auth-store";
import { useCategories } from "@/lib/db-service";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categories — MET" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const role = useRole();
  const isAdmin = role !== "viewer";
  const { data: categoriesList, isLoading } = useCategories();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"az" | "za" | "newest">("az");

  const filtered = useMemo(() => {
    if (!categoriesList) return [];
    const q = query.trim().toLowerCase();
    const list = categoriesList.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      if (sortOrder === "az") return a.name.localeCompare(b.name);
      if (sortOrder === "za") return b.name.localeCompare(a.name);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [categoriesList, query, sortOrder]);

  return (
    <AppShell title="Categories">
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
            aria-label="Search categories"
          >
            {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
          {isAdmin && (
            <Link
              to="/add"
              search={{ type: "category" }}
              className="flex-1 h-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Category
            </Link>
          )}
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`h-10 px-4 rounded-full border text-sm font-medium inline-flex items-center gap-1.5 shrink-0 ${
              filterOpen ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
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
            placeholder="Search categories..."
            className="w-full h-11 px-4 rounded-xl bg-muted border border-transparent focus:border-primary focus:bg-card outline-none text-sm"
          />
        )}

        {filterOpen && (
          <div className="bg-card rounded-2xl border border-border/50 p-4 text-sm">
            <label className="font-semibold block mb-1.5">Sort by</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              className="w-full h-10 px-3 rounded-xl bg-muted outline-none"
            >
              <option value="az">Name (A–Z)</option>
              <option value="za">Name (Z–A)</option>
              <option value="newest">Newest first</option>
            </select>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12 text-primary">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.length > 0 ? (
              filtered.map((c) => (
                <Link
                  key={c.id}
                  to="/categories/$categoryId"
                  params={{ categoryId: (c as { slug?: string }).slug || c.id }}
                  className="bg-card rounded-2xl p-3 shadow-sm border border-border/50 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="h-14 w-14 rounded-xl bg-accent flex items-center justify-center shrink-0">
                    <CategoryIcon name={c.icon || "Shirt"} className="h-7 w-7 text-primary-deep" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.description || "No description"}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </Link>
              ))
            ) : (
              <p className="text-center py-10 text-sm text-muted-foreground">
                {query ? "No categories match your search." : "No categories found."}
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
