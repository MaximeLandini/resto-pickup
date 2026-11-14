// Configuration Stripe automatique : tarifs, webhook et portail client sont créés par le site lui-même
// au premier besoin, puis retrouvés par leur clé (lookup_key). Seule STRIPE_SECRET_KEY est indispensable.
// Les variables STRIPE_PRICE_REPAS, STRIPE_PRICE_REPAS_UNIQUE, STRIPE_PRODUCT_LIVRAISON, STRIPE_WEBHOOK_SECRET
// restent prioritaires si elles sont renseignées.
const { stripe, site } = require("./_lib");
const store = require("./_store");

const PRIX = 1199;
const EVENTS = ["checkout.session.completed", "checkout.session.async_payment_failed", "invoice.payment_failed", "customer.subscription.deleted"];
let _cat = null;

async function priceByKey(key) {
  const r = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1, expand: ["data.product"] });
  return r.data[0] || null;
}

// { repas, repasUnique, livraison } : ids Stripe
async function catalog() {
  if (_cat) return _cat;
  const env = process.env;
  if (env.STRIPE_PRICE_REPAS && env.STRIPE_PRICE_REPAS_UNIQUE && env.STRIPE_PRODUCT_LIVRAISON) {
    return (_cat = { repas: env.STRIPE_PRICE_REPAS, repasUnique: env.STRIPE_PRICE_REPAS_UNIQUE, livraison: env.STRIPE_PRODUCT_LIVRAISON });
  }
  let hebdo = await priceByKey("rp_repas_semaine");
  let unique = await priceByKey("rp_repas_unique");
  let livRef = await priceByKey("rp_livraison");
  if (!hebdo || !unique) {
    const prodRepas = hebdo ? hebdo.product.id : unique ? unique.product.id
      : (await stripe.products.create({ name: "Repas Resto Pickup, plat et dessert", description: "Repas complet de qualité traiteur, livré une fois par semaine.", metadata: { rp: "repas" } })).id;
    if (!hebdo) hebdo = await stripe.prices.create({ product: prodRepas, currency: "eur", unit_amount: PRIX, recurring: { interval: "week" }, lookup_key: "rp_repas_semaine", nickname: "Repas, abonnement hebdomadaire", tax_behavior: "inclusive" });
    if (!unique) unique = await stripe.prices.create({ product: prodRepas, currency: "eur", unit_amount: PRIX, lookup_key: "rp_repas_unique", nickname: "Repas, semaine d'essai", tax_behavior: "inclusive" });
  }
  if (!livRef) {
    const prodLiv = await stripe.products.create({ name: "Livraison", description: "2,14 € par repas, 6,43 € minimum, 15 € maximum par semaine.", metadata: { rp: "livraison" } });
    // prix de référence, sert seulement à retrouver le produit ; le montant réel est calculé à chaque commande
    livRef = await stripe.prices.create({ product: prodLiv.id, currency: "eur", unit_amount: 214, lookup_key: "rp_livraison", nickname: "Référence livraison", tax_behavior: "inclusive" });
  }
  const pid = (p) => (typeof p.product === "string" ? p.product : p.product.id);
  return (_cat = { repas: hebdo.id, repasUnique: unique.id, livraison: pid(livRef) });
}

// Secret de signature du webhook : variable, sinon celui enregistré à la création automatique.
async function webhookSecret() {
  if (process.env.STRIPE_WEBHOOK_SECRET) return process.env.STRIPE_WEBHOOK_SECRET;
  const c = await store.get("cfg/webhook");
  return c && c.secret;
}
let _wh = false;
async function ensureWebhook() {
  if (_wh || process.env.STRIPE_WEBHOOK_SECRET) return true;
  const url = `${site()}/api/webhook`;
  const saved = await store.get("cfg/webhook");
  const list = await stripe.webhookEndpoints.list({ limit: 100 });
  const found = list.data.find((w) => w.url === url && w.status === "enabled");
  if (found && saved && saved.id === found.id) {
    if (EVENTS.some((e) => !found.enabled_events.includes(e))) await stripe.webhookEndpoints.update(found.id, { enabled_events: EVENTS });
    return (_wh = true);
  }
  // le secret n'est lisible qu'à la création : on recrée l'adresse si on ne l'a pas
  if (found) await stripe.webhookEndpoints.del(found.id);
  const w = await stripe.webhookEndpoints.create({ url, enabled_events: EVENTS, description: "Site Resto Pickup (créé automatiquement)" });
  await store.set("cfg/webhook", { id: w.id, secret: w.secret, url, date: new Date().toISOString() });
  return (_wh = true);
}

// Portail client Stripe (cartes, IBAN, factures) : configuration créée si absente.
let _portal = null;
async function portalConfig() {
  if (_portal) return _portal;
  const r = await stripe.billingPortal.configurations.list({ active: true, limit: 10 });
  const mine = r.data.find((c) => c.metadata && c.metadata.rp === "1");
  if (mine) return (_portal = mine.id);
  const c = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Resto Pickup : vos moyens de paiement et vos factures", privacy_policy_url: `${site()}/mentions-legales.html`, terms_of_service_url: `${site()}/conditions-generales.html` },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ["email", "address", "phone", "name"] },
      subscription_cancel: { enabled: false },
    },
    default_return_url: `${site()}/mon-compte.html`,
    metadata: { rp: "1" },
  });
  return (_portal = c.id);
}

async function setupAll() {
  const out = {};
  out.catalogue = await catalog();
  out.webhook = await ensureWebhook().then(() => "ok");
  out.portail = await portalConfig();
  return out;
}

module.exports = { catalog, webhookSecret, ensureWebhook, portalConfig, setupAll };
