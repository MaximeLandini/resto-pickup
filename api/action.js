// Actions de l'espace client : absence d'une semaine, reprise, changement de formule, adresse, factures.
const { stripe, verifyToken, activeSub, body, nextDelivery, ZONES } = require("./_lib");
const { fee, REPAS_MIN } = require("./_commande");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const cid = verifyToken(req);
  if (!cid) return res.status(401).json({ error: "Session expirée" });
  try {
    const b = body(req);
    if (b.type === "portal") {
      const p = await stripe.billingPortal.sessions.create({ customer: cid, return_url: `${process.env.SITE_URL}/mon-compte.html` });
      return res.status(200).json({ url: p.url });
    }
    const s = await activeSub(cid);
    if (!s) return res.status(404).json({ error: "Aucun abonnement actif" });
    const m = s.metadata || {};
    const z = ZONES[m.zone] || ZONES["le-mans"];
    if (b.type === "skip") {
      // pas de livraison ni de prélèvement la semaine suivante, reprise automatique la semaine d'après
      // absence d'une ou plusieurs semaines (vacances, hospitalisation) : ni livraison ni prélèvement
      const semaines = Math.min(8, Math.max(1, +b.semaines || 1));
      const next = nextDelivery(z.jour);
      const resume = new Date(next.getTime() + (7 * (semaines - 1) + 4) * 864e5);
      const absences = [m.absences, next.toISOString().slice(0, 10)].filter(Boolean).join(",").slice(-480);
      await stripe.subscriptions.update(s.id, { pause_collection: { behavior: "void", resumes_at: Math.floor(resume / 1000) }, metadata: { absences } });
    } else if (b.type === "resume") {
      await stripe.subscriptions.update(s.id, { pause_collection: "" });
    } else if (b.type === "change") {
      const service = ["midi", "soir", "midi-soir"].includes(b.service) ? b.service : "soir";
      const jours = [...new Set(String(b.jours || "").replace(/[^1-7]/g, "").split(""))].sort().join("");
      const personnes = String(b.personnes) === "2" ? 2 : 1;
      const repas = jours.length * (service === "midi-soir" ? 2 : 1) * personnes;
      if (repas < REPAS_MIN) return res.status(400).json({ error: `Minimum ${REPAS_MIN} repas par semaine` });
      // Ligne repas (prix fixe) et ligne livraison (montant recalculé : 2,14 € par repas, 6,43 € min, 15 € max).
      const itRepas = s.items.data.find((i) => i.price.id === process.env.STRIPE_PRICE_REPAS) || s.items.data[0];
      const itLiv = s.items.data.find((i) => i.id !== itRepas.id);
      const liv = { currency: "eur", unit_amount: fee(repas), product: process.env.STRIPE_PRODUCT_LIVRAISON, recurring: { interval: "week" } };
      await stripe.subscriptions.update(s.id, {
        items: [{ id: itRepas.id, quantity: repas }, itLiv ? { id: itLiv.id, price_data: liv, quantity: 1 } : { price_data: liv, quantity: 1 }],
        proration_behavior: "none", metadata: { service, jours, personnes: String(personnes) },
      });
    } else if (b.type === "cadeau") {
      const { findGift } = require("./_commande");
      const g = await findGift(b.code);
      if (!g || g.utilisee || g.expiree) return res.status(400).json({ error: !g ? "Code inconnu" : g.utilisee ? "Code déjà utilisé" : "Code expiré" });
      await stripe.customers.createBalanceTransaction(cid, { amount: -g.montant, currency: "eur", description: `Carte cadeau ${g.code}` });
      await stripe.paymentIntents.update(g.pi.id, { metadata: { utilisee: cid } });
      return res.status(200).json({ ok: true, montant: g.montant / 100 });
    } else if (b.type === "address") {
      await stripe.subscriptions.update(s.id, { metadata: { livre_adresse: String(b.adresse || "").slice(0, 300), consignes: String(b.consignes || "").slice(0, 450) } });
    } else return res.status(400).json({ error: "Action inconnue" });
    return res.status(200).json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: "Erreur" }); }
};
