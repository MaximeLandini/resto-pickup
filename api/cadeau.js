// Carte cadeau : POST = ouvre le paiement Stripe ; GET ?id=<session> = renvoie la carte une fois payée
// (et l'envoie par e-mail à l'acheteur la première fois).
const { stripe, body, site } = require("./_lib");
const { GIFT_UNIT, clean, esc, sendMail, giftCode, fail } = require("./_commande");

const VALIDITE_JOURS = 365;
const fmt = (c) => (c / 100).toFixed(2).replace(".", ",") + " €";

module.exports = async (req, res) => {
  try {
    if (req.method === "POST") {
      const b = body(req);
      const repas = Math.round(+b.repas);
      if (!(repas >= 3 && repas <= 60)) return res.status(400).json({ error: "De 3 à 60 repas" });
      const email = clean(b.email, 120).toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "E-mail invalide" });
      const code = giftCode();
      const meta = {
        type: "carte_cadeau", code_cadeau: code, repas: String(repas),
        de: clean(b.de, 60), pour: clean(b.pour, 60), message: clean(b.message, 240),
        expire: String(Math.floor(Date.now() / 1000) + VALIDITE_JOURS * 86400), envoyee: "",
      };
      const session = await stripe.checkout.sessions.create({
        locale: "fr", mode: "payment", customer_email: email, metadata: meta,
        line_items: [{ quantity: repas, price_data: { currency: "eur", unit_amount: GIFT_UNIT, product_data: { name: "Carte cadeau Resto Pickup, repas livré (plat, dessert et livraison)" } } }],
        payment_intent_data: { metadata: meta, description: `Carte cadeau ${code}, ${repas} repas` },
        success_url: `${site()}/offrir-des-repas.html?carte={CHECKOUT_SESSION_ID}#carte`,
        cancel_url: `${site()}/offrir-des-repas.html`,
      });
      return res.status(200).json({ url: session.url });
    }
    if (req.method === "GET") {
      const id = clean(req.query && req.query.id, 200);
      if (!/^cs_/.test(id)) return res.status(400).json({ error: "Carte introuvable" });
      const s = await stripe.checkout.sessions.retrieve(id, { expand: ["payment_intent"] });
      if (s.payment_status !== "paid" || !s.payment_intent) return res.status(402).json({ error: "Paiement non confirmé" });
      const m = s.payment_intent.metadata;
      const carte = { code: m.code_cadeau, repas: +m.repas, montant: s.amount_total, de: m.de, pour: m.pour, message: m.message, expire: +m.expire };
      if (!m.envoyee && s.customer_details && s.customer_details.email) {
        const lien = `${site()}/offrir-des-repas.html?carte=${id}#carte`;
        await sendMail(s.customer_details.email, require("./_mail").T.cadeauAcheteur(carte, lien));
        await stripe.paymentIntents.update(s.payment_intent.id, { metadata: { envoyee: "1" } });
      }
      return res.status(200).json(carte);
    }
    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (e) {
    return fail(res, e);
  }
};
