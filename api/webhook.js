// Webhook Stripe (STRIPE_WEBHOOK_SECRET) : confirmations de commande, impayés, résiliations.
// Événements à cocher dans Stripe : checkout.session.completed, invoice.payment_failed, customer.subscription.deleted
const { stripe, sendMail, site, team, reportBug } = require("./_lib");
const { webhookSecret } = require("./_setup");
const { T } = require("./_mail");
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
      if (email) await sendMail(email, T.commandeClient(m, o.amount_total || 0)).catch((e) => console.error(e));
      // le payeur et le destinataire peuvent être différents : copie à l'e-mail de la personne livrée si fourni
      if (m.livre_email && m.livre_email !== email) await sendMail(m.livre_email, T.commandeClient(m, o.amount_total || 0)).catch(() => {});
      await sendMail(team(), T.commandeEquipe(m, { email, montant: o.amount_total || 0 })).catch((e) => console.error(e));
    }
    if (ev.type === "checkout.session.completed" && !(o.metadata && o.metadata.service) && o.payment_intent) {
      const pi = await stripe.paymentIntents.retrieve(o.payment_intent);
      const g = pi.metadata || {};
      if (g.code_cadeau) await sendMail(team(), T.cadeauEquipe(g, o.amount_total || 0, o.customer_details && o.customer_details.email)).catch((e) => console.error(e));
    }
    if (ev.type === "checkout.session.async_payment_failed") {
      const email = o.customer_details && o.customer_details.email, m = o.metadata || {};
      if (email) await sendMail(email, T.sepaClient({ montant: o.amount_total || 0 })).catch((e) => console.error(e));
      await sendMail(team(), T.sepaEquipe(m, o.amount_total || 0)).catch(() => {});
    }
    if (ev.type === "invoice.payment_failed") {
      const c = await stripe.customers.retrieve(o.customer);
      if (c.email) await sendMail(c.email, T.impayeClient({ montant: o.amount_due, lien: o.hosted_invoice_url })).catch((e) => console.error(e));
      await sendMail(team(), T.impayeEquipe({ nom: c.name || c.email, montant: o.amount_due, cid: o.customer })).catch(() => {});
    }
    if (ev.type === "customer.subscription.deleted") {
      const c = await stripe.customers.retrieve(o.customer);
      if (c.email) await sendMail(c.email, T.finClient()).catch(() => {});
      await sendMail(team(), T.finEquipe({ nom: (o.metadata && o.metadata.livre_nom) || c.name || c.email, cid: o.customer })).catch(() => {});
    }
    await store.set(`evt/${Date.now()}-${ev.type}`, { type: ev.type, id: o.id, client: o.customer || null, date: new Date().toISOString() }).catch(() => {});
    return res.status(200).json({ received: true });
  } catch (e) { console.error(e); await reportBug("webhook Stripe " + (ev && ev.type), e); return res.status(500).json({ error: "Erreur" }); }
};
