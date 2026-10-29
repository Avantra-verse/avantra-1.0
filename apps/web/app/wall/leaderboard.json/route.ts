// The public Wall leaderboard, cached at the CDN for 5 s: the big screen and every phone share one database call.
import { publicRpc } from "@/lib/server/rpc";

export async function GET() {
  const board = await publicRpc("wall_leaderboard");
  if (!board) return Response.json({ message: "Leaderboard unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  return Response.json(board, { headers: { "cache-control": "public, s-maxage=5, stale-while-revalidate=30" } });
}
