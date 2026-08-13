# BoxManage

> ⚠️ **Beta verze** — funguje, ale stále se ladí. O chyby a náměty napiš do
> [Issues](https://github.com/jakubhegr18-design/boxmanage/issues).

Inventura krabic s QR kódy. Vytiskni QR štítky, nalep na krabice a skenuj je mobilem.

## Použití

1. Po instalaci a spuštění otevři **https://<IP_HA>:8090** z PC nebo mobilu ve stejné síti.
2. **Přihlas se** — výchozí účet `admin` / `admin`, heslo změň v *Nastavení*.
3. **Nová** → vytvoř krabici, zadej pozici (A1, B2, C3…) a lokaci.
4. **Tisk** → vyber krabice a vytiskni štítky na samolepicí A4. Nalep na krabice.
5. **Sken** (mobil) → namiř na QR kód, krabice se otevře. Přidávej/odebírej kusy, přesouvej.
6. **Export** → stáhni celou inventuru jako CSV/XLSX do Excelu.

## Dálkový skener

Když skenuješ z mobilu a krabice jsou jinde (garáž, sklep), otevři na PC stránku
**Dálkový skener**:

1. Na PC se zobrazí párovací QR kód a 6místný ruční kód.
2. V mobilní aplikaci přejdi na **Sken** a buď naskenuj párovací QR, nebo zadej
   ruční kód do pole *Kód ze skeneru* a stiskni **Připojit** (musíš být přihlášený,
   telefon a PC ve stejné síti).
3. Teď skenuj QR kódy na krabicích — každý sken se na PC objeví **okamžitě** (živý
   přenos SSE) s pípnutím a systémovou notifikací.
4. Nalezené/vyřízené krabice na PC odškrtni tlačítkem ✓ — přehled, co je hotové,
   zůstává na obrazovce, dokud relaci nezrušíš tlačítkem *Nový kód*.

## Fotky krabic a položek

V detailu krabice je sekce **Fotky krabice** a u každé položky **Fotky položky**.
Nahráváš z mobilu nebo PC (náhledy se vytvoří automaticky). První fotka krabice se
zobrazí jako náhled v seznamu krabic. Fotky jsou uložené v `/data/photos` a servírují
se jen s platným přihlášením.

## Telegram — upozornění na nízký stav

1. V *Nastavení → Telegram* zadej bot token (od @BotFather) a chat ID, kam mají
   zprávy chodit, a stiskni **Odeslat testovací zprávu**.
2. V detailu krabice zapni u položky přepínač **Upozorňovat na nízký stav** a nastav
   limit. Jakmile množství klesne na nebo pod limit, přijde zpráva s názvem krabice,
   pozicí, lokací, položkou a zbývajícím množstvím + fotkou krabice.
3. Opakování je omezené na jedno za 24 h; když stav klesne pod limit, přijde hned.

## Home Assistant — světla

K lokaci lze přiřadit světlo/switch (např. `light.garage`) v *Lokace → upravit*:

- **Rozsvítit při naskenování** — po naskenování krabice mobilem se světlo rozsvítí.
- **Testovat světlo** — zabliká 3× (600 ms svítí / 500 ms nesvítí) a vrátí předchozí stav.
- V detailu krabice je tlačítko **Najít** — světlo lokace zabliká, takže krabici najdeš
  ve tmě (světlo musí být dostupné přes HA Supervisor API, funguje jen v add-onu).

## Tisk jedné krabice jako obrázek (termotiskárna Cat Printer)

Na detailu krabice je tlačítko **Stáhnout PNG** — stáhne QR štítek dané krabice jako
obrázek PNG (384 px, QR + název + pozice). Pro tisk na Bluetooth termotiskárnu:

1. Stáhni PNG tlačítkem na detailu krabice.
2. Otevři Cat-Printer klienta na Windows: https://github.com/NaitLee/Cat-Printer
3. V jeho webovém rozhraní nahraj/přetáhni stažený obrázek a vytiskni.

## HTTPS a kamera

Web běží na HTTPS se **self-signed certifikátem** (generuje Caddy). Při prvním otevření na
telefonu/PC odsouhlas certifikát — bez toho prohlížeč nepovolí kameru pro skenování QR.
Když zapíšeš `http://…`, add-on tě sám přesměruje na `https://…`.

## Data

Vše je uloženo v `/data` (SQLite) — data přežijí restart i aktualizaci add-onu a jsou součástí záloh.
