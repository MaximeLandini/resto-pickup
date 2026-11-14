// Données de l'espace client : prochaine livraison, formule, adresse, état de l'abonnement.
const { stripe, verifyToken, activeSub, nextDelivery, weekly, ZONES } = require("./_lib");
const store = require("./_store");
module.exports = async (req, res) => {
  const cid = verifyToken(req);
  if (!cid) return res.status(401).json({ error: "Session expirée" });
  try {
    const c = await stripe.customers.retrieve(cid);
    const s = await activeSub(cid);
    const invs = await stripe.invoices.list({ customer: cid, limit: 8 });
    const factures = invs.data.filter((i) => i.status !== "draft").map((i) => ({ date: new Date(i.created * 1000).toISOString().slice(0, 10), montant: i.total / 100, statut: i.status, lien: i.hosted_invoice_url, pdf: i.invoice_pdf }));
    const t = await store.thread(cid).catch(() => ({ messages: [] }));
    const avoir = c.balance < 0 ? -c.balance / 100 : 0;
    if (!s) return res.status(200).json({ nom: c.name, email: c.email, actif: false, factures, messages: t.messages, avoir });
    const m = s.metadata || {};
    const z = ZONES[m.zone] || ZONES["le-mans"];
    let next = nextDelivery(z.jour);
    const pauseJusquau = s.pause_collection && s.pause_collection.resumes_at ? new Date(s.pause_collection.resumes_at * 1000) : null;
    if (pauseJusquau) next = nextDelivery(z.jour, new Date(pauseJusquau.getTime() - 3 * 864e5));
    return res.status(200).json({
      actif: true, nom: m.livre_nom || c.name, email: c.email,
      service: m.service || "soir", jours: m.jours || "1234567", personnes: +m.personnes || 1, jourNom: z.nom, jour: z.jour,
      prochaine: next.toISOString().slice(0, 10), pauseJusquau: pauseJusquau && pauseJusquau.toISOString().slice(0, 10),
      adresse: m.livre_adresse, consignes: m.consignes, tel: m.livre_tel, payeur: m.payeur,
      prixSemaine: weekly(s), statutPaiement: s.status, avoir, factures, messages: t.messages, nonLu: t.nonLuClient || 0,
      prochainPrelevement: s.current_period_end ? new Date(s.current_period_end * 1000).toISOString().slice(0, 10) : null,
    });
  } catch (e) { console.error(e); await require("./_lib").reportBug("/api/account", e); return res.status(500).json({ error: "Erreur" }); }
};
