/* ============================================================================
   Roadtrip Dashboard — proxy zamknięć dróg (Cloudflare Worker)
   ----------------------------------------------------------------------------
   PO CO: stanowe feedy 511 (Caltrans itd.) blokują przeglądarkę (CORS).
   Ten Worker pobiera feed PO STRONIE SERWERA i dokleja nagłówki CORS, więc
   aplikacja (na GitHub Pages / VPS) może go odczytać. Darmowy, bez VPS.

   JAK WGRAĆ (z telefonu lub komputera, ~5 min) — patrz README.md, sekcja
   „Automatyczne zamknięcia dróg (Cloudflare Worker)”.

   BEZPIECZEŃSTWO: proxy przepuszcza TYLKO hosty z listy ALLOW poniżej, więc
   nikt nie użyje go jako otwartego relaya.
   ========================================================================== */

const ALLOW = [
  "quickmap.dot.ca.gov",   // Caltrans (Kalifornia) — działa bez klucza
  "az511.gov",             // Arizona (część danych może wymagać tokenu)
  "www.az511.gov",
  "drivetexas.org",        // Teksas
  "www.nmroads.com",       // Nowy Meksyk
  "nmroads.com",
];

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const target = new URL(request.url).searchParams.get("url");
    if (!target) return new Response("Brak ?url=", { status: 400, headers: cors });

    let host;
    try { host = new URL(target).host; }
    catch (e) { return new Response("Zły url", { status: 400, headers: cors }); }
    if (!ALLOW.includes(host))
      return new Response("Host niedozwolony: " + host, { status: 403, headers: cors });

    try {
      const upstream = await fetch(target, { cf: { cacheTtl: 120, cacheEverything: true } });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: { ...cors, "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
      });
    } catch (e) {
      return new Response("Błąd źródła: " + e, { status: 502, headers: cors });
    }
  },
};
