# 📦 BoxManage

Inventura krabic s QR kódy pro domácnost/dílnu. Vytiskneš QR štítky, nalepíš na krabice a pak je skenuješ mobilem. Webová aplikace (React PWA) + Node.js backend s SQLite databází, funguje jako **Home Assistant add-on**.

## Funkce

- 🏷️ **QR štítky** — tisk na A4 samolepicí papír (2–4 sloupce, libovolný počet kopií)
- 📷 **Skenování mobilem** — kamera v prohlížeči, funguje na HTTPS (self-signed cert zajišťuje Caddy)
- 📦 **Krabice** — název, popis, obsah s množstvím a jednotkou, vyhledávání
- 🗺️ **Pozice A1/B2/C3…** — rychlá klávesnice pozic, hledání podle pozice
- 📍 **Lokace** — garáž, sklad, regál… přesun krabice
- 📜 **Historie** — kdo a kdy co přidal/vydal/přesunul
- 👥 **Uživatelé** — admin + běžní uživatelé, přihlašování
- 📤 **Export** — CSV i XLSX (Excel)
- 📱 **PWA** — aplikace se dá nainstalovat na telefon/pc

## Struktura

```
server/   Node.js + Express API + SQLite (node:sqlite)
web/      React + Vite + PWA frontend
addon/    Home Assistant add-on (Docker + Caddy self-signed HTTPS)
```

## Lokální spuštění (vývoj)

```bash
# backend
cd server
npm install
npm start            # http://localhost:8090

# frontend (v jiném terminálu)
cd web
npm install
npm run dev          # http://localhost:5173  (proxy na /api -> :8090)

# produkční build webu
cd web && npm run build
# pak stačí běžet jen server (servíruje i web)
```

Výchozí účet: **admin / admin** (změň ho v Nastavení).

## Instalace do Home Assistant OS

1. Nastavení → **Doplňky (Add-ons)** → **Přidat doplněk** → **Repository**
2. Přidej adresář: `https://github.com/petrh/boxmanage`
3. Vyhledej **BoxManage** → **Instalovat** → **Spustit**
4. Otevři `https://<IP_HA>:8090` (mobil/PC ve stejné síti)

> ⚠️ Web běží na **HTTPS se self-signed certifikátem**. Při prvním otevření na mobilu/PC odsouhlas certifikát („Pokračovat na stránku”). Bez toho prohlížeč nepovolí kameru pro skenování.

## API přehled

| Metoda | Cesta | Popis |
|---|---|---|
| POST | `/api/auth/login` | přihlášení → JWT |
| GET/POST | `/api/boxes` | seznam (search, location, position) / vytvoření |
| GET/PATCH/DELETE | `/api/boxes/:id` | detail / úprava / smazání |
| POST | `/api/boxes/:id/position` | změna pozice |
| POST | `/api/boxes/:id/move` | přesun do lokace |
| POST | `/api/boxes/:boxId/items` | přidání položky |
| POST | `/api/items/:id/add` `/remove` | +/− množství |
| GET | `/api/locations` | lokace |
| GET | `/api/movements` | historie |
| GET | `/api/stats` | statistiky dashboardu |
| GET | `/api/export/csv` `/xlsx` | export |

## Technologie

- Node.js 24 (`node:sqlite`, žádné nativní moduly)
- Express + JWT + bcryptjs
- React 18 + Vite + vite-plugin-pwa
- qrcode + html5-qrcode
- Caddy (self-signed TLS)
