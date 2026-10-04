import { NextRequest, NextResponse } from "next/server";
import { getGroupGift, deleteGroupGift, prepareGroupGiftCart } from "@/lib/services/groupGifts";
import { requireRole } from "@/lib/session";
import { handleApiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("CUSTOMER");
    const { id } = await params;
    const groupGift = await getGroupGift(session.userId, id);
    return NextResponse.json({ groupGift });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("CUSTOMER");
    const { id } = await params;
    await deleteGroupGift(session.userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("CUSTOMER");
    const { id } = await params;
    const body = await req.json();
    await prepareGroupGiftCart(session.userId, id, body.allowPartial === true);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
