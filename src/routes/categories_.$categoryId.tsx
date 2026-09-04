import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, Search, Loader2, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/met/AppShell";
import { CategoryIcon } from "@/components/met/CategoryIcon";
import { ProductListItem } from "@/components/met/ProductListItem";
import { useCategory, useProducts, useDeleteCategory } from "@/lib/db-service";
import { useRole } from "@/lib/auth-store";
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

export const Route = createFileRoute("/categories_/$categoryId")({
  head: () => ({ meta: [{ title: "Category — MET" }] }),
  component: CategoryProductsPage,
});

function CategoryProductsPage() {
  const { categoryId } = Route.useParams();
  const navigate = useNavigate();
  const role = useRole();
  const isAdmin = role !== "viewer";
  const { data: category, isLoading: catLoading } = useCategory(categoryId);
  const { data: productsList, isLoading: prodsLoading } = useProducts();
  const deleteCategory = useDeleteCategory();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const isLoading = catLoading || prodsLoading;

  function handleDelete() {
    if (!category) return;
    deleteCategory.mutate(
      { id: category.id, name: category.name },
      {
        onSuccess: () => {
          toast.success("Category deleted.");
          navigate({ to: "/categories" });
        },
        onError: () => toast.error("Failed to delete category."),
      }
    );
  }

  const categoryProducts = useMemo(() => {
    if (!productsList) return [];
    const q = query.trim().toLowerCase();
    // Products store category_id (a uuid), but the URL param may be a slug —
    // match against the resolved category's real id, not the route param.
    const realCategoryId = category?.id ?? categoryId;
    return productsList.filter(
      (p) => p.categoryId === realCategoryId && (!q || p.name.toLowerCase().includes(q))
    );
  }, [productsList, category?.id, categoryId, query]);

  return (
    <AppShell title="Categories">
      <div className="px-5 pt-4 space-y-4 pb-6">
        <Link to="/categories" className="inline-flex items-center text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>

        {isLoading ? (
          <div className="flex justify-center py-12 text-primary">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !category ? (
          <p className="text-center py-10 text-sm text-muted-foreground">Category not found.</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-xl bg-accent flex items-center justify-center shrink-0">
                <CategoryIcon name={category.icon || "Shirt"} className="h-7 w-7 text-primary-deep" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-extrabold">{category.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {category.description || "No description"} · {categoryProducts.length} product
                  {categoryProducts.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                onClick={() => {
                  setSearchOpen((v) => !v);
                  if (searchOpen) setQuery("");
                }}
                className={`h-10 w-10 rounded-full border flex items-center justify-center shrink-0 ${
                  searchOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-primary"
                }`}
                aria-label="Search in category"
              >
                {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              </button>
            </div>

            {searchOpen && (
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search in ${category.name}...`}
                className="w-full h-11 px-4 rounded-xl bg-muted border border-transparent focus:border-primary focus:bg-card outline-none text-sm"
              />
            )}

            {isAdmin && (
              <div className="flex gap-3">
                <Link
                  to="/add"
                  search={{ type: "category", id: category.id }}
                  className="flex-1 h-11 rounded-full bg-primary text-primary-foreground font-bold inline-flex items-center justify-center gap-2 text-sm"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </Link>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      disabled={deleteCategory.isPending}
                      className="flex-1 h-11 rounded-full border border-destructive text-destructive font-bold inline-flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleteCategory.isPending ? "Deleting..." : "Delete"}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this category?</AlertDialogTitle>
                      <AlertDialogDescription>
                        "{category.name}" will be permanently removed. Its {categoryProducts.length}{" "}
                        product{categoryProducts.length === 1 ? "" : "s"} will not be deleted — they
                        become uncategorised. This action cannot be undone.
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

            <div className="divide-y divide-border/60">
              {categoryProducts.length > 0 ? (
                categoryProducts.map((p) => <ProductListItem key={p.id} product={p} />)
              ) : (
                <p className="text-center py-10 text-sm text-muted-foreground">
                  {query
                    ? "No products match your search."
                    : "No products in this category yet."}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
