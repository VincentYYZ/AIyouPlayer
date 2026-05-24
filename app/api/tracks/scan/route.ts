import { NextRequest } from "next/server";
import { scanAudioLib } from "@/app/lib/audioLib";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const tracks = await scanAudioLib();
    return Response.json({ total: tracks.length, tracks });
  } catch (err) {
    return Response.json(
      { error: String(err), total: 0, tracks: [] },
      { status: 500 }
    );
  }
}
