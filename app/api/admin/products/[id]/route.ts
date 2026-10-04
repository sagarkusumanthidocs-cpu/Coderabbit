import { NextRequest, NextResponse } from "next/server";
import { getProductDetail, updateProductDetails, setProductAvailability, setProductFeatured } from "@/lib/services/admin";
import { requireRole } from "@/lib/session";
import { handleApiError, ValidationError } from "@/lib/api-errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const detail = await getProductDetail(id);
    return NextResponse.json(detail);
  } catch (err) {
    return handleApiError(err);
  }
}

const patchSchema = z.union([
  z.object({ name: z.string().trim().min(2), description: z.string().trim().min(1), price: z.number().finite().positive().multipleOf(0.01), isFeatured: z.boolean() }).strict(),
  z.object({ isAvailable: z.boolean() }).strict(),
  z.object({ isFeatured: z.boolean() }).strict(),
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError("Invalid update payload.");

    if ("name" in parsed.data) {
      const product = await updateProductDetails(id, parsed.data);
      return NextResponse.json({ product });
    }
    if ("isAvailable" in parsed.data) {
      const product = await setProductAvailability(id, parsed.data.isAvailable);
      return NextResponse.json({ product });
    }
    const product = await setProductFeatured(id, parsed.data.isFeatured);
    return NextResponse.json({ product });
  } catch (err) {
    return handleApiError(err);
  }
}
