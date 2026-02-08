import { NextRequest, NextResponse } from "next/server";

const SCAN_API_BASE = "https://8004scan.io/api/v1";

export async function GET(req: NextRequest) {
  const chainId = req.nextUrl.searchParams.get("chain_id");
  const tokenId = req.nextUrl.searchParams.get("token_id");

  if (!chainId || !tokenId) {
    return NextResponse.json({ error: "chain_id and token_id required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${SCAN_API_BASE}/agents/${chainId}/${tokenId}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "not found" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
