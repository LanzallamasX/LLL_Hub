import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || String(new Date().getFullYear());

  // Argentina
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/AR`;

  const res = await fetch(url, {
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!res.ok) {
    return NextResponse.json({ holidays: [] }, { status: 200 });
  }

  const data = await res.json();
  return NextResponse.json({ holidays: data }, { status: 200 });
}