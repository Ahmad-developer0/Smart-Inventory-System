import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, SlidersHorizontal, Store as StoreIcon, Loader2, X } from "lucide-react";
import { AppShell } from "@/components/met/AppShell";
import { useRole } from "@/lib/auth-store";
import { useStores } from "@/lib/db-service";

export const Route = createFileRoute("/stores")({
  head: () => ({ meta: [{ title: "Stores — MET" }] }),
  component: StoresPage,
});

function StoresPage() {
  const role = useRole();
  const isAdmin = role !== "viewer";
  const { data: storesList, isLoading } = useStores();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");

  const filtered = useMemo(() => {
    if (!storesList) return [];
    const q = query.trim().toLowerCase();
    return storesList.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !s.location.toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      return true;
    });
  }, [storesList, query, statusFilter]);

  return (
    <AppShell title="Stores">
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
            aria-label="Search stores"
          >
            {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
          {isAdmin && (
            <Link
              to="/add"
              search={{ type: "store" }}
              className="flex-1 h-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Store
            </Link>
          )}
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`h-10 px-4 rounded-full border text-sm font-medium inline-flex items-center gap-1.5 shrink-0 ${
              filterOpen || statusFilter !== "all"
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
            placeholder="Search stores by name or location..."
            className="w-full h-11 px-4 rounded-xl bg-muted border border-transparent focus:border-primary focus:bg-card outline-none text-sm"
          />
        )}

        {filterOpen && (
          <div className="bg-card rounded-2xl border border-border/50 p-4 text-sm">
            <label className="font-semibold block mb-1.5">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="w-full h-10 px-3 rounded-xl bg-muted outline-none"
            >
              <option value="all">All stores</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
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
              filtered.map((s, i) => (
                <Link
                  key={s.id}
                  to="/stores/$storeId"
                  params={{ storeId: (s as { slug?: string }).slug || s.id }}
                  className={`block rounded-2xl p-3 border shadow-sm ${
                    i === 0 ? "bg-accent border-accent" : "bg-card border-border/50"
                  }`}
                >
                  <div className="flex gap-3 items-center">
                    <div className="h-20 w-28 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <StoreIcon className="h-8 w-8 text-primary-deep" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base">{s.location || s.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {s.items} items · {s.employees} staff
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                        s.status === "open"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-center py-10 text-sm text-muted-foreground">
                {query || statusFilter !== "all"
                  ? "No stores match your search/filter."
                  : "No stores found."}
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
