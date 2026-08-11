# Changelog

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
- Adresa serveru bez protokolu (např. `192.168.1.123:8092`) se automaticky
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
