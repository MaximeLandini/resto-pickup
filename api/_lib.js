// Outils communs de l'espace client : Stripe, jeton de session signé, envoi du code par e-mail (Brevo).
// Variables : STRIPE_SECRET_KEY, SESSION_SECRET (longue chaîne aléatoire), BREVO_API_KEY, MAIL_FROM, SITE_URL.
const crypto = require("crypto");
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const SECRET = process.env.SESSION_SECRET || "";
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
async function sendCode(to, code) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Resto Pickup", email: process.env.MAIL_FROM },
      to: [{ email: to }],
      subject: `Votre code Resto Pickup : ${code}`,
      htmlContent: `<p style="font-family:Arial;font-size:18px">Bonjour,</p><p style="font-family:Arial;font-size:18px">Voici votre code pour ouvrir votre espace : <b style="font-size:28px;letter-spacing:4px">${code}</b></p><p style="font-family:Arial;font-size:16px;color:#4A5368">Il est valable 15 minutes. Si vous n'avez rien demandé, ignorez ce message.</p>`,
    }),
  });
  if (!r.ok) throw new Error("envoi e-mail");
}
// Jeton équipe (espace admin) : "admin:<email>.<exp>.<signature>", valable 12 h
function signAdmin(email) { return sign("admin:" + String(email).toLowerCase(), 0.5); }
function verifyAdmin(req) {
  const id = verifyToken(req);
  if (!id || !id.startsWith("admin:")) return null;
  const email = id.slice(6);
  const allowed = String(process.env.ADMIN_EMAILS || "").toLowerCase().split(/[,; ]+/).filter(Boolean);
  return allowed.includes(email) ? email : null;
}
async function sendMail(to, subject, html, replyTo) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ sender: { name: "Resto Pickup", email: process.env.MAIL_FROM }, to: [{ email: to }], ...(replyTo ? { replyTo: { email: replyTo } } : {}), subject,
      htmlContent: `<div style="font-family:Arial,sans-serif;font-size:17px;line-height:1.55;color:#1B2A4E;max-width:560px">${html}<p style="color:#4A5368;font-size:14px;margin-top:28px">Resto Pickup · 06 60 68 05 07 · <a href="${process.env.SITE_URL}/mon-compte.html">Mon espace</a></p></div>` }),
  });
  if (!r.ok) throw new Error("envoi e-mail");
}
// Montant hebdomadaire d'un abonnement (repas + livraison)
const weekly = (s) => s.items.data.reduce((t, i) => t + (i.price.unit_amount || 0) * (i.quantity || 1), 0) / 100;
module.exports = { stripe, hmac, body, sign, verifyToken, signAdmin, verifyAdmin, findCustomer, activeSub, nextDelivery, sendCode, sendMail, weekly, ZONES };
