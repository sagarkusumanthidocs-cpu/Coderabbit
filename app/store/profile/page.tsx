"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { StoreShell } from "@/components/StoreShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { storeProfileSchema } from "@/lib/validation";
import { z } from "zod";

type FormData = z.infer<typeof storeProfileSchema>;

export default function StoreProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(storeProfileSchema),
  });

  useEffect(() => {
    fetch("/api/store/profile")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load profile.");
        return r.json();
      })
      .then((d) => reset({ name: d.store.name, description: d.store.description, address: d.store.address, coverImage: d.store.coverImage, isOpen: d.store.isOpen, openTime: d.store.openTime, closeTime: d.store.closeTime }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [reset]);

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    setSuccess(false);
    setError(null);
    try {
      const res = await fetch("/api/store/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.message ?? "Could not save.");
        return;
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 1800);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <StoreShell>
        <LoadingSkeleton className="h-60 w-full" />
      </StoreShell>
    );
  }

  return (
    <StoreShell>
      <Link href="/store/dashboard" className="mb-3 block text-sm text-rose">← Back</Link>
      <h1 className="mb-4 font-serif text-xl font-semibold text-ink">Store profile</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4 rounded-2xl bg-white p-4 shadow-sm">
        <ImageWithFallback src={watch("coverImage") || ""} alt="Store cover" className="h-[120px] w-full rounded-2xl object-cover" />
        <div>
          <Label htmlFor="name">Store name</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" {...register("description")} />
        </div>
        <div>
          <Label htmlFor="address">Address</Label>
          <Textarea id="address" {...register("address")} />
        </div>
        <div>
          <Label htmlFor="coverImage">Cover image URL</Label>
          <Input id="coverImage" {...register("coverImage")} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="openTime">Opens at</Label>
            <Input id="openTime" type="time" {...register("openTime")} />
          </div>
          <div className="flex-1">
            <Label htmlFor="closeTime">Closes at</Label>
            <Input id="closeTime" type="time" {...register("closeTime")} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted">Shown to customers so they know when they can expect same-day service.</p>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" {...register("isOpen")} /> Store is open for orders
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={submitting} className={success ? "bg-green-600 hover:bg-green-600" : undefined}>
          {submitting ? "Saving..." : success ? "✓ Saved!" : "Save changes"}
        </Button>
      </form>
    </StoreShell>
  );
}
