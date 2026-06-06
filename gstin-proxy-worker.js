/**
 * ShopChampion — GSTIN Lookup Proxy
 * Cloudflare Worker
 *
 * HOW TO DEPLOY (2 minutes, free):
 * 1. Go to https://workers.cloudflare.com → Sign up free
 * 2. Click "Create Worker"
 * 3. Delete all the default code, paste this entire file
 * 4. Click "Save and Deploy"
 * 5. Copy the worker URL (e.g. https://gstin-proxy.yourname.workers.dev)
 * 6. Paste it in the SellerPanel → Settings → GSTIN Proxy URL field
 *    (it saves automatically — all shops pick it up instantly via Firebase)
 *
 * ─── YOUR API KEY ────────────────────────────────────────────────────────────
 * Get a free key from https://gstincheck.co.in → Register → API Keys
 * Replace the value below with your key.
 */
const GSTIN_API_KEY = "YOUR_GSTINCHECK_API_KEY_HERE";   // ← paste your key here

// ─── Worker entry point ───────────────────────────────────────────────────────
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse("", 204);
    }

    // Health check
    if (url.pathname === "/health" || url.pathname === "/") {
      return corsResponse(JSON.stringify({ ok: true, service: "gstin-proxy", ts: Date.now() }), 200);
    }

    // GSTIN lookup: GET /gstin?gstin=22AAAAA0000A1Z5
    if (url.pathname === "/gstin") {
      const gstin = (url.searchParams.get("gstin") || "").trim().toUpperCase();

      if (!gstin || !/^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
        return corsResponse(JSON.stringify({ flag: false, message: "Invalid or missing GSTIN" }), 400);
      }

      if (GSTIN_API_KEY === "YOUR_GSTINCHECK_API_KEY_HERE") {
        return corsResponse(JSON.stringify({ flag: false, message: "Proxy not configured — API key not set" }), 503);
      }

      try {
        const upstream = await fetch(
          `https://sheet.gstincheck.co.in/check/${GSTIN_API_KEY}/${gstin}`,
          {
            headers: { "User-Agent": "ShopChampion-Proxy/1.0" },
            cf: { cacheTtl: 300, cacheEverything: true }  // cache results 5 min to save quota
          }
        );
        const data = await upstream.json();
        return corsResponse(JSON.stringify(data), upstream.status);
      } catch (err) {
        return corsResponse(JSON.stringify({ flag: false, message: "Upstream error: " + err.message }), 502);
      }
    }

    return corsResponse(JSON.stringify({ error: "Not found" }), 404);
  }
};

function corsResponse(body, status) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type":                "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods":"GET, OPTIONS",
      "Access-Control-Allow-Headers":"Content-Type",
    }
  });
}
