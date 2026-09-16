import { Link } from "@tanstack/react-router";
import { ChevronRight, Package } from "lucide-react";

export type ProductListEntry = {
  id: string;
  /** URL slug ("classic-t-shirt"); falls back to the uuid when absent. */
  slug?: string;
  name: string;
  category: string;
  stock: number;
  stores: number;
  status: "active" | "inactive";
  image?: string;
};

export function ProductListItem({ product }: { product: ProductListEntry }) {
  return (
    <Link
      to="/products/$productId"
      params={{ productId: product.slug || product.id }}
      className="block py-4 hover:bg-muted/40 -mx-2 px-2 rounded-xl transition-colors"
    >
      <div className="flex gap-3">
        <div className="h-20 w-20 rounded-xl bg-accent flex items-center justify-center shrink-0 overflow-hidden">
          {product.image ? (
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <Package className="h-8 w-8 text-primary-deep" />
          )}
        </div>
        <div className="flex-1 min-w-0 text-sm">
          <p className="text-muted-foreground">
            Stock: <span className="text-foreground font-medium">{product.stock} in stock</span>
          </p>
          <p className="text-muted-foreground">
            Category: <span className="text-foreground font-medium">{product.category}</span>
          </p>
          <p className="text-muted-foreground">
            Location: <span className="text-foreground font-medium">{product.stores} stores</span>
          </p>
        </div>
        <div className="flex flex-col items-end justify-between">
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold text-primary-foreground uppercase ${
              product.status === "active" ? "bg-badge-active" : "bg-muted-foreground"
            }`}
          >
            {product.status}
          </span>
          <span className="h-7 w-7 rounded-full border border-border flex items-center justify-center text-muted-foreground">
            <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </div>
      <p className="font-bold mt-2">{product.name}</p>
    </Link>
  );
}
