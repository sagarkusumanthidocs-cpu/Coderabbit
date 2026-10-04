"use client";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";

const MODERATION_COLORS: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  BLOCKED: "bg-red-100 text-red-800",
};

export default function AdminStoresPage() {
  const [stores, setStores] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/stores")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load stores.");
        return r.json();
      })
      .then((d) => { setStores(d.stores); setError(null); })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function setModeration(id: string, status: string) {
    await fetch(`/api/admin/stores/${id}/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  if (error) {
    return (
      <AdminShell>
        <ErrorState message={error} onRetry={load} />
      </AdminShell>
    );
  }

  if (!stores) {
    return (
      <AdminShell>
        <LoadingSkeleton className="h-40 w-full" />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1 className="mb-4 font-serif text-xl font-semibold text-ink">Stores</h1>
      <div className="grid gap-3">
        {stores.map((s) => (
          <Card key={s.id}>
            <CardContent>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-ink">{s.name}</p>
                  <p className="text-xs text-muted">
                    {s.city.name} · {s.category.name}
                  </p>
                  <p className="text-xs text-muted">Owner: {s.owner.name}</p>
                </div>
                <Badge className={MODERATION_COLORS[s.moderationStatus]}>{s.moderationStatus}</Badge>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => (window.location.href = `/admin/stores/${s.id}`)}>
                  View store profile →
                </Button>
                {s.moderationStatus !== "APPROVED" && (
                  <Button size="sm" onClick={() => setModeration(s.id, "APPROVED")}>
                    Approve
                  </Button>
                )}
                {s.moderationStatus !== "BLOCKED" && (
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="destructive">
                        Block
                      </Button>
                    }
                    title={`Block ${s.name}?`}
                    description="Blocking prevents new orders and hides this store from customers. Existing orders remain fulfillable."
                    confirmLabel="Block"
                    destructive
                    onConfirm={() => setModeration(s.id, "BLOCKED")}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
