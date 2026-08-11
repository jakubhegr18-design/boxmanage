# Changelog

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
