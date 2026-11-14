// Vérifie et crée la configuration Stripe (tarifs, webhook, portail client). Réservé à l'équipe connectée.
const { verifyAdmin, team } = require("./_lib");
const { setupAll } = require("./_setup");
module.exports = async (req, res) => {
  if (!verifyAdmin(req)) return res.status(401).json({ error: "Connectez-vous à l'espace équipe" });
  const out = { stripe: !!process.env.STRIPE_SECRET_KEY, brevo: !!process.env.BREVO_API_KEY, alertes: team() };
  try { Object.assign(out, await setupAll()); out.ok = true; }
  catch (e) { out.ok = false; out.erreur = e.message; }
  return res.status(200).json(out);
};
