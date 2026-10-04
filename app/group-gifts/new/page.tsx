"use client";
import Link from "next/link";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { splitGroupGiftAmount } from "@/lib/groupGiftSplit";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerShell } from "@/components/CustomerShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const OCCASION_TYPES = ["BIRTHDAY", "ANNIVERSARY", "WEDDING", "FESTIVAL", "OTHER"] as const;

export default function NewGroupGiftPage() {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inviteNotice, setInviteNotice] = useState("");
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [cityId, setCityId] = useState("");
  const [products, setProducts] = useState<{ id: string; name: string; price: string; imageUrl: string; store: { name: string } }[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [occasionType, setOccasionType] = useState<(typeof OCCASION_TYPES)[number]>("BIRTHDAY");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [splitType, setSplitType] = useState<"EQUAL" | "CUSTOM">("EQUAL");
  const [contributorNames, setContributorNames] = useState<string[]>([]);
  const [newContributor, setNewContributor] = useState("");
  const [customAmounts, setCustomAmounts] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/cities").then(async (r) => {
      if (!r.ok) throw new Error("Could not load cities. Please reload the page.");
      return r.json();
    }).then((d) => {
      setCities(d.cities);
      if (d.cities[0]) setCityId(d.cities[0].id);
    }).catch((e) => setErrors({ _: [e.message] }));
  }, []);

  useEffect(() => {
    if (!cityId) return;
    let cancelled = false;
    fetch(`/api/products?cityId=${cityId}`).then(async (r) => {
      if (!r.ok) throw new Error("Could not load gifts. Please try another city or reload the page.");
      return r.json();
    }).then((d) => { if (!cancelled) { setProducts(d.products); setSelectedProductIds(d.products[0] ? [d.products[0].id] : []); } })
      .catch((e) => { if (!cancelled) setErrors({ _: [e.message] }); });
    return () => { cancelled = true; };
  }, [cityId]);

  const selectedTotal = products.filter((p) => selectedProductIds.includes(p.id)).reduce((s, p) => s + Number(p.price), 0);
  const people = ["You"].concat(contributorNames);
  const goal = Number(goalAmount) || selectedTotal;
  const equalShares = splitGroupGiftAmount(goal, people.length);
  const customTotal = people.reduce((s, _n, i) => s + (Number(customAmounts[i]) || 0), 0);

  function toggleProduct(id: string) {
    setSelectedProductIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  function addContributor() {
    if (!newContributor.trim()) return;
    setContributorNames((cur) => [...cur, newContributor.trim()]);
    setNewContributor("");
  }

  async function submit() {
    setSaving(true);
    setErrors({});
    const contributors =
      splitType === "EQUAL"
        ? people.map((name, i) => ({ name, amount: equalShares[i] ?? 0 }))
        : people.map((name, i) => ({ name, amount: Number(customAmounts[i]) || 0 }));

    try {
      const res = await fetch("/api/group-gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName,
          occasionType,
          productIds: selectedProductIds,
          cityId,
          deliveryDate,
          goalAmount: goal,
          splitType,
          message,
          contributors,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.details ?? { _: [data.message ?? "Something went wrong."] });
        return;
      }
      router.push(`/group-gifts/${data.groupGift.id}`);
    } catch {
      setErrors({ _: ["Could not create the group gift. Please try again."] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <CustomerShell>
      <div className="space-y-4 p-4">
        <Link href="/group-gifts" className="text-sm text-rose">← Back</Link>
        <h1 className="font-serif text-xl font-semibold text-ink">Create Group Gift</h1>
        <p className="text-xs text-muted">Set up the details and invite friends to contribute.</p>

        <div>
          <label className="mb-1 block text-sm font-medium">Delivery City</label>
          <select className="h-11 w-full rounded-2xl border border-ink/15 px-4" value={cityId} onChange={(e) => { setCityId(e.target.value); setSelectedProductIds([]); setProducts([]); }}>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Selected Gifts</label>
          <div className="space-y-2">{products.filter((p) => selectedProductIds.includes(p.id)).map((p) => <Card key={p.id}><CardContent className="flex items-center gap-3 p-3"><ImageWithFallback src={p.imageUrl} alt={p.name} className="h-11 w-11 shrink-0 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{p.name}</p><p className="text-xs text-muted">{p.store.name}</p></div><p className="text-sm font-semibold text-rose">₹{Number(p.price).toLocaleString("en-IN")}</p><button aria-label={`Remove gift ${p.name}`} onClick={() => toggleProduct(p.id)}>×</button></CardContent></Card>)}</div>
          <Button variant="outline" className="mt-3 w-full" onClick={() => setPickerOpen(true)}>+ Add another gift</Button>
          <Sheet open={pickerOpen} onOpenChange={setPickerOpen}><SheetContent aria-describedby={undefined}>
            <div className="mb-3 flex items-center justify-between"><SheetTitle className="font-serif text-lg font-semibold">Choose a gift</SheetTitle><button aria-label="Close gift picker" onClick={() => setPickerOpen(false)}>✕</button></div>
            <div className="space-y-2">{products.map((p) => <button key={p.id} onClick={() => { if (!selectedProductIds.includes(p.id)) toggleProduct(p.id); setPickerOpen(false); }} className="flex w-full items-center gap-3 rounded-xl border border-border bg-white p-3 text-left"><ImageWithFallback src={p.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" /><div className="flex-1"><p className="text-sm font-semibold">{p.name}</p><p className="text-xs text-muted">{p.store.name}</p></div><span className="text-xs font-semibold text-rose">{selectedProductIds.includes(p.id) ? "✓ Selected" : `₹${Number(p.price).toLocaleString("en-IN")}`}</span></button>)}</div>
            {!products.length && <p className="text-sm text-muted">No gifts available in this city.</p>}
          </SheetContent></Sheet>
          {errors.productIds && <p className="mt-1 text-xs text-red-600">{errors.productIds[0]}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Recipient Name</label>
          <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="e.g. Priya Sharma" />
          {errors.recipientName && <p className="mt-1 text-xs text-red-600">{errors.recipientName[0]}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Occasion Type</label>
          <div className="flex flex-wrap gap-2">
            {OCCASION_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setOccasionType(t)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${occasionType === t ? "border-rose bg-blush text-rose" : "border-ink/15"}`}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Delivery Date</label>
          <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          {errors.deliveryDate && <p className="mt-1 text-xs text-red-600">{errors.deliveryDate[0]}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Group Goal Amount (₹)</label>
          <Input type="number" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} placeholder={String(selectedTotal || "")} />
          {errors.goalAmount && <p className="mt-1 text-xs text-red-600">{errors.goalAmount[0]}</p>}
          <p className="mt-1 text-xs text-muted">Defaults to the total price of selected gifts (₹{selectedTotal.toLocaleString("en-IN")}).</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Split Type</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSplitType("EQUAL")} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${splitType === "EQUAL" ? "border-rose bg-blush text-rose" : "border-ink/15"}`}>Equal Split</button>
            <button type="button" onClick={() => setSplitType("CUSTOM")} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${splitType === "CUSTOM" ? "border-rose bg-blush text-rose" : "border-ink/15"}`}>Custom Amount</button>
          </div>

          <Card className="mt-3">
            <CardContent>
              <p className="mb-2 text-sm font-semibold">Contribution breakdown</p>
              {people.map((name, i) => (
                <div key={i} className="flex items-center justify-between gap-2 py-1 text-sm">
                  <span>{name}</span>
                  {splitType === "EQUAL" ? (
                    <span className="font-semibold">₹{(equalShares[i] ?? 0).toLocaleString("en-IN")}</span>
                  ) : (
                    <Input
                      type="number"
                      className="w-24"
                      value={customAmounts[i] ?? ""}
                      onChange={(e) => setCustomAmounts({ ...customAmounts, [i]: e.target.value })}
                      placeholder="₹0"
                    />
                  )}
                </div>
              ))}
              {splitType === "CUSTOM" && (
                <p className={`mt-2 text-xs font-semibold ${customTotal === goal ? "text-green-700" : "text-amber-700"}`}>
                  {customTotal === goal ? `✓ Matches the goal amount exactly` : `Entered ₹${customTotal.toLocaleString("en-IN")} of ₹${goal.toLocaleString("en-IN")} goal`}
                </p>
              )}
            </CardContent>
          </Card>
          {errors.contributors && <p className="mt-1 text-xs text-red-600">{errors.contributors[0]}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Add Contributors</label>
          <div className="flex gap-2">
            <Input value={newContributor} onChange={(e) => setNewContributor(e.target.value)} placeholder="Friend's name" />
            <Button onClick={addContributor}>+</Button>
          </div>
          {contributorNames.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {contributorNames.map((n, i) => (
                <span key={i} className="rounded-full bg-blush px-3 py-1 text-xs font-semibold text-rose">{n} <button aria-label={`Remove ${n}`} onClick={() => { setContributorNames((names) => names.filter((_, index) => index !== i)); setCustomAmounts((amounts) => Object.fromEntries(Object.entries(amounts).filter(([index]) => Number(index) !== i + 1).map(([index, amount]) => [Number(index) > i + 1 ? Number(index) - 1 : index, amount]))); }}>×</button></span>
              ))}
            </div>
          )}
        </div>

        <div><p className="mb-2 text-sm font-semibold">Invite Method</p><div className="flex gap-2"><Button className="flex-1 bg-green-700" onClick={() => setInviteNotice("Demo only — no WhatsApp invitation is sent.")}>WhatsApp</Button><Button variant="outline" className="flex-1" onClick={() => setInviteNotice("Create your group first, then copy its link from Group Gift Details.")}>Copy Link</Button></div>{inviteNotice && <p role="status" className="mt-2 text-xs text-muted">{inviteNotice}</p>}</div>
        <div>
          <label className="mb-1 block text-sm font-medium">Optional Group Message</label>
          <textarea className="w-full rounded-2xl border border-ink/15 p-3 text-sm" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        {errors._ && <p className="text-sm text-red-600">{errors._[0]}</p>}
        <Button className="w-full" onClick={submit} disabled={saving || selectedProductIds.length === 0}>
          {saving ? "Creating…" : "Create & Invite →"}
        </Button>
      </div>
    </CustomerShell>
  );
}
