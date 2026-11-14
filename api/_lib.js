// Outils communs de l'espace client : Stripe, jeton de session signé, envoi du code par e-mail (Brevo).
// Variables : STRIPE_SECRET_KEY, SESSION_SECRET (longue chaîne aléatoire), BREVO_API_KEY, MAIL_FROM, SITE_URL.
const crypto = require("crypto");
const Stripe = require("stripe");
// Initialisation paresseuse : sans clé, la fonction répond « non configuré » au lieu de planter.
let _s = null;
const stripe = new Proxy({}, { get(_, k) {
  if (!_s) { if (!process.env.STRIPE_SECRET_KEY) { const e = new Error("Paiement pas encore configuré"); e.status = 503; throw e; } _s = new Stripe(process.env.STRIPE_SECRET_KEY); }
  return _s[k];
} });
// Sans SESSION_SECRET, le secret de session est dérivé de la clé Stripe (jamais exposé).
const SECRET = process.env.SESSION_SECRET || (process.env.STRIPE_SECRET_KEY ? crypto.createHash("sha256").update("rp-session:" + process.env.STRIPE_SECRET_KEY).digest("hex") : "");
const site = () => (process.env.SITE_URL || "https://restopickup.com").replace(/\/$/, "");
// Destinataires des alertes (commandes, demandes de l'espace client, bugs). MAIL_EQUIPE les remplace si renseignée.
const TEAM_DEFAUT = "maxime@gardenevents.fr, robertlandini@yahoo.fr";
const team = () => String(process.env.MAIL_EQUIPE || TEAM_DEFAUT).split(/[,; ]+/).filter(Boolean);
const adminEmails = () => String(process.env.ADMIN_EMAILS || TEAM_DEFAUT).toLowerCase().split(/[,; ]+/).filter(Boolean);
const mailFrom = () => process.env.MAIL_FROM || "bonjour@restopickup.com";
const ZONES = { "le-mans": { jour: 2, nom: "mardi" }, loue: { jour: 4, nom: "jeudi" }, "mayenne-orne": { jour: 4, nom: "jeudi" } };
const DELAI = 3;

const hmac = (s) => crypto.createHmac("sha256", SECRET).update(s).digest("hex");
const body = (req) => (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});

function sign(customerId, days = 30) {
  const exp = Math.floor(Date.now() / 1000 + days * 86400);
  const p = `${customerId}.${exp}`;
  return `${p}.${hmac(p)}`;
}
function verifyToken(req) {
  const t = String(req.headers.authorization || "").replace(/^Bearer /, "");
  const i2 = t.lastIndexOf("."), i1 = t.lastIndexOf(".", i2 - 1);
  if (i1 < 1 || i2 < 0) return null;
  const cid = t.slice(0, i1), exp = t.slice(i1 + 1, i2), sig = t.slice(i2 + 1);
  if (!cid || !exp || sig.length !== 64) return null;
  const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hmac(`${cid}.${exp}`)));
  return ok && +exp > Date.now() / 1000 ? cid : null;
}
async function findCustomer(email) {
  const r = await stripe.customers.list({ email: String(email || "").trim().toLowerCase(), limit: 1 });
  return r.data[0] || null;
}
async function activeSub(cid) {
  const r = await stripe.subscriptions.list({ customer: cid, status: "all", limit: 5 });
  return r.data.find((s) => ["active", "trialing", "past_due"].includes(s.status)) || null;
}
function nextDelivery(jour, from = new Date()) {
  const d = new Date(from); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + DELAI);
  while (d.getDay() !== jour) d.setDate(d.getDate() + 1);
  return d;
}
async function sendCode(to, code, opts = {}) {
  await sendMail(to, require("./_mail").T.code(code, opts));
}
// Jeton équipe (espace admin) : "admin:<email>.<exp>.<signature>", valable 12 h
function signAdmin(email) { return sign("admin:" + String(email).toLowerCase(), 0.5); }
function verifyAdmin(req) {
  const id = verifyToken(req);
  if (!id || !id.startsWith("admin:")) return null;
  const email = id.slice(6);
  return adminEmails().includes(email) ? email : null;
}
// sendMail(destinataires, modèle) où modèle = { subject, html, text, replyTo } (voir _mail.js)
async function sendMail(to, tpl, legacyHtml, legacyReply) {
  if (typeof tpl === "string") tpl = { subject: tpl, html: legacyHtml, replyTo: legacyReply };
  const dest = (Array.isArray(to) ? to : String(to || "").split(/[,;]+/)).map((e) => String(e).trim()).filter(Boolean);
  if (!dest.length) return;
  if (!process.env.BREVO_API_KEY) { console.error("BREVO_API_KEY absente, e-mail non envoyé :", tpl.subject); return; }
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { name: "Resto Pickup", email: mailFrom() }, to: dest.map((email) => ({ email })), ...(tpl.replyTo ? { replyTo: { email: tpl.replyTo } } : {}),
      subject: tpl.subject, htmlContent: tpl.html, ...(tpl.text ? { textContent: tpl.text } : {}), tags: [tpl.tag || "resto-pickup"] }),
  });
  if (!r.ok) throw new Error("envoi e-mail " + r.status + " " + (await r.text()).slice(0, 400));
}
// Alerte équipe : ne bloque jamais la réponse au client
function notifyTeam(tpl) {
  return sendMail(team(), tpl).catch((e) => console.error("alerte équipe", e.message));
}
// Bug serveur ou navigateur : un e-mail par type d'erreur et par heure au maximum
const _bugVus = new Map();
async function reportBug(where, err, extra = "") {
  try {
    const msg = String((err && (err.stack || err.message)) || err || "").slice(0, 1500);
    const sig = crypto.createHash("sha1").update(where + "|" + msg.split("\n")[0]).digest("hex").slice(0, 16);
    const store = require("./_store");
    if (_bugVus.has(sig) && Date.now() - _bugVus.get(sig) < 3600e3) return; // même instance : déjà signalé
    _bugVus.set(sig, Date.now());
    const k = `bug/${sig}`, prev = await store.get(k).catch(() => null);
    if (prev && Date.now() - prev.t < 3600e3) { await store.set(k, { ...prev, n: (prev.n || 1) + 1 }).catch(() => {}); return; }
    await store.set(k, { t: Date.now(), n: 1, where, msg: msg.slice(0, 300) }).catch(() => {});
    await notifyTeam(require("./_mail").T.bug({ where, msg, n: prev ? prev.n || 1 : 0, extra }));
  } catch (e) { console.error("reportBug", e); }
}
// Montant hebdomadaire d'un abonnement (repas + livraison)
const weekly = (s) => s.items.data.reduce((t, i) => t + (i.price.unit_amount || 0) * (i.quantity || 1), 0) / 100;
module.exports = { site, team, adminEmails, notifyTeam, reportBug, stripe, hmac, body, sign, verifyToken, signAdmin, verifyAdmin, findCustomer, activeSub, nextDelivery, sendCode, sendMail, weekly, ZONES };
