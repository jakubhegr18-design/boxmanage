# Changelog

## 1.0.14 (2026-08-13)

### Opravy
- **Web byl po 1.0.13 nedostupný (ERR_CONNECTION_REFUSED)**: Caddyfile obsahoval
  neplatnou syntaxi `encode gzip { not_path … }` — blok za `encode` přijímá jen
  encoder moduly, takže Caddy hledal neexistující modul `http.encoders.not_path`
  a nenastartoval se. Web na portu 8090 proto odmítal připojení jak po aktualizaci,
  tak u nové instalace (Node běžel, ale Caddy ne). Oprava: vyloučení SSE streamu
  přes pojmenovaný matcher `@notstream`.
- **Viditelnější selhání Caddy**: `run.sh` teď po startu Caddy zkontroluje, že
  proces žije — když Caddy spadne (špatná konfigurace), add-on skončí s chybou
  a v HA se zobrazí *Neúspěšný* místo *Spuštěno* s mrtvým proxy.

## 1.0.13 (2026-08-13)

### Novinky
- **Dálkový skener (předělán)**: nové párování QR kódem i ručním 6místným kódem,
  fronta skenů s odškrtáváním (✓), živý přenos přes SSE (Server-Sent Events) —
  skeny přicházejí okamžitě, bez obnovování. Při novém skenu hraje na PC zvuk
  (pípnutí) a objeví se systémová notifikace. Kód i QR na PC zůstávají po celou
  dobu skenování.
- **Fotky krabic a položek**: do detailu krabice lze nahrát fotky krabice i
  jednotlivých položek (z mobilu nebo PC). V seznamu krabic se zobrazuje náhled
  první fotky. Fotky jsou chráněné tokenem, originály i zmenšené náhledy se
  ukládají do `config/photos`.
- **Telegram — lepší upozornění na nízký stav**: zpráva obsahuje pozici, lokaci
  a přikládá fotku krabice; upozornění lze vypnout nebo nastavit limit u každé
  položky zvlášť (přepínač „Upozorňovat na nízký stav“ v detailu krabice).
- **Home Assistant — světla**: v *Lokace* lze k lokaci přiřadit světlo/switch
  (entity) a povolit **rozsvícení při naskenování** krabice. Tlačítko *Najít*
  v detailu krabice a *Testovat světlo* v lokaci zablikají světlem (3×), aby se
  krabice dala najít ve tmě. Funguje v HA add-onu (`homeassistant_api: true`);
  mimo HA server hlásí „Home Assistant není dostupný“.

## 1.0.12 (2026-08-11)

### Novinky
- **Dotaz na adresu serveru při spuštění**: mobilní aplikace se před načtením
  zeptá na IP adresu a port add-onu (`https://IP:8090`), když ještě není server
  nastavený. Dialog nejde při prvním spuštění zavřít — aplikace se nepustí dál,
  dokud adresu nezadáš.
- Když se nelze připojit (špatná adresa, vypnutý server), aplikace znovu nabídne
  dialog pro opravu IP adresy a portu.
- Adresa má oddělená pole pro IP adresu/doménu a port, včetně tlačítka
  *Otestovat* (stejné jako v Nastavení).

## 1.0.11 (2026-08-11)

### Novinky
- **Jeden port 8090 (HTTPS)**: mobilní aplikace už nepotřebuje samostatný HTTP port
  8092. Android aplikace teď akceptuje self-signed HTTPS certifikát add-onu, takže
  web i mobil běží na jedné adrese `https://IP:8090`.
- Adresa serveru se zadává jako `https://192.0.2.10:8090`; staré uložené HTTP
  adresy s portem 8092 se přepíšou automaticky.
- Po aktualizaci add-onu na 1.0.11 je port 8092 odstraněný — nastav adresu
  `https://IP:8090` (v aplikaci i v dálkovém skeneru).

## 1.0.10 (2026-08-11)

### Novinky
- **Nastavení štítku (QR)**: v *Nastavení → Štítek (QR)* lze vypnout zobrazení
  názvu krabice a/nebo pozice na štítku — stačí QR kód, případně jen pozice
  (např. A2) + QR. Týká se stažení PNG i tisku přes Bluetooth. Na stránce
  *Tisk štítků* jde navíc název a pozici přepínat pro každý tisk zvlášť.

## 1.0.9 (2026-08-11)

### Novinky
- **Dálkový skener**: nová stránka *Dálkový skener* — na PC zobrazí QR kód s adresou
  serveru. Po naskenování v mobilní aplikaci se server nastaví automaticky a zapne
  se dálkový režim. Skenované krabice a změny z mobilu se na PC zobrazují živě
  (obnova každé 2 s, nové položky jsou zvýrazněné); kliknutím se krabice otevře
  pro úpravu.
- Mobilní aplikace: stránka *Sken* má přepínač **Dálkový režim** a rozumí
  párovacímu QR kódu z PC.
- Historie pohybů má čitelné české štítky (dřív se v detailu krabice zobrazovaly
  syrové názvy akcí).

## 1.0.8 (2026-08-11)

### Novinky
- **Telegram — upozornění na nízký stav**: u položky v detailu krabice lze nastavit
  limit („Upozornit při nízkém stavu“). Jakmile množství klesne na nebo pod limit,
  pošle se do vybraného chatu zpráva (krabice, pozice, položka, zbývající množství).
  Token bota a chat ID se nastavují v *Nastavení → Telegram* (pouze admin), včetně
  tlačítka pro odeslání testovací zprávy. Opakování upozornění je omezeno na jedno
  za 24 h; když stav klesne pod limit, přijde hned.

## 1.0.7 (2026-08-11)

### Opravy
- **Přihlášení ve webovém prohlížeči**: adresa serveru se používá jen v nativní
  mobilní aplikaci. V prohlížeči (PWA) se vždy volá na stejný origin — dřív
  uložená HTTP adresa způsobovala z HTTPS stránky blokování „mixed content“
  a přihlášení končilo „Failed to fetch“.
- Pole „Adresa serveru“ se zobrazuje pouze v mobilní aplikaci (na přihlašovací
  stránce i v Nastavení).
- Selhání zápisu do historie pohybů už neshodí samotnou operaci (500).

## 1.0.6 (2026-08-11)

### Opravy
- **Přihlášení z mobilní aplikace**: server posílá CORS hlavičky, takže nativní
  aplikace (origin `https://localhost`) se může připojit na HTTP adresu add-onu.
- Adresa serveru bez protokolu (např. `192.0.2.10:8092`) se automaticky
  doplní na `http://…`.

## 1.0.5 (2026-08-11)

### Opravy
- **Přihlášení v mobilní aplikaci**: přihlašovací stránka obsahuje pole
  **Adresa serveru** (s testem připojení), takže jde zadat IP adresu serveru
  ještě před přihlášením — dřív šla adresa nastavit až po přihlášení, což při
  špatné adrese znemožnilo přihlášení úplně.

## 1.0.4 (2026-08-11)

### Novinky
- **Vlastní QR kód / ID krabice**: při vytváření krabice lze zadat ID ze starého
  QR štítku (např. `ZZ-300987716`), takže stávající štítky z jiného software
  fungují i v BoxManage. Po naskenování neznámého QR se ID předvyplní samo,
  backend kontroluje kolize (HTTP 409).
- **Mobilní aplikace (Android APK / Capacitor)**: přímý tisk QR štítků přes
  Bluetooth LE na Cat-Printer termotiskárny (FunPrint protokol) — stránka
  `/print-ble/:id`, nastavení šířky papíru/energie/převrácení, progress bar.
- **HTTP port 8092** pro mobilní aplikaci (self-signed HTTPS certifikát
  nefunguje v Android WebView). Adresa serveru se nastavuje v *Nastavení*.
- **Potvrzení smazání krabice**: mazání krabice vyžaduje potvrzení dialogem.

### Opravy
- Vyhledávání krabic posílá správný parametr `search` do API.
- TLS handshake: self-signed certifikát se správným SAN = IP hostitele.
- Historie: znaménko mínus u odebraného množství, čitelný Detail v XLSX exportu.
- Chyby ze serveru při mazání se zobrazují uživateli.

## 1.0.3 a starší

Předchozí verze: redesign UI (dark mode, SVG ikony, sidebar, FAB), publikování
add-onu jako prebuilt image (GHCR + CI), restrukturalizace pro HA repository,
základní inventura krabic s QR kódy.
