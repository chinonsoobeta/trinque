/**
 * Served at `/.well-known/apple-app-site-association` through a rewrite in
 * `next.config.ts`, because an App Router segment cannot start with a dot.
 */
export async function GET() {
  const teamId = String(process.env.APPLE_DEVELOPER_TEAM_ID ?? "").trim();
  if (!teamId) return Response.json({ error: "apple_team_id_not_configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json({
    applinks: {
      apps: [],
      details: [{ appID: `${teamId}.com.chinonsoobeta.trinque`, components: [{ "/": "/", "?": { join: "*" }, comment: "Trinque group invite links" }] }],
    },
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
