import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Package, Loader2, Store as StoreIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/met/AppShell";
import { useProduct, useDeleteProduct } from "@/lib/db-service";
import { useRole } from "@/lib/auth-store";
import { formatPKR as money } from "@/lib/currency";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/products_/$productId")({
  head: () => ({ meta: [{ title: "Product — MET" }] }),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { productId } = Route.useParams();
  const navigate = useNavigate();
  const role = useRole();
  const isAdmin = role !== "viewer";
  const { data: product, isLoading } = useProduct(productId);
  const deleteProduct = useDeleteProduct();

  function handleDelete() {
    if (!product) return;
    deleteProduct.mutate(
      { id: product.id, name: product.name },
      {
        onSuccess: () => {
          toast.success("Product deleted.");
          navigate({ to: "/products" });
        },
        onError: () => toast.error("Failed to delete product."),
      }
    );
  }

  return (
    <AppShell title="Products">
      <div className="px-5 pt-4 pb-6">
        <Link to="/products" className="inline-flex items-center text-sm text-muted-foreground mb-3">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>

        {isLoading ? (
          <div className="flex justify-center py-12 text-primary">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !product ? (
          <p className="text-center py-10 text-sm text-muted-foreground">Product not found.</p>
        ) : (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-2xl font-extrabold leading-tight">{product.name}</h2>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold text-primary-foreground uppercase shrink-0 ${
                    product.status === "active" ? "bg-badge-active" : "bg-muted-foreground"
                  }`}
                >
                  {product.status}
                </span>
              </div>

              <div className="aspect-[4/3] rounded-xl bg-accent flex items-center justify-center">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover rounded-xl"
                  />
                ) : (
                  <Package className="h-12 w-12 text-primary-deep" />
                )}
              </div>

              {product.description && (
                <p className="text-sm text-muted-foreground">{product.description}</p>
              )}

              <dl className="space-y-2 text-sm">
                <Row label="Category" value={product.category} />
                <Row label="Stock" value={`${product.stock} in stock`} highlight={product.stock < 5} />
                <Row label="Purchase price" value={money(product.purchasePrice)} />
                <Row label="Sale price" value={money(product.salePrice)} />
                <Row label="Profit / unit" value={money(product.salePrice - product.purchasePrice)} />
                <Row
                  label="Margin"
                  value={
                    product.salePrice > 0
                      ? `${(((product.salePrice - product.purchasePrice) / product.salePrice) * 100).toFixed(1)}%`
                      : "—"
                  }
                />
                {product.sku && <Row label="SKU" value={product.sku} />}
              </dl>

              <hr className="border-border/60" />

              <div>
                <p className="font-bold text-sm mb-2">Available in stores</p>
                {product.stores.length > 0 ? (
                  <ul className="space-y-2">
                    {product.stores.map((s: { id: string; name: string }) => (
                      <li key={s.id}>
                        <Link
                          to="/stores/$storeId"
                          params={{ storeId: s.id }}
                          className="flex items-center gap-2 text-sm bg-muted rounded-xl px-3 py-2.5 font-medium"
                        >
                          <StoreIcon className="h-4 w-4 text-primary" /> {s.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Not linked to any store yet.</p>
                )}
              </div>
            </div>

            {/* Admin actions */}
            {isAdmin && (
              <div className="flex gap-3">
                <Link
                  to="/add"
                  search={{ type: "product", id: product.id }}
                  className="flex-1 h-12 rounded-full bg-primary text-primary-foreground font-bold inline-flex items-center justify-center gap-2"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </Link>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      disabled={deleteProduct.isPending}
                      className="flex-1 h-12 rounded-full border border-destructive text-destructive font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleteProduct.isPending ? "Deleting..." : "Delete"}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this product?</AlertDialogTitle>
                      <AlertDialogDescription>
                        "{product.name}" will be permanently removed from the inventory. This action
                        cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="font-bold">{label}:</dt>
      <dd className={highlight ? "text-destructive font-semibold" : "text-foreground"}>{value}</dd>
    </div>
  );
}
