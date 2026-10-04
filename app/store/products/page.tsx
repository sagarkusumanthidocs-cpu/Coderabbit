"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { FilterTabs } from "@/components/FilterTabs";
import { StoreShell } from "@/components/StoreShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { productFormSchema } from "@/lib/validation";
import { formatINR, cn } from "@/lib/utils";
import { z } from "zod";
import { Plus, Pencil, Archive } from "lucide-react";

type ProductFormData = z.infer<typeof productFormSchema>;

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative h-[22px] w-10 flex-shrink-0 rounded-full transition disabled:opacity-50", checked ? "bg-[#1D9E75]" : "bg-gray-300")}
    >
      <span className={cn("absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all", checked ? "left-[21px]" : "left-[3px]")} />
    </button>
  );
}

export default function StoreProductsPage() {
  const [tab, setTab] = useState("items");
  const [products, setProducts] = useState<any[] | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({ resolver: zodResolver(productFormSchema) });

  function load() {
    fetch("/api/store/products")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load products.");
        return r.json();
      })
      .then((d) => { setProducts(d.products); setError(null); })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories ?? []));
  }, []);

  function openAdd() {
    setEditing(null);
    setFormError(null);
    reset({ name: "", description: "", categoryId: categories[0]?.id ?? "", price: 0, imageUrl: "", isFeatured: false, isAvailable: true });
    setDialogOpen(true);
  }

  function openEdit(p: any) {
    setEditing(p);
    setFormError(null);
    reset({
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      price: Number(p.price),
      imageUrl: p.imageUrl,
      isFeatured: p.isFeatured,
      isAvailable: p.isAvailable,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: ProductFormData) {
    setSubmitting(true);
    setFormError(null);
    try {
      const url = editing ? `/api/store/products/${editing.id}` : "/api/store/products";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) {
        setFormError(result.message ?? "Could not save product.");
        setSubmitting(false);
        return;
      }
      setDialogOpen(false);
      load();
    } catch {
      setFormError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function setAvailability(id: string, isAvailable: boolean) {
    setProducts((prev) => prev?.map((p) => (p.id === id ? { ...p, isAvailable } : p)) ?? prev);
    const res = await fetch(`/api/store/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable }),
    });
    if (!res.ok) load();
  }

  async function setAllAvailability(isAvailable: boolean) {
    setBulkSaving(true);
    await fetch("/api/store/products/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable }),
    });
    setBulkSaving(false);
    load();
  }

  const activeProducts = products?.filter((p) => !p.isArchived) ?? [];
  const inStockCount = activeProducts.filter((p) => p.isAvailable).length;
  const allInStock = activeProducts.length > 0 && inStockCount === activeProducts.length;

  async function archive(id: string) {
    await fetch(`/api/store/products/${id}/archive`, { method: "POST" });
    load();
  }

  return (
    <StoreShell>
      <Link href="/store/dashboard" className="mb-3 block text-sm text-rose">← Back</Link>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-serif text-xl font-semibold text-ink">Products</h1>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add product
        </Button>
      </div>

      <FilterTabs label="Menu sections" value={tab} onChange={setTab} options={[{ value: "items", label: "All items" }, { value: "addons", label: "Add-ons" }]} />
      {tab === "addons" ? <EmptyState title="Add-ons coming soon" description="Gift wrap and add-on items are not part of this MVP yet." /> : <>
      {error && <ErrorState message={error} onRetry={load} />}
      {!products && !error && (
        <div className="space-y-3">
          <LoadingSkeleton className="h-20 w-full" />
        </div>
      )}
      {products && products.length === 0 && (
        <EmptyState title="No products yet" description="Add your first product to start selling." actionLabel="Add product" onAction={openAdd} />
      )}
      {products && activeProducts.length > 0 && (
        <Card className="mb-3">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">
                All items <span className="font-normal text-muted">({activeProducts.length})</span>
              </p>
              <p className="text-xs text-muted">
                {inStockCount} of {activeProducts.length} items in stock
              </p>
            </div>
            <Toggle checked={allInStock} disabled={bulkSaving} onChange={setAllAvailability} label="Mark all items in stock" />
          </CardContent>
        </Card>
      )}
      {products && products.length > 0 && (
        <div className="grid gap-3">
          {products.map((p) => (
            <Card key={p.id} className={cn(p.isArchived && "opacity-50")}>
              <div className="flex gap-3 p-3">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-blush">
                  <ImageWithFallback src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">{p.name}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted">{p.description}</p>
                  <p className="text-sm text-rose">{formatINR(p.price)}</p>
                  <div className="mt-1 flex gap-1">
                    {p.isFeatured && <Badge className="bg-rose text-white">Featured</Badge>}
                    {p.isArchived ? (
                      <Badge className="bg-gray-200 text-gray-600">Archived</Badge>
                    ) : p.isAvailable ? (
                      <Badge className="bg-green-100 text-green-800">Available</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800">Unavailable</Badge>
                    )}
                  </div>
                </div>
                {!p.isArchived && (
                  <Toggle checked={p.isAvailable} onChange={(v) => setAvailability(p.id, v)} label={`${p.name} in stock`} />
                )}
              </div>
              <CardContent className="flex gap-2 border-t border-ink/5 pt-3">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(p)} disabled={p.isArchived}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                {!p.isArchived && (
                  <ConfirmDialog
                    trigger={
                      <Button variant="destructive" size="sm" className="flex-1">
                        <Archive className="h-3.5 w-3.5" /> Archive
                      </Button>
                    }
                    title={`Archive ${p.name}?`}
                    description="Archived products are hidden from customers but remain visible on past orders."
                    confirmLabel="Archive"
                    destructive
                    onConfirm={() => archive(p.id)}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      </>}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        {dialogOpen && (
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogTitle className="text-lg font-semibold text-ink">{editing ? "Edit product" : "Add product"}</DialogTitle>
            <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
              <div>
                <Label htmlFor="p-name">Name</Label>
                <Input id="p-name" {...register("name")} />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="p-description">Description</Label>
                <Textarea id="p-description" {...register("description")} />
                {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
              </div>
              <div>
                <Label htmlFor="p-category">Category</Label>
                <Select id="p-category" {...register("categoryId")}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="p-price">Price (INR)</Label>
                <Input id="p-price" type="number" step="0.01" {...register("price", { valueAsNumber: true })} />
                {errors.price && <p className="mt-1 text-xs text-red-600">{errors.price.message}</p>}
              </div>
              <div>
                <Label htmlFor="p-image">Image URL</Label>
                <Input id="p-image" {...register("imageUrl")} placeholder="https://..." />
                {errors.imageUrl && <p className="mt-1 text-xs text-red-600">{errors.imageUrl.message}</p>}
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" {...register("isFeatured")} /> Featured
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" {...register("isAvailable")} /> Available
                </label>
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Saving..." : editing ? "Save changes" : "Add product"}
              </Button>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </StoreShell>
  );
}
