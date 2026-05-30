# 🛣️ Roadtrip Dashboard — „Czy bezpiecznie tam jechać?”

Mobilny **PWA** i jedyne narzędzie decyzyjne na roadtrip kamperem do **LA**
(2 dorosłych + dzieci 4 lata i 8 miesięcy). Język: polski.

**Wpisujesz kolejny przystanek → apka bierze Twoją pozycję GPS i odpowiada:**

> **„Czy bezpiecznie tam dojechać, czy samo miejsce jest OK, i czy stamtąd
> bezpiecznie dotrzemy dalej do LA?”**

Sprawdza **wszystko, co się da** (darmowe API, bez kluczy): pogodę i jej
**prognozę wzdłuż trasy w czasie przejazdu**, alerty NWS (flood/flash flood,
upały, burze, dust storm, high wind, red flag, tornado…), pożary i trzęsienia
ziemi — osobno dla **dojazdu**, **miejsca** i **odcinka dalej do LA**.

## Jak to działa

1. **Wpisujesz cel** (np. „Sedona, AZ”). Geokoder zamienia tekst na współrzędne
   (Photon/OSM, fallback Nominatim). Wybierasz właściwy wynik z listy.
2. **GPS** ustala Twoją pozycję startową (wymaga HTTPS; iPhone = dokładny,
   MacBook = przybliżony przez WiFi).
3. **OSRM** liczy realną trasę drogową i czas — osobno dla `start → cel` oraz
   `cel → LA`. Jeśli OSRM jest niedostępny, apka **szacuje** czas z odległości.
4. **Prognoza wzdłuż trasy:** apka próbkuje punkty na trasie i pobiera
   **godzinową** prognozę NWS dopasowaną do **ETA** (zakłada, że wyjeżdżasz
   niebawem), więc widzisz, jaka pogoda będzie *kiedy tam dojedziesz*.
5. **Werdykt 🟢/🟡/🔴** = najgorsza z trzech nóg:
   - 🚗 **Dojazd** — pogoda/alerty/pożary na trasie do celu,
   - 📍 **Samo miejsce** — pogoda przyjazdu + noc, alerty, pożary, trzęsienia,
   - 🌴 **Dalej do LA** — warunki na odcinku z celu do LA.
6. **Czas i podział na dni:** jeśli dojazd przekracza komfortowy limit
   (domyślnie **6 h**), apka proponuje **podział na 2 dni** ze wskazaniem
   miejsca na nocleg po drodze (reverse-geocode punktu w połowie trasy).

> ⚠️ Werdykt jest **konserwatywny**: lepiej fałszywy 🟡 niż przeoczony 🔴.
> Apka **ostrzega i rekomenduje**, ale nie liczy auto-objazdów — od tego jest
> nawigacja.

> ⚠️ Apka **NIE zastępuje rządowych alertów.** Włącz **Wireless Emergency
> Alerts** w ustawieniach telefonu — tylko one obudzą Cię w nocy.

### Źródła danych (wszystkie darmowe, bez kluczy)

| Sygnał            | Źródło                                                        |
|-------------------|---------------------------------------------------------------|
| Geokodowanie      | Photon (komoot/OSM), fallback Nominatim                       |
| Trasa i czas      | OSRM (`router.project-osrm.org`), fallback: szacunek z dystansu |
| Pogoda + prognoza | `api.weather.gov` (NWS, prognoza godzinowa)                   |
| Alerty            | `api.weather.gov/alerts/active`                               |
| Pożary            | WFIGS ArcGIS (incydenty aktywne)                              |
| Trzęsienia        | USGS FDSN (M≥3, ostatnie 7 dni)                               |
| Zamknięcia dróg   | brak darmowego API z CORS → linki do 511 (ręcznie)           |

### Niezawodność / offline
Każdy fetch ma **timeout 8 s + try/catch** — apka nigdy się nie wywala. Ostatnie
udane odpowiedzi trafiają do `localStorage` (fallback). Service worker cache'uje
powłokę. Gdy **wszystkie** źródła padną → 🟡 „Nie mogę zweryfikować — sprawdź
ręcznie”, bez fałszywego 🔴. Offline → baner „🔴 OFFLINE — potwierdź zanim
ruszysz”.

---

## Pliki

| Plik            | Rola                                                        |
|-----------------|-------------------------------------------------------------|
| `index.html`    | Cała aplikacja (vanilla JS): logika werdyktu, API, UI       |
| `manifest.json` | Manifest PWA (ikona 🛣️ jako SVG base64, theme `#FFA500`)    |
| `sw.js`         | Service worker (cache powłoki + odpowiedzi)                 |
| `README.md`     | Ten plik                                                    |

Stack: jeden `index.html` + Tailwind przez CDN + vanilla JS. **Bez build stepu.**

---

## Hosting na własnym VPS (nginx + Let's Encrypt)

PWA i geolokalizacja **wymagają HTTPS**. Wgraj pliki do np. `/var/www/roadtrip`.

### 1. Blok serwera nginx

`/etc/nginx/sites-available/roadtrip` (potem `ln -s` do `sites-enabled`):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name roadtrip.twojadomena.pl;

    root /var/www/roadtrip;
    index index.html;

    # Poprawne MIME types dla PWA
    types {
        application/manifest+json  webmanifest json;
        image/svg+xml              svg;
        text/html                  html;
        application/javascript     js;
    }

    # Service worker MUSI być świeży — nigdy nie cache'uj sw.js
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        expires off;
    }

    # manifest też trzymaj świeży
    location = /manifest.json {
        add_header Cache-Control "no-cache";
        types { application/manifest+json json; }
        default_type application/manifest+json;
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

> `manifest.json` serwujemy z typem `application/manifest+json`. Jeśli wolisz
> rozszerzenie `.webmanifest`, zmień nazwę pliku i odnośnik
> `<link rel="manifest" …>` w `index.html` — blok `types {}` obsługuje oba.

Sprawdź i przeładuj:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 2. HTTPS przez certbot (Let's Encrypt)

```bash
sudo apt update && sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d roadtrip.twojadomena.pl
sudo certbot renew --dry-run
```

Certbot dopisze `listen 443 ssl;`, ścieżki do certyfikatu i przekierowanie
HTTP→HTTPS. Po tym otwórz `https://roadtrip.twojadomena.pl` w Safari.

---

## Dodanie do ekranu głównego iPhone (Safari)

1. Otwórz `https://roadtrip.twojadomena.pl` w **Safari** (na iOS tylko Safari
   instaluje PWA i daje geolokalizację po HTTPS).
2. Dotknij **Udostępnij** (kwadrat ze strzałką w górę).
3. **„Do ekranu głównego” / „Add to Home Screen”** → potwierdź.
4. Uruchom z ikony 🛣️ — apka działa pełnoekranowo (standalone).
5. Przy pierwszym wyszukiwaniu zezwól na **dostęp do lokalizacji**.

> 💡 Niezależnie od apki włącz **Ustawienia → Powiadomienia → Alerty rządowe /
> Wireless Emergency Alerts**.

---

## Konfiguracja (na górze `<script>` w `index.html`)

```js
const LA = { name:"Los Angeles (cel)", lat:34.0522, lng:-118.2437 }; // stały cel końcowy
const MAX_DAILY_DRIVE_H = 6;   // powyżej → propozycja podziału na 2 dni (komfort z dziećmi)
const MIN_DEPART_H = 5.5;      // nie sugeruj wyjazdu przed 5:30
const AVG_SPEED_KMH = 88;      // prędkość do szacunku czasu, gdy OSRM padnie
```

- **Zmiana celu końcowego** (gdyby trasa kończyła się gdzie indziej): edytuj
  `LA`.
- **Progi werdyktu** (upał >37/>43°C, wiatr >40/>65 km/h, opady ≥60%, pożar
  <50/<150 km, trzęsienie M≥4.5/M≥6): funkcja `assessLeg()`.
- **Filtr alertów NWS:** stała `ALERT_FILTER`.
- **Liczba próbek pogody wzdłuż trasy:** wywołania `sampleAlong(..., 4)` i
  `sampleAlong(..., 3)` w `loadAnalysis()` (więcej = dokładniej, ale więcej
  zapytań do NWS).

### Testy logiki
Logika `computeVerdict()` / `assessLeg()` była weryfikowana m.in. dla
scenariuszy: czysto → 🟢; upał w celu → 🟡; Flash Flood na trasie → 🔴 (dojazd);
pożar przy celu → 🔴 (miejsce); pożar na odcinku do LA → 🔴 (dalej); trzęsienie
M6+ → 🔴; wszystkie API padły → 🟡 „nie mogę zweryfikować”; progi wiatru/temp.
