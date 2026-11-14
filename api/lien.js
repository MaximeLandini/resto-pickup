// Commande prise au téléphone : l'équipe saisit la commande sur equipe.html et obtient un lien de paiement Stripe
// à envoyer par SMS ou e-mail au client ou à son enfant. Accès : session de l'espace équipe, ou clé ADMIN_KEY.
const crypto = require("crypto");
const { body, verifyAdmin } = require("./_lib");
const { createCheckout, findGift, fail } = require("./_commande");

const okKey = (k) => {
  const a = Buffer.from(String(k || "")), b = Buffer.from(String(process.env.ADMIN_KEY || ""));
  return b.length >= 12 && a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (!verifyAdmin(req) && !okKey(req.headers["x-admin-key"])) return res.status(401).json({ error: "Connectez-vous à l'espace équipe" });
  try {
    const b = body(req);
    if (b.verifier_code) {
      const g = await findGift(b.verifier_code);
      if (!g) return res.status(404).json({ error: "Code inconnu" });
      return res.status(200).json({ code: g.code, montant: g.montant, utilisee: g.utilisee, expiree: g.expiree, de: g.pi.metadata.de, pour: g.pi.metadata.pour });
    }
    b.canal = "telephone";
    const r = await createCheckout(b);
    return res.status(200).json(r);
  } catch (e) {
    return fail(res, e);
  }
};
