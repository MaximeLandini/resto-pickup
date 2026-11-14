// Commande en ligne : ouvre la page de paiement Stripe (abonnement hebdomadaire ou semaine d'essai).
// Dans Stripe : activer Carte, Apple Pay, Google Pay et Prélèvement SEPA dans Paramètres > Moyens de paiement.
const { body } = require("./_lib");
const { createCheckout, fail } = require("./_commande");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  try {
    const b = body(req);
    b.canal = "site";
    const r = await createCheckout(b);
    return res.status(200).json({ url: r.url });
  } catch (e) {
    return fail(res, e);
  }
};
