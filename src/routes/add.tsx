import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/met/AppShell";
import { useRole } from "@/lib/auth-store";
import { CURRENCY_SYMBOL } from "@/lib/currency";
import {
  useCategories,
  useStores,
  useProduct,
  useCategory,
  useStoreDetail,
  useAddCategory,
  useAddProduct,
  useUpdateProduct,
  useAddStore,
  useUpdateCategory,
  useUpdateStore,
} from "@/lib/db-service";

type AddType = "product" | "category" | "store";

const searchSchema = z.object({
  type: z.enum(["product", "category", "store"]).catch("product"),
  id: z.string().optional(),
});

export const Route = createFileRoute("/add")({
  head: () => ({ meta: [{ title: "Add — MET" }] }),
  validateSearch: searchSchema,
  component: AddPage,
});

function AddPage() {
  const { type, id } = Route.useSearch();
  const navigate = useNavigate();
  const role = useRole();
  const isEditing = !!id;

  if (role === "viewer") {
    return (
      <AppShell title="Add">
        <div className="p-6 text-center text-muted-foreground">
          Viewers can't add items. Log in as admin to manage inventory.
        </div>
      </AppShell>
    );
  }

  const noun = type === "category" ? "category" : type === "store" ? "store" : "product";
  const title = `${isEditing ? "Edit" : "Add"} ${noun}`;

  return (
    <AppShell title={title}>
      <div className="px-5 pt-4 pb-6">
        {!isEditing && (
          <Tabs type={type} onChange={(t) => navigate({ to: "/add", search: { type: t } })} />
        )}
        {type === "product" && <ProductForm editId={id} />}
        {type === "category" && <CategoryForm editId={id} />}
        {type === "store" && <StoreForm editId={id} />}
      </div>
    </AppShell>
  );
}

function Tabs({ type, onChange }: { type: AddType; onChange: (t: AddType) => void }) {
  const tabs: { id: AddType; label: string }[] = [
    { id: "product", label: "Product" },
    { id: "category", label: "Category" },
    { id: "store", label: "Store" },
  ];
  return (
    <div className="bg-muted rounded-full p-1 grid grid-cols-3 mb-5 text-xs font-semibold">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`h-9 rounded-full transition ${
            type === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold mb-1.5 block">
        {label}{required && <span className="text-primary">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls = "w-full h-11 px-4 rounded-xl bg-muted border border-transparent focus:border-primary focus:bg-card outline-none text-sm disabled:opacity-50";
const textareaCls = "w-full px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary focus:bg-card outline-none text-sm min-h-[100px] disabled:opacity-50";
const saveBtn = "w-full h-12 rounded-full bg-primary text-primary-foreground font-bold mt-2 disabled:opacity-50";

// No object-storage bucket exists yet, so the picked file is inlined as a data
// URL and stored directly in the image_url text column.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function useImagePicker(initial?: string | null) {
  const [imageUrl, setImageUrl] = useState<string | null>(initial ?? null);

  async function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image is too large (max 2MB).");
      e.target.value = "";
      return;
    }
    try {
      setImageUrl(await fileToDataUrl(file));
    } catch {
      toast.error("Couldn't read that image file.");
    }
  }

  return { imageUrl, setImageUrl, onImageChange };
}

function ImageField({
  imageUrl,
  onImageChange,
  isLoading,
}: {
  imageUrl: string | null;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
}) {
  return (
    <Field label="Image">
      <div className="space-y-2">
        {imageUrl && (
          <img src={imageUrl} alt="Preview" className="h-24 w-24 rounded-xl object-cover border border-border/50" />
        )}
        <input
          type="file"
          disabled={isLoading}
          accept="image/*"
          onChange={onImageChange}
          className={inputCls + " py-2.5"}
        />
      </div>
    </Field>
  );
}

const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().max(2000).optional(),
  category: z.string().min(1, "Category is required"),
  purchasePrice: z.coerce.number().min(0),
  salePrice: z.coerce.number().min(0),
  stockQuantity: z.coerce.number().int().min(0),
  storeIds: z.array(z.string()).optional(),
  sku: z.string().max(64).optional(),
});

function ProductForm({ editId }: { editId?: string }) {
  const isEdit = !!editId;
  const navigate = useNavigate();
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const { data: dbCategories, isLoading: catsLoading } = useCategories();
  const { data: dbStores, isLoading: storesLoading } = useStores();
  const { data: editProduct, isLoading: editLoading } = useProduct(editId ?? "__none__");
  const addProductMutation = useAddProduct();
  const updateProductMutation = useUpdateProduct();
  const { imageUrl, setImageUrl, onImageChange } = useImagePicker();

  // Pre-fill the store checkboxes and existing image once the product loads in edit mode
  useEffect(() => {
    if (isEdit && editProduct?.storeIds) {
      setStoreIds(editProduct.storeIds);
    }
    if (isEdit && editProduct) {
      setImageUrl(editProduct.image || null);
    }
  }, [isEdit, editProduct]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const parsed = productSchema.safeParse({
      name: fd.get("name"),
      description: fd.get("description"),
      category: fd.get("category"),
      purchasePrice: fd.get("purchasePrice"),
      salePrice: fd.get("salePrice"),
      stockQuantity: fd.get("stockQuantity"),
      storeIds,
      sku: fd.get("sku"),
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }

    const categoryName = parsed.data.category;
    const selectedCat = dbCategories?.find((c) => c.name === categoryName);
    const categoryId = selectedCat ? selectedCat.id : null;

    const payload = {
      name: parsed.data.name,
      description: parsed.data.description || undefined,
      category_id: categoryId,
      purchase_price: parsed.data.purchasePrice,
      sale_price: parsed.data.salePrice,
      stock_quantity: parsed.data.stockQuantity,
      sku: parsed.data.sku || undefined,
      storeIds: parsed.data.storeIds,
      image_url: imageUrl || undefined,
    };

    if (isEdit && editId) {
      updateProductMutation.mutate(
        { id: editId, ...payload },
        {
          onSuccess: () => {
            toast.success("Product updated successfully!");
            navigate({ to: "/products/$productId", params: { productId: editId } });
          },
          onError: (err: any) => toast.error(err.message || "Failed to update product."),
        }
      );
    } else {
      addProductMutation.mutate(payload, {
        onSuccess: () => {
          toast.success("Product saved successfully!");
          form.reset();
          setStoreIds([]);
          setImageUrl(null);
        },
        onError: (err: any) => toast.error(err.message || "Failed to save product."),
      });
    }
  }

  const saving = addProductMutation.isPending || updateProductMutation.isPending;
  const isLoading = catsLoading || storesLoading || saving;

  // Wait for the product to load before rendering the prefilled form
  if (isEdit && editLoading) {
    return (
      <div className="flex justify-center py-12 text-primary">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (isEdit && !editProduct) {
    return <p className="text-center py-10 text-sm text-muted-foreground">Product not found.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Product name" required>
        <input name="name" defaultValue={editProduct?.name ?? ""} disabled={isLoading} className={inputCls} />
      </Field>
      <Field label="Description">
        <textarea name="description" defaultValue={editProduct?.description ?? ""} disabled={isLoading} className={textareaCls} />
      </Field>
      <Field label="Category" required>
        <select name="category" disabled={isLoading} className={inputCls} defaultValue={editProduct?.category ?? ""}>
          <option value="" disabled>Select a category</option>
          {dbCategories?.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Purchase price (${CURRENCY_SYMBOL})`} required>
          <input name="purchasePrice" defaultValue={editProduct?.purchasePrice ?? ""} disabled={isLoading} type="number" step="0.01" min="0" className={inputCls} />
        </Field>
        <Field label={`Sale price (${CURRENCY_SYMBOL})`} required>
          <input name="salePrice" defaultValue={editProduct?.salePrice ?? ""} disabled={isLoading} type="number" step="0.01" min="0" className={inputCls} />
        </Field>
      </div>
      <Field label="Stock quantity">
        <input name="stockQuantity" defaultValue={editProduct?.stock ?? 0} disabled={isLoading} type="number" min="0" className={inputCls} />
      </Field>
      <Field label="Store locations">
        <div className="space-y-2 bg-muted rounded-xl p-3 max-h-[160px] overflow-y-auto">
          {dbStores?.map((s) => {
            const checked = storeIds.includes(s.id);
            return (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isLoading}
                  onChange={() =>
                    setStoreIds((prev) =>
                      prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                    )
                  }
                  className="accent-[color:var(--primary)] h-4 w-4"
                />
                {s.location || s.name}
              </label>
            );
          })}
        </div>
      </Field>
      <ImageField imageUrl={imageUrl} onImageChange={onImageChange} isLoading={isLoading} />
      <Field label="SKU (optional)">
        <input name="sku" defaultValue={editProduct?.sku ?? ""} disabled={isLoading} className={inputCls} />
      </Field>
      <button type="submit" disabled={isLoading} className={saveBtn}>
        {saving ? (isEdit ? "Updating..." : "Saving product...") : isEdit ? "Update product" : "Save product"}
      </button>
    </form>
  );
}

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().max(2000).optional(),
});

function CategoryForm({ editId }: { editId?: string }) {
  const navigate = useNavigate();
  const isEditing = !!editId;
  const addCategoryMutation = useAddCategory();
  const updateCategoryMutation = useUpdateCategory();
  const { data: editCategory, isLoading: loadingCategory } = useCategory(editId ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const parsed = categorySchema.safeParse({ name: fd.get("name"), description: fd.get("description") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }

    const values = {
      name: parsed.data.name,
      description: parsed.data.description || undefined,
    };

    if (isEditing && editId) {
      updateCategoryMutation.mutate(
        { id: editId, ...values },
        {
          onSuccess: () => {
            toast.success("Category updated successfully!");
            navigate({ to: "/categories/$categoryId", params: { categoryId: editId } });
          },
          onError: (err: any) => toast.error(err.message || "Failed to update category."),
        }
      );
      return;
    }

    addCategoryMutation.mutate(values, {
      onSuccess: () => {
        toast.success("Category saved successfully to database!");
        form.reset();
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to save category.");
      }
    });
  }

  const isLoading =
    addCategoryMutation.isPending || updateCategoryMutation.isPending || (isEditing && loadingCategory);

  if (isEditing && loadingCategory) {
    return (
      <div className="flex justify-center py-12 text-primary">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isEditing && !editCategory) {
    return <p className="text-center py-10 text-sm text-muted-foreground">Category not found.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Category name" required>
        <input name="name" defaultValue={editCategory?.name ?? ""} disabled={isLoading} className={inputCls} />
      </Field>
      <Field label="Description">
        <textarea
          name="description"
          defaultValue={editCategory?.description ?? ""}
          disabled={isLoading}
          className={textareaCls}
        />
      </Field>
      <Field label="Image"><input type="file" disabled={isLoading} accept="image/*" className={inputCls + " py-2.5"} /></Field>
      <button type="submit" disabled={isLoading} className={saveBtn}>
        {isEditing
          ? updateCategoryMutation.isPending
            ? "Updating category..."
            : "Update category"
          : addCategoryMutation.isPending
            ? "Saving category..."
            : "Save category"}
      </button>
    </form>
  );
}

const storeSchema = z.object({
  name: z.string().trim().min(1, "Store name is required").max(120),
  location: z.string().trim().min(1, "Location is required").max(200),
  initial: z.coerce.number().int().min(0),
  status: z.enum(["open", "closed"]),
});

function StoreForm({ editId }: { editId?: string }) {
  const navigate = useNavigate();
  const isEditing = !!editId;
  const addStoreMutation = useAddStore();
  const updateStoreMutation = useUpdateStore();
  const { data: editStore, isLoading: loadingStore } = useStoreDetail(editId ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const parsed = storeSchema.safeParse({
      name: fd.get("name"),
      location: fd.get("location"),
      initial: fd.get("initial"),
      status: fd.get("status"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }

    const values = {
      name: parsed.data.name,
      location: parsed.data.location,
      initial_items_count: parsed.data.initial,
      status: parsed.data.status,
    };

    if (isEditing && editId) {
      updateStoreMutation.mutate(
        { id: editId, ...values },
        {
          onSuccess: () => {
            toast.success("Store updated successfully!");
            navigate({ to: "/stores/$storeId", params: { storeId: editId } });
          },
          onError: (err: any) => toast.error(err.message || "Failed to update store."),
        }
      );
      return;
    }

    addStoreMutation.mutate(values, {
      onSuccess: () => {
        toast.success("Store saved successfully to database!");
        form.reset();
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to save store.");
      }
    });
  }

  const isLoading =
    addStoreMutation.isPending || updateStoreMutation.isPending || (isEditing && loadingStore);

  if (isEditing && loadingStore) {
    return (
      <div className="flex justify-center py-12 text-primary">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isEditing && !editStore) {
    return <p className="text-center py-10 text-sm text-muted-foreground">Store not found.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Store name">
        <input name="name" defaultValue={editStore?.name ?? ""} disabled={isLoading} className={inputCls} />
      </Field>
      <Field label="Location" required>
        <input name="location" defaultValue={editStore?.location ?? ""} disabled={isLoading} className={inputCls} />
      </Field>
      <Field label="Initial items count" required>
        <input
          name="initial"
          disabled={isLoading}
          type="number"
          min="0"
          defaultValue={editStore?.items ?? 0}
          className={inputCls}
        />
      </Field>
      <Field label="Store status">
        <select
          name="status"
          disabled={isLoading}
          className={inputCls}
          defaultValue={editStore?.status ?? "open"}
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </Field>
      <Field label="Image"><input type="file" disabled={isLoading} accept="image/*" className={inputCls + " py-2.5"} /></Field>
      <button type="submit" disabled={isLoading} className={saveBtn}>
        {isEditing
          ? updateStoreMutation.isPending
            ? "Updating store..."
            : "Update store"
          : addStoreMutation.isPending
            ? "Saving store..."
            : "Save store"}
      </button>
    </form>
  );
}
