import { NextRequest, NextResponse } from "next/server";
import { getCart, addToCart, clearCart } from "@/lib/services/cart";
import { requireRole } from "@/lib/session";
import { addToCartSchema } from "@/lib/validation";
import { handleApiError, ValidationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireRole("CUSTOMER");
    const cart = await getCart(session.userId);
    return NextResponse.json({ cart });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("CUSTOMER");
    const body = await req.json();
    const parsed = addToCartSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Please check the highlighted fields.", parsed.error.flatten().fieldErrors as any);
    }
    const item = await addToCart(session.userId, parsed.data.productId, parsed.data.quantity, parsed.data.replaceExisting);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE() {
  try {
    const session = await requireRole("CUSTOMER");
    await clearCart(session.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
