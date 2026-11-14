// Webhook Stripe (STRIPE_WEBHOOK_SECRET) : confirmations de commande, impayés, résiliations.
// Événements à cocher dans Stripe : checkout.session.completed, invoice.payment_failed, customer.subscription.deleted
const { stripe, sendMail, site, team, reportBug } = require("./_lib");
const { webhookSecret } = require("./_setup");
const store = require("./_store");
const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SVC = { midi: "le midi", soir: "le soir", "midi-soir": "midi et soir" };
const JN = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const fmtDate = (iso) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "");
const eur = (c) => (c / 100).toFixed(2).replace(".", ",") + " €";

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  let ev;
  try {
    ev = stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], await webhookSecret());
  } catch (e) { return res.status(400).send("Signature invalide"); }
  try {
    const o = ev.data.object;
    if (ev.type === "checkout.session.completed" && o.metadata && o.metadata.service) {
      const m = o.metadata, email = o.customer_details && o.customer_details.email;
      const jours = String(m.jours || "").split("").map((d) => JN[+d]).join(", ");
      const recap = `<p><b>${SVC[m.service] || m.service}</b>, ${esc(jours)}, ${m.personnes === "2" ? "2 personnes" : "1 personne"}.<br>Livraison à : ${esc(m.livre_adresse)}<br>Première livraison : <b>${esc(fmtDate(m.premiere_livraison))}</b>${m.essai ? "<br>Semaine d'essai, sans abonnement." : ""}</p>`;
      if (email) await sendMail(email, "Votre commande Resto Pickup est confirmée",
        `<p>Bonjour,</p><p>Merci pour votre confiance. Votre commande est bien enregistrée :</p>${recap}<p>Le livreur sonne et remet les repas en main propre. S'il n'y a personne, il appelle ${m.pour === "proche" ? "votre proche, puis vous" : "le numéro indiqué"}.</p><p>Absence, changement de repas, factures : tout se fait depuis <a href="${site()}/mon-compte.html">votre espace</a>, ou au 06 60 68 05 07.</p>`).catch((e) => console.error(e));
      await sendMail(team(), `Nouvelle commande : ${m.livre_nom || email}`, `${recap}<p>Tél. livraison : ${esc(m.livre_tel)}<br>Consignes : ${esc(m.consignes) || "aucune"}${m.payeur ? `<br>Payeur : ${esc(m.payeur)}` : ""}<br>Montant : ${eur(o.amount_total || 0)}${m.canal === "telephone" ? "<br>Commande prise au téléphone" : ""}</p><p><a href="${site()}/admin.html">Ouvrir l'admin</a></p>`).catch((e) => console.error(e));
    }
    if (ev.type === "checkout.session.completed" && !(o.metadata && o.metadata.service) && o.payment_intent) {
      const pi = await stripe.paymentIntents.retrieve(o.payment_intent);
      const g = pi.metadata || {};
      if (g.code_cadeau) await sendMail(team(), `Carte cadeau vendue : ${g.repas} repas`, `<p><b>${esc(g.de)}</b> offre <b>${esc(g.repas)} repas</b> à <b>${esc(g.pour)}</b>.</p><p>Code : <b>${esc(g.code_cadeau)}</b><br>Montant : ${eur(o.amount_total || 0)}<br>Acheteur : ${esc((o.customer_details && o.customer_details.email) || "")}</p><p><a href="${site()}/admin.html">Ouvrir l'admin</a></p>`).catch((e) => console.error(e));
    }
    if (ev.type === "checkout.session.async_payment_failed") {
      const email = o.customer_details && o.customer_details.email, m = o.metadata || {};
      if (email) await sendMail(email, "Votre prélèvement Resto Pickup n'est pas passé", `<p>Bonjour,</p><p>Le prélèvement de ${eur(o.amount_total || 0)} pour votre commande a été refusé par la banque. Votre livraison n'est pas confirmée.</p><p>Appelez-nous au 06 60 68 05 07 : nous trouvons une solution ensemble, par carte ou par un nouveau prélèvement.</p>`).catch((e) => console.error(e));
      await sendMail(team(), `Prélèvement refusé : ${m.livre_nom || email}`, `<p>Le prélèvement SEPA de ${eur(o.amount_total || 0)} a échoué. <b>Ne pas livrer</b> avant d'avoir appelé le client.</p><p>Tél. livraison : ${esc(m.livre_tel)}<br>Adresse : ${esc(m.livre_adresse)}</p>`).catch(() => {});
    }
    if (ev.type === "invoice.payment_failed") {
      const c = await stripe.customers.retrieve(o.customer);
      if (c.email) await sendMail(c.email, "Votre paiement Resto Pickup n'est pas passé",
        `<p>Bonjour,</p><p>Le paiement de ${eur(o.amount_due)} pour vos repas de la semaine n'a pas pu être effectué. Cela arrive, par exemple quand une carte expire.</p><p><a href="${o.hosted_invoice_url}">Régler en un clic</a>, ou mettez à jour votre carte ou votre IBAN depuis <a href="${site()}/mon-compte.html">votre espace</a>.</p><p>Une question ? Appelez-nous au 06 60 68 05 07.</p>`).catch((e) => console.error(e));
      await sendMail(team(), `Impayé : ${c.name || c.email}`, `<p>Paiement refusé : ${eur(o.amount_due)}. Le client a reçu un lien pour régler.</p><p><a href="${site()}/admin.html#client=${o.customer}">Voir la fiche</a></p>`).catch(() => {});
    }
    if (ev.type === "customer.subscription.deleted") {
      const c = await stripe.customers.retrieve(o.customer);
      await sendMail(team(), `Abonnement arrêté : ${(o.metadata && o.metadata.livre_nom) || c.name || c.email}`, `<p>L'abonnement est terminé. Pensez à l'appeler pour comprendre pourquoi.</p><p><a href="${site()}/admin.html#client=${o.customer}">Voir la fiche</a></p>`).catch(() => {});
    }
    await store.set(`evt/${Date.now()}-${ev.type}`, { type: ev.type, id: o.id, client: o.customer || null, date: new Date().toISOString() }).catch(() => {});
    return res.status(200).json({ received: true });
  } catch (e) { console.error(e); await reportBug("webhook Stripe " + (ev && ev.type), e); return res.status(500).json({ error: "Erreur" }); }
};
