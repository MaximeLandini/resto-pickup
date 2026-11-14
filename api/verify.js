// Étape 2 : le client saisit le code, il reçoit un jeton de session valable 30 jours.
const { stripe, hmac, body, sign, findCustomer } = require("./_lib");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { email, code } = body(req);
    const c = await findCustomer(email);
    const m = (c && c.metadata) || {};
    if (!c || !m.login_hash || +m.login_exp < Date.now() || hmac(String(code).trim() + c.id) !== m.login_hash)
      return res.status(401).json({ error: "Code incorrect ou expiré" });
    await stripe.customers.update(c.id, { metadata: { login_hash: "", login_exp: "" } });
    return res.status(200).json({ token: sign(c.id) });
  } catch (e) { console.error(e); await require("./_lib").reportBug("/api/verify", e); return res.status(500).json({ error: "Erreur" }); }
};
