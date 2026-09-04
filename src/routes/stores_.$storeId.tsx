import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Store as StoreIcon, ChevronLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/met/AppShell";
import { useStoreDetail, useDeleteStore } from "@/lib/db-service";
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

export const Route = createFileRoute("/stores_/$storeId")({
  head: () => ({ meta: [{ title: "Store — MET" }] }),
  component: StoreDetailPage,
});

function StoreDetailPage() {
  const { storeId } = Route.useParams();
  const navigate = useNavigate();
  const role = useRole();
  const isAdmin = role !== "viewer";
  const { data: store, isLoading } = useStoreDetail(storeId);
  const deleteStore = useDeleteStore();

  function handleDelete() {
    if (!store) return;
    deleteStore.mutate(
      { id: store.id, name: store.location || store.name },
      {
        onSuccess: () => {
          toast.success("Store deleted.");
          navigate({ to: "/stores" });
        },
        onError: () => toast.error("Failed to delete store."),
      }
    );
  }

  return (
    <AppShell title="Stores">
      <div className="px-5 pt-4 pb-6">
        <Link to="/stores" className="inline-flex items-center text-sm text-muted-foreground mb-3">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>

        {isLoading ? (
          <div className="flex justify-center py-12 text-primary">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !store ? (
          <p className="text-center py-10 text-sm text-muted-foreground">Store not found.</p>
        ) : (
          <div className="space-y-4">
          <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50 space-y-5">
            <h2 className="text-2xl font-extrabold">{store.location || store.name}</h2>

            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="aspect-[4/3] rounded-xl bg-accent flex items-center justify-center">
                  <StoreIcon className="h-7 w-7 text-primary-deep" />
                </div>
              ))}
            </div>

            <dl className="space-y-2 text-sm">
              <Row label="Employees" value={store.employees} />
              <Row label="Items" value={store.items} />
              <Row label="Orders" value={store.orders} />
              <Row label="Refunds" value={store.refunds} />
            </dl>

            <hr className="border-border/60" />

            <dl className="space-y-2 text-sm">
              <Row label="Most sold items" value={store.mostSold} />
              <Row label="Most popular category" value={store.topCategory} />
              <Row label="Customer satisfaction" value={`${store.satisfaction}%`} />
              <Row label="Status" value={store.status === "open" ? "Open" : "Closed"} highlight />
            </dl>
          </div>

          {isAdmin && (
            <div className="flex gap-3">
              <Link
                to="/add"
                search={{ type: "store", id: store.id }}
                className="flex-1 h-12 rounded-full bg-primary text-primary-foreground font-bold inline-flex items-center justify-center gap-2"
              >
                <Pencil className="h-4 w-4" /> Edit
              </Link>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={deleteStore.isPending}
                    className="flex-1 h-12 rounded-full border border-destructive text-destructive font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleteStore.isPending ? "Deleting..." : "Delete"}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this store?</AlertDialogTitle>
                    <AlertDialogDescription>
                      "{store.location || store.name}" will be permanently removed. Products stocked
                      here will not be deleted — they are simply unlinked from this store. This
                      action cannot be undone.
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

function Row({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="font-bold">{label}:</dt>
      <dd className={highlight ? "text-primary font-semibold" : "text-foreground"}>{value}</dd>
    </div>
  );
}
