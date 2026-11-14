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
    if (!b.code) {
      if (allowed.includes(email)) {
        const code = String(crypto.randomInt(0, 1e6)).padStart(6, "0");
        await store.set(key, { h: hmac(code + email), exp: Date.now() + 15 * 60e3, essais: 0 });
        await sendCode(email, code, { equipe: true });
      }
      return res.status(200).json({ ok: true });
    }
    const r = await store.get(key);
    if (!r || r.exp < Date.now() || r.essais >= 5) return res.status(401).json({ error: "Code expiré" });
    if (hmac(String(b.code).trim() + email) !== r.h) { r.essais++; await store.set(key, r); return res.status(401).json({ error: "Code incorrect" }); }
    await store.del(key);
    return res.status(200).json({ token: signAdmin(email) });
  } catch (e) { console.error(e); await require("./_lib").reportBug("/api/admin-login", e); return res.status(500).json({ error: "Erreur" }); }
};
