import { Database } from "bun:sqlite";
import { join } from "path";

// --- Database ---
const DATA_DIR = process.env.DATA_DIR || "/data";
const dbPath = join(DATA_DIR, "gitvana.db");

// Ensure data directory exists
try { require("fs").mkdirSync(DATA_DIR, { recursive: true }); } catch {}

const db = new Database(dbPath);
db.exec("PRAGMA journal_mode=WAL");
db.exec(`CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  level_id TEXT,
  data TEXT,
  session_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec("CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)");
db.exec("CREATE INDEX IF NOT EXISTS idx_events_level ON events(level_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)");

db.exec(`CREATE TABLE IF NOT EXISTS blog_likes (
  post_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, session_id)
)`);

const insertLike = db.prepare("INSERT OR IGNORE INTO blog_likes (post_id, session_id) VALUES (?, ?)");
const removeLike = db.prepare("DELETE FROM blog_likes WHERE post_id = ? AND session_id = ?");
const countLikes = db.prepare("SELECT post_id, COUNT(*) as count FROM blog_likes GROUP BY post_id");
const hasLiked = db.prepare("SELECT 1 FROM blog_likes WHERE post_id = ? AND session_id = ?");

const insertEvent = db.prepare(
  "INSERT INTO events (type, level_id, data, session_id) VALUES (?, ?, ?, ?)"
);

// --- Rate limiting ---
const RATE_LIMIT = 60;
const RATE_WINDOW = 60_000;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimits) {
    if (now > entry.resetAt) rateLimits.delete(ip);
  }
}, 5 * 60_000);

// --- Allowed event types ---
const ALLOWED_TYPES = new Set(['session', 'level_start', 'level_complete', 'level_restart', 'command']);

// --- Stats cache ---
const STATS_CACHE_TTL = 5 * 60_000; // 5 minutes
let statsCache: { data: any; expiresAt: number } | null = null;

function getStats() {
  const now = Date.now();
  if (statsCache && now < statsCache.expiresAt) return statsCache.data;

  const totalSessions = db.query("SELECT COUNT(DISTINCT session_id) as c FROM events WHERE type='session'").get() as any;
  const totalCompletions = db.query("SELECT COUNT(*) as c FROM events WHERE type='level_complete'").get() as any;
  const totalCommands = db.query("SELECT COUNT(*) as c FROM events WHERE type='command'").get() as any;
  const levelStats = db.query(`
    SELECT level_id,
      COUNT(CASE WHEN type='level_start' THEN 1 END) as starts,
      COUNT(CASE WHEN type='level_complete' THEN 1 END) as completions,
      COUNT(CASE WHEN type='level_restart' THEN 1 END) as restarts
    FROM events WHERE level_id IS NOT NULL
    GROUP BY level_id ORDER BY level_id
  `).all();
  const topCommands = db.query(`
    SELECT json_extract(data, '$.cmd') as cmd, COUNT(*) as count
    FROM events WHERE type='command' AND data IS NOT NULL
    GROUP BY cmd ORDER BY count DESC LIMIT 10
  `).all();
  const recentActivity = db.query(
    "SELECT COUNT(*) as c FROM events WHERE created_at >= datetime('now', '-1 day')"
  ).get() as any;

  const data = {
    totalSessions: totalSessions?.c || 0,
    totalCompletions: totalCompletions?.c || 0,
    totalCommands: totalCommands?.c || 0,
    levelStats,
    topCommands,
    recentActivity: recentActivity?.c || 0,
  };

  statsCache = { data, expiresAt: now + STATS_CACHE_TTL };
  return data;
}

// --- Server ---
const DIST_DIR = "./dist";

Bun.serve({
  port: Number(process.env.PORT) || 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // --- API: Health ---
    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok" });
    }

    // --- API: Post event ---
    if (url.pathname === "/api/events" && req.method === "POST") {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      if (!checkRateLimit(ip)) {
        return new Response("Too Many Requests", { status: 429, headers: { "Retry-After": "60" } });
      }

      try {
        const body = await req.json();
        const { type, levelId, data, sessionId } = body;

        // Validate
        if (!type || !ALLOWED_TYPES.has(type)) return new Response("Bad type", { status: 400 });
        if (!sessionId || typeof sessionId !== "string" || sessionId.length < 8 || sessionId.length > 64) return new Response("Bad sessionId", { status: 400 });
        if (levelId && (typeof levelId !== "string" || levelId.length > 100)) return new Response("Bad levelId", { status: 400 });

        const dataStr = data ? JSON.stringify(data).slice(0, 2048) : null;
        insertEvent.run(type, levelId || null, dataStr, sessionId);

        return new Response(null, { status: 204 });
      } catch {
        return new Response("Bad Request", { status: 400 });
      }
    }

    // --- API: Blog likes ---
    if (url.pathname === "/api/blog/likes" && req.method === "GET") {
      const sessionId = url.searchParams.get("session");
      const rows = countLikes.all() as { post_id: string; count: number }[];
      const counts: Record<string, number> = {};
      for (const row of rows) counts[row.post_id] = row.count;
      const liked: Record<string, boolean> = {};
      if (sessionId) {
        for (const row of rows) {
          liked[row.post_id] = !!(hasLiked.get(row.post_id, sessionId));
        }
      }
      return Response.json({ counts, liked }, {
        headers: { "Cache-Control": "public, max-age=30" },
      });
    }

    if (url.pathname === "/api/blog/likes" && req.method === "POST") {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      if (!checkRateLimit(ip)) {
        return new Response("Too Many Requests", { status: 429 });
      }
      try {
        const { postId, sessionId, unlike } = await req.json();
        if (!postId || !sessionId) return new Response("Bad request", { status: 400 });
        if (unlike) {
          removeLike.run(postId, sessionId);
        } else {
          insertLike.run(postId, sessionId);
        }
        const row = db.query("SELECT COUNT(*) as c FROM blog_likes WHERE post_id = ?").get(postId) as any;
        return Response.json({ count: row?.c || 0 });
      } catch {
        return new Response("Bad Request", { status: 400 });
      }
    }

    // --- API: Stats (protected — admin, full data, no cache) ---
    if (url.pathname === "/api/stats" && req.method === "GET") {
      const token = process.env.STATS_TOKEN;
      if (token) {
        const auth = req.headers.get("authorization");
        if (auth !== `Bearer ${token}`) {
          return new Response("Unauthorized", { status: 401 });
        }
      }
      // Bypass cache for admin
      statsCache = null;
      return Response.json(getStats());
    }

    // --- API: Stats public (cached, rate-limited, for frontend) ---
    if (url.pathname === "/api/stats/public" && req.method === "GET") {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      if (!checkRateLimit(ip)) {
        return new Response("Too Many Requests", { status: 429, headers: { "Retry-After": "60" } });
      }
      return Response.json(getStats(), {
        headers: { "Cache-Control": "public, max-age=300" },
      });
    }

    // --- Static files ---
    const pathname = decodeURIComponent(url.pathname);
    const filePath = join(DIST_DIR, pathname === "/" ? "index.html" : pathname);

    try {
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const headers: Record<string, string> = {};
        // Cache static assets with hashes for 1 year
        if (pathname.startsWith('/assets/')) {
          headers['Cache-Control'] = 'public, max-age=31536000, immutable';
        }
        return new Response(file, { headers });
      }
    } catch {
      // File not found or path error — fall through to SPA
    }

    // --- SPA fallback (only for HTML-like requests, not assets) ---
    if (pathname.includes('.') && !pathname.endsWith('.html')) {
      return new Response("Not Found", { status: 404 });
    }
    return new Response(Bun.file(join(DIST_DIR, "index.html")));
  },
});

console.log(`Gitvana server running on port ${process.env.PORT || 3000}`);
