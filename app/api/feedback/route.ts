import { NextResponse } from "next/server";
import { recordFeedback } from "@/lib/feedback";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    note?: string;
    role?: string;
    company?: string;
  };
  const note = body.note?.trim() ?? "";
  if (!note) {
    return NextResponse.json({ error: "note required" }, { status: 400 });
  }
  const line = await recordFeedback({
    note,
    ...(body.role ? { role: body.role } : {}),
    ...(body.company ? { company: body.company } : {}),
  });
  return NextResponse.json({ ok: true, line });
}
