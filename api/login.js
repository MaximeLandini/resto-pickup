// Étape 1 : le client donne son e-mail, on lui envoie un code à 6 chiffres (rien n'est stocké hors de Stripe).
const { stripe, hmac, body, findCustomer, sendCode } = require("./_lib");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { email } = body(req);
    const c = await findCustomer(email);
    if (c) {
      const code = String(require("crypto").randomInt(0, 1e6)).padStart(6, "0");
      await stripe.customers.update(c.id, { metadata: { login_hash: hmac(code + c.id), login_exp: String(Date.now() + 15 * 60e3) } });
      await sendCode(c.email, code);
    }
    return res.status(200).json({ ok: true }); // même réponse que le compte existe ou non
  } catch (e) { console.error(e); await require("./_lib").reportBug("/api/login", e); return res.status(500).json({ error: "Envoi impossible" }); }
};
