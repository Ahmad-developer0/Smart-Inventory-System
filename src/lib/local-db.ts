// Offline/outage fallback data layer.
//
// db-service.ts prefers Supabase for every read and write. This localStorage-
// backed store only takes over when a Supabase call actually fails (missing
// config, no connection, RLS rejection) so the app stays usable — it starts
// empty and holds real user-entered data, not seeded demo content.

export type LCategory = {
  id: string;
  name: string;
  description: string;
  icon: string;
  image_url: string | null;
  created_at: string;
};

export type LStore = {
  id: string;
  name: string;
  location: string;
  employees: number;
  initial_items_count: number;
  status: "open" | "closed";
  created_at: string;
};

export type LProduct = {
  id: string;
  name: string;
  description: string;
  category_id: string | null;
  purchase_price: number;
  sale_price: number;
  sku: string;
  stock_quantity: number;
  status: "active" | "inactive";
  image_url: string | null;
  storeIds: string[];
  created_at: string;
};

type LocalData = {
  categories: LCategory[];
  stores: LStore[];
  products: LProduct[];
};

// v3 — the seed catalog was removed (this store starts empty now, real data
// only). Bumping the key drops any old seeded demo data already cached in a
// browser from before that change, same as the v2 bump did for USD prices.
const KEY = "met_local_db_v3";

function seed(): LocalData {
  return { categories: [], stores: [], products: [] };
}

// ─── persistence ────────────────────────────────────────────────────────────────

let cache: LocalData | null = null;

function read(): LocalData {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = seed();
    return cache;
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      cache = JSON.parse(raw) as LocalData;
    } else {
      cache = seed();
      localStorage.setItem(KEY, JSON.stringify(cache));
    }
  } catch {
    cache = seed();
  }
  return cache;
}

function write(data: LocalData) {
  cache = data;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore quota / unavailable storage
  }
}

function newId(prefix: string) {
  const rand = typeof window !== "undefined" ? Math.random().toString(36).slice(2, 10) : "seed";
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

function nowIso() {
  return typeof window !== "undefined" ? new Date().toISOString() : "2026-01-01T00:00:00.000Z";
}

// ─── read selectors (shapes match db-service hooks) ─────────────────────────────

export const localDb = {
  categoriesRaw(): LCategory[] {
    return [...read().categories].sort((a, b) => a.name.localeCompare(b.name));
  },

  categoryById(id: string): LCategory | null {
    return read().categories.find((c) => c.id === id) ?? null;
  },

  products() {
    const { products, categories } = read();
    const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";
    return [...products]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: catName(p.category_id),
        categoryId: p.category_id,
        stock: p.stock_quantity,
        stores: p.storeIds.length,
        status: p.status,
        image: p.image_url ?? "",
        // Offline rows have no server-generated slug; the local id doubles as
        // the link target so the shape matches the Supabase path.
        slug: p.id,
      }));
  },

  productById(id: string) {
    const { products, categories, stores } = read();
    const p = products.find((x) => x.id === id);
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      category: categories.find((c) => c.id === p.category_id)?.name ?? "Uncategorized",
      categoryId: p.category_id,
      purchasePrice: p.purchase_price,
      salePrice: p.sale_price,
      stock: p.stock_quantity,
      sku: p.sku,
      status: p.status,
      image: p.image_url ?? "",
      storeIds: [...p.storeIds],
      stores: p.storeIds
        .map((sid) => stores.find((s) => s.id === sid))
        .filter(Boolean)
        .map((s) => ({ id: s!.id, name: s!.location || s!.name })),
      createdAt: p.created_at,
    };
  },

  stores() {
    return [...read().stores]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({
        id: s.id,
        slug: s.id,
        name: s.name,
        location: s.location,
        image: "",
        employees: s.employees,
        items: s.initial_items_count,
        orders: 0,
        refunds: 0,
        mostSold: "",
        topCategory: "",
        satisfaction: 90,
        status: s.status,
      }));
  },

  storeDetail(id: string) {
    const { stores, products, categories } = read();
    const s = stores.find((x) => x.id === id);
    if (!s) return null;
    const linked = products.filter((p) => p.storeIds.includes(id));
    const mostSold = linked.reduce<LProduct | null>(
      (best, p) => (!best || p.stock_quantity > best.stock_quantity ? p : best),
      null
    );
    return {
      id: s.id,
      name: s.name,
      location: s.location,
      employees: s.employees,
      items: linked.length > 0 ? linked.length : s.initial_items_count,
      orders: 0,
      refunds: 0,
      mostSold: mostSold?.name ?? "—",
      topCategory: categories.find((c) => c.id === mostSold?.category_id)?.name ?? "—",
      satisfaction: 90,
      status: s.status,
    };
  },

  financeProducts() {
    const { products, categories } = read();
    return [...products]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => {
        const totalPurchase = p.purchase_price * p.stock_quantity;
        const totalSelling = p.sale_price * p.stock_quantity;
        const profit = totalSelling - totalPurchase;
        const margin = totalSelling > 0 ? (profit / totalSelling) * 100 : 0;
        return {
          id: p.id,
          name: p.name,
          category: categories.find((c) => c.id === p.category_id)?.name ?? "Uncategorized",
          stock: p.stock_quantity,
          unitPurchase: p.purchase_price,
          unitSelling: p.sale_price,
          totalPurchase,
          totalSelling,
          profit,
          margin,
        };
      });
  },

  // ─── mutations ────────────────────────────────────────────────────────────────

  addCategory(cat: { name: string; description?: string; icon?: string }) {
    const data = read();
    const row: LCategory = {
      id: newId("cat"),
      name: cat.name,
      description: cat.description ?? "",
      icon: cat.icon ?? "Shirt",
      image_url: null,
      created_at: nowIso(),
    };
    write({ ...data, categories: [...data.categories, row] });
    return row;
  },

  updateCategory(id: string, patch: { name: string; description?: string; icon?: string }) {
    const data = read();
    let updated: LCategory | null = null;
    const categories = data.categories.map((c) => {
      if (c.id !== id) return c;
      updated = {
        ...c,
        name: patch.name,
        description: patch.description ?? "",
        icon: patch.icon ?? c.icon,
      };
      return updated;
    });
    write({ ...data, categories });
    return updated;
  },

  deleteCategory(id: string) {
    const data = read();
    write({
      ...data,
      categories: data.categories.filter((c) => c.id !== id),
      // Keep products but detach them, mirroring the ON DELETE SET NULL
      // behaviour of products.category_id in the Supabase schema.
      products: data.products.map((p) =>
        p.category_id === id ? { ...p, category_id: null } : p
      ),
    });
    return { id };
  },

  addStore(store: { name: string; location: string; initial_items_count: number; status: "open" | "closed" }) {
    const data = read();
    const row: LStore = {
      id: newId("store"),
      name: store.name || store.location,
      location: store.location,
      employees: 0,
      initial_items_count: store.initial_items_count,
      status: store.status,
      created_at: nowIso(),
    };
    write({ ...data, stores: [...data.stores, row] });
    return row;
  },

  updateStore(
    id: string,
    patch: { name: string; location: string; initial_items_count: number; status: "open" | "closed" }
  ) {
    const data = read();
    let updated: LStore | null = null;
    const stores = data.stores.map((s) => {
      if (s.id !== id) return s;
      updated = {
        ...s,
        name: patch.name || patch.location,
        location: patch.location,
        initial_items_count: patch.initial_items_count,
        status: patch.status,
      };
      return updated;
    });
    write({ ...data, stores });
    return updated;
  },

  deleteStore(id: string) {
    const data = read();
    write({
      ...data,
      stores: data.stores.filter((s) => s.id !== id),
      // Drop the store from any product's store links.
      products: data.products.map((p) => ({
        ...p,
        storeIds: p.storeIds.filter((sid) => sid !== id),
      })),
    });
    return { id };
  },

  addProduct(product: {
    name: string;
    description?: string;
    category_id: string | null;
    purchase_price: number;
    sale_price: number;
    stock_quantity: number;
    sku?: string;
    storeIds?: string[];
  }) {
    const data = read();
    const row: LProduct = {
      id: newId("prod"),
      name: product.name,
      description: product.description ?? "",
      category_id: product.category_id,
      purchase_price: product.purchase_price,
      sale_price: product.sale_price,
      sku: product.sku ?? "",
      stock_quantity: product.stock_quantity,
      status: "active",
      image_url: null,
      storeIds: product.storeIds ?? [],
      created_at: nowIso(),
    };
    write({ ...data, products: [...data.products, row] });
    return row;
  },

  updateProduct(
    id: string,
    patch: {
      name: string;
      description?: string;
      category_id: string | null;
      purchase_price: number;
      sale_price: number;
      stock_quantity: number;
      sku?: string;
      storeIds?: string[];
    }
  ) {
    const data = read();
    let updated: LProduct | null = null;
    const products = data.products.map((p) => {
      if (p.id !== id) return p;
      updated = {
        ...p,
        name: patch.name,
        description: patch.description ?? "",
        category_id: patch.category_id,
        purchase_price: patch.purchase_price,
        sale_price: patch.sale_price,
        stock_quantity: patch.stock_quantity,
        sku: patch.sku ?? "",
        storeIds: patch.storeIds ?? p.storeIds,
      };
      return updated;
    });
    write({ ...data, products });
    return updated;
  },

  deleteProduct(id: string) {
    const data = read();
    write({ ...data, products: data.products.filter((p) => p.id !== id) });
    return { id };
  },
};
