# 🛣️ Roadtrip Dashboard — Dallas → LA

Mobilny **PWA** i jedyne narzędzie decyzyjne na 21-dniowy roadtrip kamperem
Dallas → LA (28.05–17.06.2026), 2 dorosłych + dzieci 4 lata i 8 miesięcy.

Apka nie jest panelem z linkami. To **jedno źródło prawdy**, które rano
analizuje warunki za Ciebie i odpowiada na jedno pytanie:

> **„Czy dziś jechać, a jeśli tak — KTÓRĄ z dwóch tras?”**

Otwierasz → widzisz werdykt (🟢 / 🟡 / 🔴) w 3 sekundy → wiesz co robić.
Reszta (pogoda, alerty, pożary, droga, plan, checklisty, SOS) jest schowana
niżej, opcjonalna.

## Jak to działa

- **Dwie trasy.** `DOLNA` (gorąca, krótsza) i `GÓRNA` (chłodniejsza przez
  Albuquerque / Santa Fe / Flagstaff, dłuższa). Różnią się tylko w dniach
  **5–9** i zbiegają się w **Phoenix 5 czerwca** (kotwica). Przełączasz
  aktywną trasę w nagłówku — wybór zapisuje się w `localStorage`.
- **Werdykt porównuje warianty** (gdy dziś się różnią) i rekomenduje, którą
  jechać oraz o której godzinie wyjechać (dojazd przed 12:00, bufor 30 min,
  nie wcześniej niż 5:30 ze względu na dzieci).
- **Auto-dzień** liczony z dzisiejszej daty względem 28.05.2026 (z możliwością
  ręcznego nadpisania przez `localStorage`).
- **Geolokalizacja** (`navigator.geolocation`, wymaga HTTPS) wykrywa, przy
  której trasie jesteś, i ostrzega, jeśli zboczyłeś od obu.
- **Dane na żywo, darmowe, bez kluczy:**
  - 🌡️ Pogoda — `api.weather.gov` (NWS)
  - ⚠️ Alerty — `api.weather.gov/alerts/active` (Flash Flood, Extreme Heat,
    Dust Storm, Red Flag, Severe Tstorm, High Wind…)
  - 🔥 Pożary — WFIGS ArcGIS (incydenty aktywne), promień 250 km wokół trasy
  - 🚧 Droga — best-effort feedy stanowe (TxDOT / NMRoads / AZ511 / Caltrans);
    gdy feed nie odpowiada (zwykle CORS) → „sprawdź ręcznie” + linki, werdykt
    NIE alarmuje na tej podstawie.
- **Offline/niezawodność.** Service worker cache'uje powłokę, a ostatnie udane
  odpowiedzi API trafiają do `localStorage`. Każdy fetch ma timeout 8 s i
  `try/catch` — apka nigdy się nie wywala. Offline → werdykt z ostatnich danych
  + baner „🔴 OFFLINE — potwierdź zanim ruszysz”.

> ⚠️ Apka **pomaga decydować, ale NIE zastępuje rządowych alertów.** Włącz
> **Wireless Emergency Alerts** w ustawieniach telefonu — tylko one obudzą Cię
> w nocy.

---

## Pliki

| Plik            | Rola                                                        |
|-----------------|-------------------------------------------------------------|
| `index.html`    | Cała aplikacja: dane tras, logika werdyktu, UI (vanilla JS) |
| `manifest.json` | Manifest PWA (ikona 🛣️ jako SVG base64, theme `#FFA500`)    |
| `sw.js`         | Service worker (cache powłoki + zewnętrznych odpowiedzi)    |
| `README.md`     | Ten plik                                                    |

Stack: jeden `index.html` + Tailwind przez CDN + vanilla JS. **Bez build
stepu.** Wszystko działa po wgraniu plików na serwer statyczny z HTTPS.

---

## Hosting na własnym VPS (nginx + Let's Encrypt)

PWA i geolokalizacja **wymagają HTTPS**. Wgraj cztery pliki do katalogu, np.
`/var/www/roadtrip`, i skonfiguruj nginx.

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

    # HTML bez agresywnego cache (żeby update dochodził)
    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

> Uwaga: `manifest.json` serwujemy z typem `application/manifest+json`. Jeśli
> wolisz rozszerzenie `.webmanifest`, zmień nazwę pliku i odnośnik
> `<link rel="manifest" href="./app.webmanifest">` w `index.html` — blok
> `types {}` powyżej obsługuje oba.

Sprawdź i przeładuj:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 2. HTTPS przez certbot (Let's Encrypt)

```bash
# Debian/Ubuntu
sudo apt update && sudo apt install -y certbot python3-certbot-nginx

# Wystaw certyfikat i automatycznie skonfiguruj nginx na 443 + redirect z 80
sudo certbot --nginx -d roadtrip.twojadomena.pl

# Test automatycznego odnawiania
sudo certbot renew --dry-run
```

Certbot dopisze `listen 443 ssl;` i ścieżki do certyfikatu w bloku powyżej oraz
ustawi przekierowanie HTTP→HTTPS. Po tym otwórz
`https://roadtrip.twojadomena.pl` w Safari.

### 3. Aktualizacja apki

Wgraj zmienione pliki i (z racji `no-cache` na `sw.js`) przy następnym
otwarciu service worker pobierze nową wersję i wyczyści stary cache.

---

## Dodanie do ekranu głównego iPhone (Safari)

1. Otwórz `https://roadtrip.twojadomena.pl` w **Safari** (nie w Chrome — na iOS
   tylko Safari instaluje PWA).
2. Dotknij ikony **Udostępnij** (kwadrat ze strzałką w górę).
3. Wybierz **„Do ekranu głównego” / „Add to Home Screen”**.
4. Potwierdź nazwę → na pulpicie pojawi się ikona 🛣️ „Roadtrip”.
5. Uruchom z ikony — apka działa pełnoekranowo (standalone), bez paska Safari.

Przy pierwszym „Gdzie jestem” Safari zapyta o dostęp do lokalizacji —
zezwól (na iPhone GPS jest dokładny; na MacBooku pozycja z WiFi jest
przybliżona, ale wystarcza do planowania).

> 💡 Niezależnie od apki: włącz **Ustawienia → Powiadomienia → Alerty
> rządowe / Wireless Emergency Alerts**. To one obudzą Cię przy Flash Flood
> czy ewakuacji.

---

## Edycja danych tras i przełączanie tras

### Przełączanie aktywnej trasy
W nagłówku apki przyciski **DOLNA / GÓRNA**. Wybór zapisuje się w
`localStorage` (`rt_route`), domyślnie `LOWER`. Werdykt i kafle przeliczają się
od razu.

### Edycja planu (`TRIP_DATA`)
Wszystkie dane są na górze `<script>` w `index.html`, w dwóch tablicach:

- `TRIP_DATA_LOWER` — pełna trasa dolna, 21 dni.
- `UPPER_OVERRIDE` — tylko dni, w których trasa górna różni się od dolnej
  (5–9). `TRIP_DATA_UPPER` budowane jest automatycznie: bierze dolną i
  podmienia te dni.

Format jednego dnia:

```js
{
  day: 6,
  date: "2026-06-02",
  from: { name:"Alamogordo", lat:32.78, lng:-106.17 },
  to:   { name:"Tucson",     lat:32.22, lng:-110.97 },
  driveHours: 5,                 // godziny jazdy (dziesiętnie, np. 3.5)
  activity: "White Sands o świcie…",
  sleep: "Tucson",
  knownRisks: ["heat","wind"],   // informacyjnie
  anchor: true                   // opcjonalnie — kotwica (Phoenix 5.06)
}
```

- **`driveKm` nie podajesz** — liczone w kodzie funkcją `haversine` z
  współrzędnych `from`/`to`.
- Współrzędne `lat`/`lng` w stopniach dziesiętnych (zachód = ujemne `lng`).
- Aby dodać/zmienić dzień różniący trasy: edytuj wpis w `UPPER_OVERRIDE` pod
  kluczem = numer dnia. Aby trasy były wspólne tego dnia — usuń wpis z
  `UPPER_OVERRIDE`.

### Ręczne nadpisanie bieżącego dnia (test/debug)
W konsoli przeglądarki:

```js
localStorage.setItem('rt_dayOverride', '6');  // wymuś dzień 6
location.reload();
localStorage.removeItem('rt_dayOverride');     // powrót do auto-dnia
```

### Inne progi i ustawienia (w `index.html`)
- Progi pogody/werdyktu: funkcje `assessRoute()` i `renderTiles()`
  (`>37°C` upał, `>40 km/h` wiatr, pożar `<50` / `50–150` / `<250` km).
- Optymalna godzina wyjazdu: `optimalDeparture()` (dojazd przed 12:00,
  min. 5:30).
- Filtr alertów NWS: stała `ALERT_FILTER`.

---

## Scenariusze testowe (logika werdyktu)

Logika `computeVerdict()` była weryfikowana m.in. dla:

- czysto → 🟢 JEDŹ + optymalna godzina,
- dół gorący (41°C) a góra OK (26°C) → 🟡 rekomenduje GÓRNĄ + koszt czasu,
- NWS warning na aktywnej trasie, druga czysta → 🔴 ZMIEŃ NA TRASĘ X,
- pożar < 50 km od jednej trasy → 🔴 + rekomendacja drugiej,
- warning na obu trasach → 🔴 OBA WARIANTY — zostań,
- wszystkie API padły → 🟡 „Nie mogę zweryfikować” (nie eskaluje do 🔴),
- user poza planem → wskazanie najbliższego punktu.

Werdykt jest **konserwatywny**: lepiej fałszywy 🟡 niż przeoczony 🔴. Apka
ostrzega i rekomenduje trasę, ale **nie liczy auto-objazdów** — od tego jest
nawigacja.
