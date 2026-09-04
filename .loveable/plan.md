# MET — Mobile-First Inventory App

A mobile-first responsive web app (~390px reference, max-width capped, centered on desktop) styled to match the deep-purple/lavender mockups. Make it for admin and client mean admin and viewer. There is two usernames and passwords for admin and client respectively. In admin, the add products, categories and stores are shown. On the other hand, in vieweror client page, the add products, categories and stores are not shown. Built on TanStack Start + Tailwind v4 + shadcn. Lovable Cloud is enabled and the full schema is provisioned, but tables stay empty — UI renders sample/placeholder data with `TODO: wire to DB` markers so we can attach queries later without restructuring.

## Design system (src/styles.css)

Add semantic tokens in oklch (converted from the brief):

- `--primary` deep purple `#5B00D6`
- `--primary-foreground` white
- `--accent` lavender `#E8D5FF`, `--accent-soft` `#DDD6FE`
- `--background` `#F4F4F6`, `--card` white, `--foreground` `#1A1A2E`, `--muted-foreground` `#6B7280`
- `--drawer` deep purple `#4400B5`
- `--badge-active` `#7C3AED`
- Radii: 12–16dp on cards/inputs/buttons
- Font: Inter (Google Fonts link in root head)

All components use tokens — no raw hex in JSX.

## Layout shell

- `MobileFrame` wrapper: full-bleed on mobile, `max-w-[420px] mx-auto` with soft side gutters on desktop so it always feels like a phone.
- `TopAppBar`: hamburger (opens drawer) | centered title | circular purple avatar.
- `BottomNav`: 4 tabs — Home (`/`),  Stores (`/stores`), Product (`/products`), Categories (`/categories`). Active tab in primary purple.
- `SideDrawer`: full-screen deep-purple overlay (sheet), X close, centered links Home / Products / Categories / Stores / Finances / Settings + Log out.

## Routes (TanStack file-based, all under `src/routes/`)

- `__root.tsx` — shell, head meta, font, QueryClientProvider, Outlet.
- `login.tsx` — `/login` standalone (no app shell). Deep-purple bg, two pill inputs, white Log in button. Client-side validation only; on submit navigate to `/`.
- `index.tsx` — `/` Dashboard.
- `add.tsx` — `/add` Add Product, Category and Store form.
- `products.tsx` — `/products` list.
- `categories.tsx` — `/categories` list.
- `stores.tsx` — `/stores` list.
- `stores.$storeId.tsx` — `/stores/:storeId` detail.
- `finances.tsx` — `/finances` placeholder screen.
- `settings.tsx` — `/settings` placeholder screen.

Each route sets its own `head()` title/description.

## Screens

1. **Login** — matches brief; on success → `/`.
2. **Dashboard** — Recent activity 3×2 stat cards (NEW ITEMS 741, NEW ORDERS 123, REFUNDS 12, MESSAGE 1, GROUPS 4, "View more >"), Sales bar chart (Confirmed/Packed/Refunded/Shipped — lavender card, two purple shades, simple divs, no axis), Top item categories 3×2 lavender image tiles (Lucide: Shirt, HardHat, ShoppingBag, Footprints, Backpack, Glasses), Inventory stats card (Low stock 12 w/ alert icon, Categories 6, Refunded 1), Stores list card (Manchester/Yorkshire/Hull/Leicester rows with chevron).
3. **Drawer** — sheet from left, deep-purple, white bold links, Log out at bottom.
4. **Products** — search icon, "+ Add Product" pill (links to `/add`), Filter button; list rows with 80×80 thumbnail, stock/category/store-count meta, Active purple pill + chevron, product name bold, divider.
5. **Add Product** — labeled rounded inputs: Product Name*, Description (textarea), Category* (Select), Purchase Price* (numeric), Sale Price*(numeric), Stock quantity, Store location (multi-select via checkboxes), Image picker (file input styled), SKU (optional). Sticky full-width purple Save button. Zod validation, toast on save (no DB write yet — `TODO`).
6. **Categories** — search icon, "+ Add Category" pill (links to `/add`), Filter button; wide white cards: lavender image square + name (N items) + "Description".
7. **Add Category** — labeled rounded inputs: Category Name*, Description (textarea),  Image picker (file input styled). Sticky full-width purple Save button. Zod validation, toast on save (no DB write yet — `TODO`).
8. **Stores** —search icon, "+ Add Store" pill (links to `/add`), Filter button;  large cards with photo placeholder + name; first card uses lavender highlight.
9. **Add Store** — labeled rounded inputs: Store Name , Location*,  Initial Items Count*(numeric), Store Status(dropdown selection menu to set open and close), Image picker (file input styled). Sticky full-width purple Save button. Zod validation, toast on save (no DB write yet — `TODO`).
10. **Store Detail** — heading, 3 thumbnail row, stats list ( Items, Orders, Refunds), insights (Most sold, Most popular category, Customer satisfaction 93%, Status Open).
11. **Finances / Settings** — minimal placeholder screens with title and "Coming soon" copy, keep app shell.

Sample/seed data lives in `src/lib/sample-data.ts` and is imported by each screen for now.

## Database (Lovable Cloud, empty tables)

Enable Lovable Cloud and create a migration with the full schema, RLS, and GRANTs — no seed rows. Tables:

- `categories` (id uuid pk, name text, icon text, created_at timestamptz default now())
- `stores` (id uuid pk, name text, location text, images text[], employees int default 0, status text default 'open', created_at)
- `products` (id uuid pk, name text, description text, category_id uuid fk → categories, price numeric(10,2), sku text, stock_quantity int default 0, status text default 'active', image_url text, created_at, updated_at)
- `product_stores` (product_id uuid fk, store_id uuid fk, pk(product_id, store_id))
- `orders` (id uuid pk, product_id uuid fk, store_id uuid fk, quantity int, status text check in confirmed/packed/refunded/shipped, created_at)
- `profiles` (id uuid pk references auth.users on delete cascade, display_name text, avatar_url text, created_at)

Each table: `ENABLE ROW LEVEL SECURITY`, GRANTs to `authenticated` + `service_role` (no anon), and authenticated-only RLS policies (`auth.uid() is not null` for select; owner-style for profiles). Auth is **not** wired in v1 — login screen is cosmetic only — but schema is ready.

## Implementation order

1. Enable Lovable Cloud.
2. Create migration with all tables + RLS + GRANTs.
3. Update `src/styles.css` with tokens + Inter import.
4. Build shared components: `MobileFrame`, `TopAppBar`, `BottomNav`, `SideDrawer`, `StatCard`, `CategoryTile`, `SalesBarChart`, `StoreRow`, `ProductRow`, `CategoryCard`.
5. Create all 10 route files with the screens above, importing from `sample-data.ts`.
6. Verify in mobile preview viewport.

## Technical notes

- shadcn primitives used: `button`, `input`, `textarea`, `select`, `sheet` (drawer), `card`, `badge`, `separator`, `checkbox`, `sonner` (toast), `label`.
- Image placeholders: use `/placeholder.svg` or generate 1 cover-style purple flat illustration for products/stores via imagegen if time allows; otherwise solid lavender blocks with icons.
- Preview will be set to mobile viewport.
- No backend wiring this pass — every data read uses `sample-data.ts` with `// TODO: replace with useSuspenseQuery(...)` comments next to it.