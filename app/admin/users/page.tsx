"use client";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { HelpCircle } from "lucide-react";

export default function AdminUsersReportsPage() {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState<any[] | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [reports, setReports] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load users.");
        return r.json();
      })
      .then((d) => { setUsers(d.users); setError(null); })
      .catch((e) => setError(e.message));
    fetch("/api/admin/reports")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load reports.");
        return r.json();
      })
      .then((data) => { setReports(data); setReportError(null); })
      .catch((e) => setReportError(e.message));
  }, [reloadKey]);

  return (
    <AdminShell>
      <h1 className="mb-4 font-serif text-xl font-semibold text-ink">Users, reports &amp; support</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4">
        {tab === "users" && (
          <>
            {error && <ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} />}
            {!users && !error && <LoadingSkeleton className="h-40 w-full" />}
            {users && (
              <div className="space-y-2">
                {users.map((u) => (
                  <Card key={u.id}>
                    <CardContent className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-ink">{u.name}</p>
                        <p className="text-sm text-muted">{u.email}</p>
                        {u.stores.length > 0 && <p className="text-xs text-muted">Store: {u.stores.map((s: any) => s.name).join(", ")}</p>}
                      </div>
                      <Badge className="bg-blush text-ink">{u.role}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "reports" && (
          <>
            {reportError && <ErrorState message={reportError} onRetry={() => setReloadKey((key) => key + 1)} />}
            {!reports && !reportError && <LoadingSkeleton className="h-40 w-full" />}
            {reports && (
              <div className="grid gap-4">
                <Card>
                  <CardContent>
                    <h3 className="mb-2 text-sm font-semibold text-ink">Orders by city</h3>
                    {reports.byCity.map((c: any) => (
                      <div key={c.city} className="flex justify-between text-sm text-muted">
                        <span>{c.city}</span>
                        <span>{c.count}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <h3 className="mb-2 text-sm font-semibold text-ink">Orders by store</h3>
                    {reports.byStore.map((s: any) => (
                      <div key={s.store} className="flex justify-between text-sm text-muted">
                        <span>{s.store}</span>
                        <span>{s.count}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <h3 className="mb-2 text-sm font-semibold text-ink">Orders by status</h3>
                    {reports.byStatus.map((s: any) => (
                      <div key={s.status} className="flex justify-between text-sm text-muted">
                        <span>{s.status}</span>
                        <span>{s.count}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <h3 className="mb-2 text-sm font-semibold text-ink">Popular products</h3>
                    {reports.popularProducts.map((p: any) => (
                      <div key={p.name} className="flex justify-between text-sm text-muted">
                        <span>{p.name}</span>
                        <span>{p.quantity} sold</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        {tab === "support" && (
          <Card>
            <CardContent className="flex items-start gap-3">
              <HelpCircle className="mt-0.5 h-5 w-5 text-rose" />
              <div className="text-sm text-muted">
                <p className="font-medium text-ink">Demo support information</p>
                <p className="mt-1">This is a demo application. In production, this panel would connect to a live support/ticketing system.</p>
                <p className="mt-1">Contact: support@giftapp.demo (not monitored)</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
