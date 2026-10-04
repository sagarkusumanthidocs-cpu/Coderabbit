import { NextRequest, NextResponse } from "next/server";
import { listProducts, searchStores } from "@/lib/services/catalogue";
import { handleApiError, ValidationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const cityId = sp.get("cityId");
    if (!cityId) throw new ValidationError("cityId is required.");
    const filters = {
      cityId,
      categorySlug: sp.get("category") ?? undefined,
      query: sp.get("q")?.trim() || undefined,
      sort: (sp.get("sort") as "newest" | "price_asc" | "price_desc") ?? undefined,
    };
    const [products, stores] = await Promise.all([listProducts(filters), searchStores(filters)]);
    return NextResponse.json({ products, stores });
  } catch (err) {
    return handleApiError(err);
  }
}
