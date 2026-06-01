/* ============================================================================
   Roadtrip Dashboard — proxy zamknięć dróg (Cloudflare Worker)
   ----------------------------------------------------------------------------
   PO CO: stanowe feedy 511 blokują przeglądarkę (CORS) i wymagają tokenu.
   Ten Worker pobiera feed PO STRONIE SERWERA (z tokenem trzymanym tutaj jako
   zmienna środowiskowa), dokleja nagłówki CORS i oddaje aplikacji. Darmowy.

   APLIKACJA woła:  https://twoj-worker.workers.dev/?feed=ca   (albo az / nm / tx)
   TOKENY: ustaw w panelu Cloudflare → Worker → Settings → Variables:
     AZ511_KEY, NMROADS_KEY, TXDOT_KEY   (zarejestruj za darmo — patrz README)
   Kalifornia (ca) działa BEZ tokenu.
   ========================================================================== */

const FEEDS = {
  // Kalifornia — Caltrans, bez klucza:
  ca: () => "https://quickmap.dot.ca.gov/data/lcs2way.json",
  // Arizona — AZ511 (Castle Rock 511 API), wymaga darmowego klucza:
  az: (env) => env.AZ511_KEY && `https://az511.gov/api/v2/get/event?key=${env.AZ511_KEY}&format=json`,
  // Nowy Meksyk — NMRoads (ten sam typ API):
  nm: (env) => env.NMROADS_KEY && `https://nmroads.com/api/v2/get/event?key=${env.NMROADS_KEY}&format=json`,
  // Teksas — TxDOT (jeśli masz endpoint/klucz; w przeciwnym razie pominięty):
  tx: (env) => env.TXDOT_URL || null,
};

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const feed = new URL(request.url).searchParams.get("feed");
    if (!feed || !FEEDS[feed])
      return json({ error: "Użyj ?feed=ca|az|nm|tx" }, 400, cors);

    const target = FEEDS[feed](env);
    if (!target)
      return json({ error: `Feed '${feed}' nieskonfigurowany (brak tokenu w Variables).`, events: [] }, 200, cors);

    try {
      const r = await fetch(target, { cf: { cacheTtl: 120, cacheEverything: true } });
      const body = await r.text();
      return new Response(body, {
        status: r.status,
        headers: { ...cors, "Content-Type": r.headers.get("Content-Type") || "application/json" },
      });
    } catch (e) {
      return json({ error: "Błąd źródła: " + e, events: [] }, 502, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
