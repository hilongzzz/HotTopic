import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

/**
 * 采集脚本完成后的缓存刷新入口：
 *   GET /api/revalidate?secret=<REVALIDATE_SECRET>
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ revalidated: false, message: "Invalid secret" }, { status: 401 });
  }
  revalidatePath("/", "layout");
  return Response.json({ revalidated: true, now: Date.now() });
}
