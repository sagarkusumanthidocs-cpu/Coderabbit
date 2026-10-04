import Link from "next/link";
import { DeliveryConfirmationBadge } from "@/components/DeliveryConfirmationBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/utils";

export function OrderCard({
  id,
  orderCode,
  productName,
  storeName,
  placedAt,
  status,
  total,
  trackHref,
  deliveryConfirmedByCustomer,
}: {
  id: string;
  orderCode: string;
  productName: string;
  storeName: string;
  placedAt: string | Date;
  status: string;
  total: number | string;
  trackHref: string;
  deliveryConfirmedByCustomer: boolean;
}) {
  return (
    <Link href={trackHref}>
      <Card className="transition hover:shadow-md">
        <CardContent className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">{orderCode}</p>
            <p className="break-words font-medium text-ink">{productName}</p>
            <p className="text-sm text-muted">
              {storeName} · {new Date(placedAt).toLocaleDateString("en-IN")}
            </p>
            {status === "DELIVERED" && <div className="mt-2"><DeliveryConfirmationBadge confirmed={deliveryConfirmedByCustomer} /></div>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <StatusBadge status={status} />
            <p className="font-semibold text-ink">{formatINR(total)}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
