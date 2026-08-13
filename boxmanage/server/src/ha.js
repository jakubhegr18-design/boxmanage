// Propojení s Home Assistant (pouze v režimu add-onu).
// Add-on volá Home Assistant Core API přes interní proxy supervisoru:
//   http://supervisor/core/api/...  s Bearer tokenem ze $SUPERVISOR_TOKEN.
// Mimo Home Assistant (lokální vývoj) není HA dostupné a funkce vrací chybu.

const HA_BASE = process.env.SUPERVISOR_TOKEN ? 'http://supervisor/core/api' : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function haAvailable() {
  return !!HA_BASE;
}

function haError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function haFetch(path, { method = 'GET', body } = {}) {
  if (!HA_BASE) {
    throw haError(503, 'Home Assistant není dostupný (server běží mimo HA add-on).');
  }
  const res = await fetch(`${HA_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.SUPERVISOR_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw haError(res.status, `Home Assistant odpověděl chybou (${res.status})`);
  }
  return res.json().catch(() => ({}));
}

function entityDomain(entityId) {
  const i = String(entityId).indexOf('.');
  return i > 0 ? entityId.slice(0, i) : '';
}

async function getEntityState(entityId) {
  try {
    return await haFetch(`/states/${entityId}`);
  } catch (err) {
    if (err.status === 404) {
      throw haError(404, `Entita ${entityId} v Home Assistant neexistuje.`);
    }
    throw err;
  }
}

async function callService(domain, service, data) {
  return haFetch(`/services/${domain}/${service}`, { method: 'POST', body: data });
}

async function setEntity(entityId, on) {
  const domain = entityDomain(entityId);
  if (!domain) throw haError(400, `Neplatný ID entity: ${entityId}`);
  await callService(domain, on ? 'turn_on' : 'turn_off', { entity_id: entityId });
}

// Rozsvítí světlo lokace (např. při naskenování krabice). Best-effort — volající
// se rozhodne, jestli chyba má ovlivnit samotnou operaci.
async function turnOnLight(entityId) {
  if (!entityId) return { ok: false, error: 'Není nastavené světlo' };
  await setEntity(entityId, true);
  return { ok: true };
}

// Zabliká světlem (několik cyklů zapnuto/vypnuto) a pak obnoví původní stav.
// Zvládá entity light.* i switch.* (doménu určí z ID entity).
async function blinkLight(entityId, { cycles = 3, onMs = 600, offMs = 500 } = {}) {
  if (!entityId) throw haError(400, 'Není nastavené světlo pro tuto lokaci.');

  let wasOn = false;
  try {
    const st = await getEntityState(entityId);
    wasOn = st.state === 'on';
  } catch (err) {
    if (err.status === 404) throw err;
    // Stav nelze zjistit (unavailable/unknown) — zkusíme blinknout naslepo.
  }

  for (let i = 0; i < cycles; i++) {
    await setEntity(entityId, true);
    await sleep(onMs);
    await setEntity(entityId, false);
    if (i < cycles - 1) await sleep(offMs);
  }

  await setEntity(entityId, wasOn);
  return { ok: true, wasOn };
}

module.exports = { haAvailable, blinkLight, turnOnLight };
