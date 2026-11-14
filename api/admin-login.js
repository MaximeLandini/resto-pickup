// Connexion à l'espace admin : e-mail autorisé (ADMIN_EMAILS) → code à 6 chiffres → jeton équipe de 12 h.
const crypto = require("crypto");
const { hmac, body, signAdmin, sendCode, adminEmails } = require("./_lib");
const store = require("./_store");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const b = body(req), email = String(b.email || "").trim().toLowerCase();
    const allowed = adminEmails();
    const key = `adminlogin/${hmac(email).slice(0, 24)}`;
    // verrou par adresse : 5 codes et 10 erreurs maximum par heure, puis blocage 1 h
    const lk = `adminlock/${hmac(email).slice(0, 24)}`;
    const lock = (await store.get(lk)) || { t: Date.now(), codes: 0, erreurs: 0 };
    if (Date.now() - lock.t > 3600e3) Object.assign(lock, { t: Date.now(), codes: 0, erreurs: 0 });
    if (lock.erreurs >= 10 || (!b.code && lock.codes >= 5)) return res.status(429).json({ error: "Trop de tentatives, réessayez dans une heure" });
    if (!b.code) {
      if (allowed.includes(email)) {
        lock.codes++; await store.set(lk, lock);
        const code = String(crypto.randomInt(0, 1e6)).padStart(6, "0");
        await store.set(key, { h: hmac(code + email), exp: Date.now() + 15 * 60e3, essais: 0 });
        await sendCode(email, code, { equipe: true });
      }
      return res.status(200).json({ ok: true });
    }
    const r = await store.get(key);
    if (!r || r.exp < Date.now() || r.essais >= 5) { lock.erreurs++; await store.set(lk, lock); return res.status(401).json({ error: "Code expiré, demandez-en un nouveau" }); }
    if (hmac(String(b.code).trim() + email) !== r.h) { r.essais++; await store.set(key, r); lock.erreurs++; await store.set(lk, lock); return res.status(401).json({ error: "Code incorrect" }); }
    await store.del(key);
    return res.status(200).json({ token: signAdmin(email) });
  } catch (e) { console.error(e); await require("./_lib").reportBug("/api/admin-login", e); return res.status(500).json({ error: "Erreur" }); }
};
