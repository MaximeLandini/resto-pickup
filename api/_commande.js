// Logique commune aux commandes : création de la page de paiement Stripe, cartes cadeaux, envoi d'e-mails.
// Utilisée par checkout.js (commande en ligne) et lien.js (commande prise au téléphone par l'équipe).
// Variables : STRIPE_SECRET_KEY, STRIPE_PRICE_REPAS (récurrent hebdo 11,99 € TTC), STRIPE_PRICE_REPAS_UNIQUE (ponctuel 11,99 € TTC),
// SITE_URL, BREVO_API_KEY, MAIL_FROM, MAIL_EQUIPE (adresse qui reçoit les demandes de rappel).
const crypto = require("crypto");
const { stripe } = require("./_lib");

const PRIX = 1199; // centimes
// Livraison : 2,14 € par repas, 6,43 € minimum, 15 € maximum par semaine. Commande minimum 3 repas.
const LIV_REPAS = 214, LIV_MIN = 643, LIV_MAX = 1500, REPAS_MIN = 3;
const fee = (n) => Math.min(LIV_MAX, Math.max(LIV_MIN, LIV_REPAS * n));
const GIFT_UNIT = PRIX + LIV_REPAS; // repas offert, livraison comprise
const clean = (v, n = 200) => String(v || "").trim().slice(0, n);
const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function sendMail(to, subject, html, replyTo) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Resto Pickup", email: process.env.MAIL_FROM },
      to: [{ email: to }],
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      subject,
      htmlContent: `<div style="font-family:Arial,sans-serif;font-size:17px;line-height:1.5;color:#1B2A4E">${html}</div>`,
    }),
  });
  if (!r.ok) throw new Error("envoi e-mail");
}

// Code lisible au téléphone : pas de 0/O, 1/I.
function giftCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += A[b[i] % A.length];
  return `RP-${s.slice(0, 4)}-${s.slice(4)}`;
}
const normCode = (c) => clean(c, 20).toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^RP/, "").replace(/^(.{4})(.{4})$/, "RP-$1-$2");

// Retrouve une carte cadeau payée à partir de son code.
async function findGift(code) {
  const c = normCode(code);
  if (!/^RP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) return null;
  const r = await stripe.paymentIntents.search({ query: `metadata['code_cadeau']:'${c}' AND status:'succeeded'`, limit: 1 });
  const pi = r.data[0];
  if (!pi) return null;
  const expire = +pi.metadata.expire || 0;
  return { pi, code: c, montant: pi.amount_received, utilisee: !!pi.metadata.utilisee, expiree: expire && expire < Date.now() / 1000 };
}

// Lit et vérifie une commande (même format que le formulaire du site).
function parseOrder(b) {
  const essai = String(b.essai) === "1";
  const service = ["midi", "soir", "midi-soir"].includes(b.service) ? b.service : "soir";
  const jours = [...new Set(String(b.jours || "").replace(/[^1-7]/g, "").split(""))].filter(Boolean).sort().join("");
  if (!b.cp || !b.commune || !b.adresse || !b.tel) throw Object.assign(new Error("Adresse incomplète"), { status: 400 });
  const personnes = String(b.personnes) === "2" ? 2 : 1;
  const repas = jours.length * (service === "midi-soir" ? 2 : 1) * personnes;
  if (!jours.length || repas < REPAS_MIN) throw Object.assign(new Error(`Minimum ${REPAS_MIN} repas par semaine`), { status: 400 });
  const proche = b.pour === "proche";
  const email = clean(proche ? b.p_email : b.email, 120).toLowerCase() || undefined;
  const meta = {
    service, jours, essai: essai ? "1" : "", personnes: String(personnes),
    pour: proche ? "proche" : "moi",
    zone: clean(b.zone, 20),
    premiere_livraison: clean(b.premiereLivraison, 10),
    livre_nom: clean(`${b.prenom || ""} ${b.nom || ""}`, 120),
    livre_adresse: clean(`${b.adresse}, ${b.cp} ${b.commune}`, 300),
    livre_tel: clean(b.tel, 20),
    consignes: clean(b.consignes, 450),
    payeur: proche ? clean(`${b.p_prenom || ""} ${b.p_nom || ""}, ${b.p_tel || ""}`, 200) : "",
    canal: clean(b.canal, 20) || "site",
  };
  return { essai, service, jours, personnes, repas, email, meta, code: clean(b.code_cadeau, 20) };
}

// Crée la page de paiement Stripe. Si un code cadeau est donné, son montant est déduit.
async function createCheckout(b) {
  const o = parseOrder(b);
  let customer, discounts;
  if (o.code) {
    const g = await findGift(o.code);
    if (!g) throw Object.assign(new Error("Code cadeau inconnu"), { status: 400 });
    if (g.utilisee) throw Object.assign(new Error("Ce code cadeau a déjà été utilisé"), { status: 400 });
    if (g.expiree) throw Object.assign(new Error("Ce code cadeau a expiré"), { status: 400 });
    const total = o.repas * PRIX + fee(o.repas);
    customer = await stripe.customers.create({ email: o.email, name: o.meta.livre_nom, phone: o.meta.livre_tel, metadata: { code_cadeau: g.code } });
    if (o.essai) {
      // Paiement unique : le cadeau couvre tout ou partie de la semaine, le reste est gardé en avoir.
      const part = Math.min(g.montant, total);
      const coupon = await stripe.coupons.create({ amount_off: part, currency: "eur", duration: "once", name: `Carte cadeau ${g.code}`, max_redemptions: 1 });
      discounts = [{ coupon: coupon.id }];
      if (g.montant > part) await stripe.customers.createBalanceTransaction(customer.id, { amount: -(g.montant - part), currency: "eur", description: `Reste carte cadeau ${g.code}` });
    } else {
      // Abonnement : le montant passe en avoir, consommé semaine après semaine.
      await stripe.customers.createBalanceTransaction(customer.id, { amount: -g.montant, currency: "eur", description: `Carte cadeau ${g.code}` });
    }
    await stripe.paymentIntents.update(g.pi.id, { metadata: { utilisee: customer.id } });
    o.meta.code_cadeau = g.code;
  }
  const common = {
    locale: "fr",
    ...(customer ? { customer } : { customer_email: o.email }),
    billing_address_collection: "auto",
    metadata: o.meta,
    expires_at: Math.floor(Date.now() / 1000) + 23 * 3600, // maximum autorisé par Stripe : 24 h
    success_url: `${process.env.SITE_URL}/commander.html#merci`,
    cancel_url: `${process.env.SITE_URL}/commander.html`,
  };
  const desc = `Resto Pickup, ${o.service}, jours ${o.jours}, ${o.personnes} pers., livraison ${o.meta.zone}`;
  const session = o.essai
    ? await stripe.checkout.sessions.create({
        ...common, mode: "payment",
        ...(customer ? {} : { customer_creation: "always" }),
        ...(discounts ? { discounts } : {}),
        line_items: [{ price: process.env.STRIPE_PRICE_REPAS_UNIQUE, quantity: o.repas }, { quantity: 1, price_data: { currency: "eur", unit_amount: fee(o.repas), product: process.env.STRIPE_PRODUCT_LIVRAISON } }],
        payment_intent_data: { metadata: o.meta, description: `${desc}, semaine d'essai` },
      })
    : await stripe.checkout.sessions.create({
        ...common, mode: "subscription",
        line_items: [{ price: process.env.STRIPE_PRICE_REPAS, quantity: o.repas }, { quantity: 1, price_data: { currency: "eur", unit_amount: fee(o.repas), product: process.env.STRIPE_PRODUCT_LIVRAISON, recurring: { interval: "week" } } }],
        subscription_data: { metadata: o.meta, description: desc },
      });
  return { url: session.url, repas: o.repas, total: o.repas * PRIX + fee(o.repas) };
}

function fail(res, e) {
  if (e.status) return res.status(e.status).json({ error: e.message });
  console.error(e);
  return res.status(500).json({ error: "Service indisponible, appelez-nous" });
}

module.exports = { PRIX, GIFT_UNIT, fee, REPAS_MIN, clean, esc, sendMail, giftCode, normCode, findGift, parseOrder, createCheckout, fail };
