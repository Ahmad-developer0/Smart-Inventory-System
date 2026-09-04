import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addNotification, checkLowStock } from "./notifications-store";
import { localDb } from "./local-db";
import { withTimeout } from "./with-timeout";

// Demo-store rows use prefixed ids (prod-/cat-/store-); real Supabase rows are UUIDs.
const isLocalId = (id: string) =>
  id.startsWith("prod-") || id.startsWith("cat-") || id.startsWith("store-");

const SUPABASE_TIMEOUT_MS = 10_000;

// Queries need the browser Supabase session; the server has none.
const isBrowser = typeof window !== "undefined";

// Detail routes accept either a slug ("ahmad-raza-2") or the row's uuid, so
// older /products/<uuid> links keep working after slugs were introduced.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID_RE.test(value);

// Builds the `.eq()` column name for a lookup value.
const lookupColumn = (value: string) => (isUuid(value) ? "id" : "slug");

// Runs a lookup against `id` for uuids and `slug` for everything else.
async function lookupBySlugOrId<T>(
  value: string,
  run: (column: "id" | "slug") => Promise<{ data: T | null; error: unknown }>
): Promise<T | null> {
  const { data, error } = await run(lookupColumn(value));
  if (error) throw error;
  return data;
}

// Turns a name into a URL slug — mirrors the database's slugify() so the
// client can predict/display slugs without a round trip.
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

// Every read/write below goes through this: a hung Supabase call (dropped
// connection, dev-server restart, stuck auth state) times out instead of
// leaving the UI spinning forever, and falls back to localDb exactly like any
// other failure already does.
async function withFallback<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await withTimeout(fn(), SUPABASE_TIMEOUT_MS);
  } catch (err) {
    // Log why we fell back. Swallowing this silently made a real failure look
    // like "no data yet", which is very hard to debug from the UI alone.
    console.warn("[db-service] Supabase call failed, using local fallback:", err);
    return fallback();
  }
}

// ─── seeding ──────────────────────────────────────────────────────────────────

// Disabled: Supabase now holds real inventory data, so an empty table means
// "no products yet," not "needs demo data." Left as a no-op (rather than
// removing the calls below) so re-enabling only requires editing this function.
export async function seedDatabaseIfEmpty() {
  return;
}

// ─── queries ──────────────────────────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      withFallback(async () => {
        await seedDatabaseIfEmpty();
        const { data, error } = await supabase
          .from("categories")
          .select("*")
          .order("name");
        if (error) throw error;
        return data ?? [];
      }, () => localDb.categoriesRaw()),
    retry: 0,
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const mapped = await withFallback(async () => {
        await seedDatabaseIfEmpty();
        const { data, error } = await supabase
          .from("products")
          .select(`*, categories(name), product_stores(store_id)`)
          .order("name");
        if (error) throw error;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (data ?? []).map((p: any) => ({
          id: p.id,
          // Prefer the slug for links; fall back to the uuid if a row predates
          // the slug migration or the column isn't populated yet.
          slug: (p.slug as string | null) || p.id,
          name: p.name,
          category: p.categories?.name ?? "Uncategorized",
          categoryId: p.category_id as string | null,
          stock: p.stock_quantity,
          stores: p.product_stores?.length ?? 0,
          status: p.status as "active" | "inactive",
          image: p.image_url ?? "",
        }));
      }, () => localDb.products());
      checkLowStock(mapped);
      return mapped;
    },
    retry: 0,
  });
}

export function useProduct(productId: string) {
  return useQuery({
    queryKey: ["product", productId],
    // See useCategory: skip placeholder/empty ids that are not valid uuids.
    enabled: isBrowser && !!productId && productId !== "__none__",
    queryFn: () =>
      withFallback(async () => {
        const data = await lookupBySlugOrId(productId, (column) =>
          supabase
            .from("products")
            .select(`*, categories(name), product_stores(stores(id, name, location))`)
            .eq(column, productId)
            .maybeSingle()
        );
        if (!data) return localDb.productById(productId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = data as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const linkedStores = (p.product_stores ?? [])
          .map((ps: any) => ps.stores)
          .filter(Boolean);
        return {
          id: p.id as string,
          name: p.name as string,
          description: (p.description ?? "") as string,
          category: p.categories?.name ?? "Uncategorized",
          categoryId: (p.category_id ?? null) as string | null,
          purchasePrice: Number(p.purchase_price ?? 0),
          salePrice: Number(p.sale_price ?? 0),
          stock: p.stock_quantity as number,
          sku: (p.sku ?? "") as string,
          status: p.status as "active" | "inactive",
          image: (p.image_url ?? "") as string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          storeIds: linkedStores.map((s: any) => s.id as string),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          stores: linkedStores.map((s: any) => ({ id: s.id, name: s.location || s.name })),
          createdAt: p.created_at as string,
        };
      }, () => localDb.productById(productId)),
    retry: 0,
  });
}

export function useCategory(categoryId: string) {
  return useQuery({
    queryKey: ["category", categoryId],
    // Callers on the "add" screen pass "" (nothing to load yet). Querying with
    // an empty id makes Postgres reject it as an invalid uuid, so skip it.
    enabled: isBrowser && !!categoryId,
    queryFn: () =>
      withFallback(async () => {
        const data = await lookupBySlugOrId(categoryId, (column) =>
          supabase.from("categories").select("*").eq(column, categoryId).maybeSingle()
        );
        return data ?? localDb.categoryById(categoryId);
      }, () => localDb.categoryById(categoryId)),
    retry: 0,
  });
}

export function useStoreDetail(storeId: string) {
  return useQuery({
    queryKey: ["store", storeId],
    // See useCategory: "" is not a valid uuid, so don't query for it.
    enabled: isBrowser && !!storeId,
    queryFn: () =>
      withFallback(async () => {
        const data = await lookupBySlugOrId(storeId, (column) =>
          supabase.from("stores").select("*").eq(column, storeId).maybeSingle()
        );
        if (!data) return localDb.storeDetail(storeId);

        // storeId may be a slug, but these joins key on the real uuid.
        const realStoreId = data.id;

        // Linked products (for item count / most sold / top category)
        const { data: links } = await supabase
          .from("product_stores")
          .select(`products(id, name, stock_quantity, categories(name))`)
          .eq("store_id", realStoreId);

        const { count: ordersCount } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("store_id", realStoreId);

        const { count: refundsCount } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("store_id", realStoreId)
          .eq("status", "refunded");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const linkedProducts = (links ?? []).map((l: any) => l.products).filter(Boolean);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mostSold = linkedProducts.reduce(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (best: any, p: any) => (!best || p.stock_quantity > best.stock_quantity ? p : best),
          null
        );

        return {
          id: data.id,
          name: data.name,
          location: data.location ?? "",
          employees: data.employees,
          items: linkedProducts.length > 0 ? linkedProducts.length : data.initial_items_count,
          orders: ordersCount ?? 0,
          refunds: refundsCount ?? 0,
          mostSold: mostSold?.name ?? "—",
          topCategory: mostSold?.categories?.name ?? "—",
          satisfaction: 90,
          status: data.status as "open" | "closed",
        };
      }, () => localDb.storeDetail(storeId)),
    retry: 0,
  });
}

// Finance breakdown straight from the products table
export function useFinanceProducts() {
  return useQuery({
    queryKey: ["finance-products"],
    queryFn: () =>
      withFallback(async () => {
        await seedDatabaseIfEmpty();
        const { data, error } = await supabase
          .from("products")
          .select(`*, categories(name)`)
          .order("name");
        if (error) throw error;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (data ?? []).map((p: any) => {
          const purchase = Number(p.purchase_price ?? 0);
          const sale = Number(p.sale_price ?? 0);
          const stock = p.stock_quantity as number;
          const totalPurchase = purchase * stock;
          const totalSelling = sale * stock;
          const profit = totalSelling - totalPurchase;
          const margin = totalSelling > 0 ? (profit / totalSelling) * 100 : 0;
          return {
            id: p.id as string,
            name: p.name as string,
            category: p.categories?.name ?? "Uncategorized",
            stock,
            unitPurchase: purchase,
            unitSelling: sale,
            totalPurchase,
            totalSelling,
            profit,
            margin,
          };
        });
      }, () => localDb.financeProducts()),
    retry: 0,
  });
}

export function useStores() {
  return useQuery({
    queryKey: ["stores"],
    queryFn: () =>
      withFallback(async () => {
        await seedDatabaseIfEmpty();
        const { data, error } = await supabase
          .from("stores")
          .select("*")
          .order("name");
        if (error) throw error;
        return (data ?? []).map((s) => ({
          id: s.id,
          slug: s.slug || s.id,
          name: s.name,
          location: s.location ?? "",
          image: s.images?.[0] ?? "",
          employees: s.employees,
          items: s.initial_items_count,
          orders: 0,
          refunds: 0,
          mostSold: "",
          topCategory: "",
          satisfaction: 90,
          status: s.status as "open" | "closed",
        }));
      }, () => localDb.stores()),
    retry: 0,
  });
}

// ─── mutations ────────────────────────────────────────────────────────────────
// Each mutation tries Supabase first; if the write is blocked (anon RLS,
// unconfirmed email, offline) it falls back to the local demo store so the
// UI stays fully functional.

export function useAddCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cat: {
      name: string;
      description?: string;
      icon?: string;
    }) =>
      withFallback(async () => {
        const { data, error } = await supabase
          .from("categories")
          .insert(cat)
          .select()
          .single();
        if (error) throw error;
        return data;
      }, () => localDb.addCategory(cat)),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      addNotification("category", "Category added", `Category "${data.name}" has been created.`);
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string; description?: string; icon?: string }) => {
      const { id, ...catData } = input;
      if (isLocalId(id)) {
        return Promise.resolve(localDb.updateCategory(id, catData));
      }
      return withFallback(async () => {
        const { data, error } = await supabase
          .from("categories")
          .update(catData)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }, () => localDb.updateCategory(id, catData));
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["category", variables.id] });
      // Products embed the category name, so their cached copies are stale too.
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["finance-products"] });
      addNotification(
        "category",
        "Category updated",
        `Category "${data?.name ?? variables.name}" has been updated.`
      );
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) => {
      if (isLocalId(input.id)) {
        localDb.deleteCategory(input.id);
        return Promise.resolve(input);
      }
      return withFallback(async () => {
        // products.category_id is ON DELETE SET NULL, so products survive and
        // simply become uncategorised — no manual cleanup needed here.
        const { error } = await supabase.from("categories").delete().eq("id", input.id);
        if (error) throw error;
        return input;
      }, () => {
        localDb.deleteCategory(input.id);
        return input;
      });
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["finance-products"] });
      addNotification("category", "Category deleted", `Category "${variables.name}" has been removed.`);
    },
  });
}

export function useUpdateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      name: string;
      location: string;
      initial_items_count: number;
      status: "open" | "closed";
    }) => {
      const { id, ...storeData } = input;
      if (isLocalId(id)) {
        return Promise.resolve(localDb.updateStore(id, storeData));
      }
      return withFallback(async () => {
        const { data, error } = await supabase
          .from("stores")
          .update(storeData)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }, () => localDb.updateStore(id, storeData));
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: ["store", variables.id] });
      addNotification(
        "store",
        "Store updated",
        `Store "${data?.location || data?.name || variables.location}" has been updated.`
      );
    },
  });
}

export function useDeleteStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) => {
      if (isLocalId(input.id)) {
        localDb.deleteStore(input.id);
        return Promise.resolve(input);
      }
      return withFallback(async () => {
        // product_stores rows are ON DELETE CASCADE, so links clean themselves up.
        const { error } = await supabase.from("stores").delete().eq("id", input.id);
        if (error) throw error;
        return input;
      }, () => {
        localDb.deleteStore(input.id);
        return input;
      });
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      addNotification("store", "Store deleted", `Store "${variables.name}" has been removed.`);
    },
  });
}

export function useAddProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (product: {
      name: string;
      description?: string;
      category_id: string | null;
      purchase_price: number;
      sale_price: number;
      stock_quantity: number;
      sku?: string;
      storeIds?: string[];
    }) =>
      withFallback(async () => {
        const { storeIds, ...prodData } = product;
        const { data, error } = await supabase
          .from("products")
          .insert(prodData)
          .select()
          .single();
        if (error) throw error;
        if (data && storeIds?.length) {
          const { error: linkErr } = await supabase
            .from("product_stores")
            .insert(storeIds.map((sid) => ({ product_id: data.id, store_id: sid })));
          if (linkErr) throw linkErr;
        }
        return data;
      }, () => localDb.addProduct(product)),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["finance-products"] });
      addNotification("product", "Product added", `Product "${data.name}" has been added to inventory.`);
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      description?: string;
      category_id: string | null;
      purchase_price: number;
      sale_price: number;
      stock_quantity: number;
      sku?: string;
      storeIds?: string[];
    }) => {
      const { id, storeIds, ...prodData } = input;
      if (isLocalId(id)) {
        return localDb.updateProduct(id, { ...prodData, storeIds });
      }
      return withFallback(async () => {
        const { data, error } = await supabase
          .from("products")
          .update(prodData)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        // Replace store links
        if (storeIds) {
          await supabase.from("product_stores").delete().eq("product_id", id);
          if (storeIds.length) {
            const { error: linkErr } = await supabase
              .from("product_stores")
              .insert(storeIds.map((sid) => ({ product_id: id, store_id: sid })));
            if (linkErr) throw linkErr;
          }
        }
        return data;
      }, () => localDb.updateProduct(id, { ...prodData, storeIds }));
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["finance-products"] });
      qc.invalidateQueries({ queryKey: ["product", variables.id] });
      addNotification("product", "Product updated", `Product "${data?.name ?? variables.name}" has been updated.`);
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      if (isLocalId(input.id)) {
        localDb.deleteProduct(input.id);
        return input;
      }
      return withFallback(async () => {
        // Remove store links first, then the product
        await supabase.from("product_stores").delete().eq("product_id", input.id);
        const { error } = await supabase.from("products").delete().eq("id", input.id);
        if (error) throw error;
        return input;
      }, () => {
        localDb.deleteProduct(input.id);
        return input;
      });
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["finance-products"] });
      addNotification("product", "Product deleted", `Product "${variables.name}" has been removed.`);
    },
  });
}

export function useAddStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (store: {
      name: string;
      location: string;
      initial_items_count: number;
      status: "open" | "closed";
    }) =>
      withFallback(async () => {
        const { data, error } = await supabase
          .from("stores")
          .insert(store)
          .select()
          .single();
        if (error) throw error;
        return data;
      }, () => localDb.addStore(store)),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      addNotification("store", "Store added", `Store "${data.location || data.name}" has been added.`);
    },
  });
}
