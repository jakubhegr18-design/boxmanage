# 📦 BoxManage

![Status](https://img.shields.io/badge/status-Beta-orange)

> ⚠️ **Beta verze** — projekt je funkční, ale ještě se ladí. Data zálohuj, ohlášuj chyby
> a požadavky na funkce v [Issues](https://github.com/jakubhegr18-design/boxmanage/issues).

Inventura krabic s QR kódy pro domácnost/dílnu. Vytiskneš QR štítky, nalepíš na krabice a pak je skenuješ mobilem. Webová aplikace (React PWA) + Node.js backend s SQLite databází, funguje jako **Home Assistant app (add-on)**.

## Instalace jedním klikem

[![Přidat repozitář do Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fjakubhegr18-design%2Fboxmanage)

Tlačítko přidá repozitář do Home Assistant. Pak stačí **Nastavení → Doplňky → obchod**,
vyhledat **BoxManage**, nainstalovat a spustit. Podrobný postup níže.

## Funkce

- 🏷️ **QR štítky** — tisk na A4 samolepicí papír (2–4 sloupce, libovolný počet kopií)
- 📷 **Skenování mobilem** — kamera v prohlížeči, funguje na HTTPS (self-signed cert zajišťuje Caddy)
- 📦 **Krabice** — název, popis, obsah s množstvím a jednotkou, vyhledávání
- 🗺️ **Pozice A1/B2/C3…** — rychlá klávesnice pozic, hledání podle pozice
- 📍 **Lokace** — garáž, sklad, regál… přesun krabice
- 📜 **Historie** — kdo a kdy co přidal/vydal/přesunul
- 👥 **Uživatelé** — admin + běžní uživatelé, přihlašování
- 📤 **Export** — CSV i XLSX (Excel)
- 📱 **PWA** — aplikace se dá nainstalovat na telefon/PC

## Struktura

```
repository.yaml          <- konfigurace HA repozitáře (povinné)
boxmanage/               <- Home Assistant app (add-on)
  config.yaml            <- konfigurace add-onu
  Dockerfile             <- sestavení (Node + Caddy self-signed HTTPS)
  server/                <- Node.js + Express API + SQLite (node:sqlite)
  web/                   <- React + Vite + PWA frontend
start.bat                <- lokální spuštění na Windows
```

## Lokální spuštění (vývoj)

```bash
# backend
cd boxmanage/server
npm install
npm start            # http://localhost:8090

# frontend (v jiném terminálu)
cd boxmanage/web
npm install
npm run dev          # http://localhost:5173  (proxy na /api -> :8090)

# produkční build webu
cd boxmanage/web && npm run build
# pak stačí běžet jen server (servíruje i web)
```

Na Windows stačí poklepat na **`start.bat`** (nainstaluje, sestaví a spustí na http://localhost:8090).

Výchozí účet: **admin / admin** (změň ho v Nastavení).

## Instalace do Home Assistant OS

1. Klikni na tlačítko **[Přidat repozitář](#instalace-jednim-klikem)** výše, nebo ručně:
   Nastavení → **Doplňky (Add-ons)** → tři tečky → **Repozitáře**
2. Přidej adresář: `https://github.com/jakubhegr18-design/boxmanage`
3. Vyhledej **BoxManage** → **Instalovat** (stáhne hotový image z GHCR) → **Spustit**
4. Otevři `https://<IP_HA>:8090` (mobil/PC ve stejné síti)

> ⚠️ Web běží na **HTTPS se self-signed certifikátem** (generuje Caddy v add-onu). Při prvním
> otevření na mobilu/PC odsouhlas certifikát („Pokračovat na stránku”). Bez toho prohlížeč
> nepovolí kameru pro skenování QR. Zápis `http://…` se sám přesměruje na `https://…`.

> ℹ️ Add-on je distribuován jako hotový image (GHCR) — instalace je rychlá, nic se na HA nesestavuje.
> Data se ukládají do `/data` (SQLite) a přežijí restart i aktualizaci.

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
