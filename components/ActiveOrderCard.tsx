import Link from "next/link";
import { ChevronRight, PackageCheck } from "lucide-react";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { formatINR } from "@/lib/utils";
import { ORDER_SEQUENCE, ORDER_STATUS_LABELS } from "@/lib/services/orderStateMachine";

export function ActiveOrderCard({ order }: { order: any }) {
  if (!order) {
    return (
      <section className="flex flex-col items-start justify-center gap-2 rounded-[20px] border border-dashed border-border bg-white p-3.5">
        <p className="font-serif text-sm font-semibold text-ink">No gifts on the way</p>
        <p className="text-sm text-muted">Once you send a gift, you can track it right here.</p>
      </section>
    );
  }
  const item = order.items[0];
  const currentIndex = ORDER_SEQUENCE.indexOf(order.status);
  return (
    <section className="rounded-[20px] border border-rose/20 bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-serif text-sm font-semibold text-ink">
          <PackageCheck className="h-5 w-5 text-rose" />
          Track your gift
        </h2>
        <span className="rounded-full bg-blush px-2.5 py-1 text-xs font-semibold text-ink">
          {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
        </span>
      </div>
      <div className="mt-2.5 flex gap-2">
        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-blush">
          <ImageWithFallback src={item?.product?.imageUrl || ""} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1 text-xs">
          <p className="truncate font-semibold text-ink">{item?.productName}</p>
          <p className="truncate text-muted">For {order.recipientName}</p>
          <p className="text-muted">
            <span className="font-mono text-xs">{order.orderCode}</span> · {order.store.name}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex gap-1" aria-hidden="true">
        {ORDER_SEQUENCE.map((s, i) => (
          <span
            key={s}
            className={`h-[5px] flex-1 rounded-full ${i < currentIndex ? "bg-rose" : i === currentIndex ? "animate-pulse bg-rose" : "bg-rose/15"}`}
          />
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Total <span className="font-semibold text-ink">{formatINR(order.total)}</span>
        </p>
        <Link
          href={`/orders/${order.id}/track`}
          className="flex items-center gap-1 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink/90"
        >
          Track order
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
