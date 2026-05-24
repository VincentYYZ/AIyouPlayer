import { NextRequest } from "next/server";
import { scanAudioLib, searchTracks } from "@/app/lib/audioLib";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.max(
    1,
    Math.min(100, Number(req.nextUrl.searchParams.get("limit")) || 30)
  );
  try {
    const all = await scanAudioLib();
    const tracks = searchTracks(all, q, limit);
    return Response.json({ total: tracks.length, tracks });
  } catch (err) {
    return Response.json(
      { error: String(err), total: 0, tracks: [] },
      { status: 500 }
    );
  }
}
