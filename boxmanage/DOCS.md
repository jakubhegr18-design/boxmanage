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

## HTTPS a kamera

Web běží na HTTPS se **self-signed certifikátem** (generuje Caddy). Při prvním otevření na
telefonu/PC odsouhlas certifikát — bez toho prohlížeč nepovolí kameru pro skenování QR.
Když zapíšeš `http://…`, add-on tě sám přesměruje na `https://…`.

## Data

Vše je uloženo v `/data` (SQLite) — data přežijí restart i aktualizaci add-onu a jsou součástí záloh.
