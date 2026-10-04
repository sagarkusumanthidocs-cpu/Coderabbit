"use client";
import Link from "next/link";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { useEffect, useState } from "react";
import { CustomerShell } from "@/components/CustomerShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

const OCCASION_TYPES = ["BIRTHDAY", "ANNIVERSARY", "WEDDING", "FESTIVAL", "OTHER"] as const;

type Reminder = {
  id: string;
  occasionName: string;
  recipientName: string;
  occasionType: string;
  date: string;
  repeatYearly: boolean;
  remindMe: string;
  giftCategory: string | null;
  note: string | null;
};

const emptyForm = {
  occasionName: "",
  recipientName: "",
  occasionType: "BIRTHDAY" as (typeof OCCASION_TYPES)[number],
  date: "",
  repeatYearly: true,
  remindMe: "1 week before",
  giftCategory: "Flowers",
  note: "",
};

function daysUntil(reminder: Reminder) {
  const date = new Date(reminder.date);
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  if (reminder.repeatYearly) { date.setUTCFullYear(today.getUTCFullYear()); if (date < today) date.setUTCFullYear(date.getUTCFullYear() + 1); }
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}

export default function RemindersPage() {
  const [selected, setSelected] = useState<Reminder | null>(null);
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setError(null);
    fetch("/api/reminders")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load reminders.");
        return r.json();
      })
      .then((d) => setReminders(d.reminders))
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFieldErrors({});
    setSaveError(null);
    setShowForm(true);
  }
  function openEdit(r: Reminder) {
    setEditingId(r.id);
    setForm({
      occasionName: r.occasionName,
      recipientName: r.recipientName,
      occasionType: r.occasionType as any,
      date: r.date.slice(0, 10),
      repeatYearly: r.repeatYearly,
      remindMe: r.remindMe,
      giftCategory: r.giftCategory ?? "",
      note: r.note ?? "",
    });
    setFieldErrors({});
    setSaveError(null);
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    setFieldErrors({});
    setSaveError(null);
    const url = editingId ? `/api/reminders/${editingId}` : "/api/reminders";
    const method = editingId ? "PATCH" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) {
        setFieldErrors(data.details ?? {});
        setSaveError(data.message ?? "Could not save the reminder.");
        setSaving(false);
        return;
      }
      setShowForm(false);
      window.dispatchEvent(new Event("giftly-reminders-updated"));
      load();
    } catch {
      setSaveError("Could not save the reminder. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this reminder? This can't be undone.")) return;
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).message ?? "Could not delete this reminder.");
      setSelected(null);
      window.dispatchEvent(new Event("giftly-reminders-updated"));
      load();
    } catch (e: any) { setError(e.message ?? "Please try again."); }
  }

  return (
    <CustomerShell>
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-serif text-xl font-semibold text-ink">Occasion Reminders</h1>
          <Button size="sm" onClick={openAdd}>+ Add</Button>
        </div>

        {!reminders && !error && (
          <div className="space-y-3">
            <LoadingSkeleton className="h-16 w-full" />
            <LoadingSkeleton className="h-16 w-full" />
          </div>
        )}
        {error && <ErrorState message={error} onRetry={load} />}
        {reminders && reminders.length === 0 && (
          <EmptyState title="No reminders yet" description="Add one so you never miss an occasion." actionLabel="Add a reminder" onAction={openAdd} />
        )}
        {reminders && reminders.length > 0 && (
          <div className="space-y-3">
            {(["Current", "Upcoming"] as const).map((section) => {
              const rows = reminders.filter((r) => (daysUntil(r) <= 2) === (section === "Current"));
              return rows.length > 0 && <section key={section}><h2 className="mb-2 text-sm font-semibold">{section}</h2><div className="space-y-2">{rows.map((r) => <Card key={r.id}><CardContent className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blush">{({ BIRTHDAY: "🎂", ANNIVERSARY: "💕", WEDDING: "💍", FESTIVAL: "🎉", OTHER: "🎁" } as Record<string, string>)[r.occasionType]}</span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelected(r)} aria-label={`View ${r.occasionName}`}><p className="truncate text-[13px] font-semibold">{r.occasionName}</p><p className="mt-1 text-xs text-muted">{new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })} · {r.remindMe}</p></button>
                {section === "Current" && <Link href="/" className="rounded-full bg-rose px-3 py-2 text-xs text-white">Plan gift</Link>}
                <button aria-label={`Details for ${r.occasionName}`} onClick={() => setSelected(r)} className="px-2 text-muted">›</button>
              </CardContent></Card>)}</div></section>;
            })}
          </div>
        )}

        <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
          <SheetContent>
            <SheetTitle className="font-serif text-lg font-semibold">Reminder Details</SheetTitle>
            <SheetDescription className="mt-1 text-sm text-muted">Choose a gift for your upcoming occasion.</SheetDescription>
            {selected && (
              <div className="mt-4 space-y-4">
                <h2 className="font-semibold text-ink">{selected.occasionName}</h2>
                <dl className="space-y-2 text-sm">
                  <div><dt className="text-muted">Recipient</dt><dd>{selected.recipientName}</dd></div>
                  <div><dt className="text-muted">Date</dt><dd>{new Date(selected.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</dd></div>
                  <div><dt className="text-muted">Occasion</dt><dd>{selected.occasionType.toLowerCase()}</dd></div>
                  <div><dt className="text-muted">Repeat yearly</dt><dd>{selected.repeatYearly ? "Yes" : "No"}</dd></div>
                  <div><dt className="text-muted">Remind me</dt><dd>{selected.remindMe}</dd></div>
                  {selected.giftCategory && <div><dt className="text-muted">Gift category</dt><dd>{selected.giftCategory}</dd></div>}
                  {selected.note && <div><dt className="text-muted">Note</dt><dd>{selected.note}</dd></div>}
                </dl>
                <Link href="/" className="flex h-11 w-full items-center justify-center rounded-full bg-rose font-semibold text-white hover:bg-rose/90">Plan gift →</Link>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { openEdit(selected); setSelected(null); }}>Edit</Button>
                  <Button variant="destructive" className="flex-1" onClick={() => remove(selected.id)}>Delete</Button>
                </div>
              </div>
            )}
            <SheetClose asChild><Button variant="outline" className="mt-3 w-full">Close</Button></SheetClose>
          </SheetContent>
        </Sheet>

        {showForm && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={() => setShowForm(false)}>
            <div className="max-h-full w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
              <h2 className="mb-3 font-serif text-lg font-semibold">{editingId ? "Edit Reminder" : "Add Reminder"}</h2>

              <label className="mb-1 block text-sm font-medium">Occasion Name</label>
              <Input value={form.occasionName} onChange={(e) => setForm({ ...form, occasionName: e.target.value })} placeholder="e.g. Priyanka's Birthday" />
              {fieldErrors.occasionName && <p className="mt-1 text-xs text-red-600">{fieldErrors.occasionName[0]}</p>}

              <label className="mb-1 mt-3 block text-sm font-medium">Recipient Name</label>
              <Input value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} placeholder="e.g. Priyanka" />
              {fieldErrors.recipientName && <p className="mt-1 text-xs text-red-600">{fieldErrors.recipientName[0]}</p>}

              <label className="mb-1 mt-3 block text-sm font-medium">Occasion Type</label>
              <div className="flex flex-wrap gap-2">
                {OCCASION_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, occasionType: t })}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${form.occasionType === t ? "border-rose bg-blush text-rose" : "border-ink/15"}`}
                  >
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              <label className="mb-1 mt-3 block text-sm font-medium">Date</label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              {fieldErrors.date && <p className="mt-1 text-xs text-red-600">{fieldErrors.date[0]}</p>}

              <label className="mt-3 flex items-center justify-between text-sm font-medium">Repeat yearly<input type="checkbox" checked={form.repeatYearly} onChange={(e) => setForm({ ...form, repeatYearly: e.target.checked })} className="h-5 w-5 accent-rose" /></label>
              <label htmlFor="remindMe" className="mb-1 mt-3 block text-sm font-medium">Remind me</label>
              <Select id="remindMe" value={form.remindMe} onChange={(e) => setForm({ ...form, remindMe: e.target.value })}>{["1 day before", "3 days before", "1 week before", "1 month before"].map((value) => <option key={value}>{value}</option>)}</Select>
              <label htmlFor="giftCategory" className="mb-1 mt-3 block text-sm font-medium">Preferred gift category</label>
              <Select id="giftCategory" value={form.giftCategory} onChange={(e) => setForm({ ...form, giftCategory: e.target.value })}>{["", "Flowers", "Cakes", "Hampers", "Personalized", "Plants"].map((value) => <option key={value} value={value}>{value || "Any category"}</option>)}</Select>
              <label htmlFor="reminderNote" className="mb-1 mt-3 block text-sm font-medium">Optional note (gift ideas, preferences)</label>
              <Textarea id="reminderNote" maxLength={500} rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Loves minimalist and personalized gifts…" />
              {saveError && <p role="alert" className="mt-2 text-sm text-red-600">{saveError}</p>}
              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
