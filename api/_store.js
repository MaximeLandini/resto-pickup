// Stockage léger (Netlify Blobs) : messages client, demandes de rappel, notes internes, statut des livraisons.
// Les données de commande et de paiement restent dans Stripe : ici seulement ce que Stripe ne garde pas.
let _store = null;
function store() {
  if (!_store) {
    const { getStore } = require("@netlify/blobs");
    _store = getStore({ name: "restopickup" });
  }
  return _store;
}
async function get(key, fallback = null) {
  const v = await store().get(key, { type: "json" });
  return v == null ? fallback : v;
}
async function set(key, value) { await store().setJSON(key, value); return value; }
async function del(key) { await store().delete(key); }
async function list(prefix) {
  const out = [];
  let r = await store().list({ prefix, paginate: false });
  for (const b of r.blobs || []) out.push(b.key);
  return out;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Fil de messages d'un client : [{ de: "client" | "equipe", texte, date, lu }]
async function thread(cid) { return get(`msg/${cid}`, { cid, nom: "", messages: [], nonLu: 0 }); }
async function addMessage(cid, de, texte, nom) {
  const t = await thread(cid);
  if (nom) t.nom = nom;
  t.messages.push({ de, texte: String(texte).slice(0, 2000), date: new Date().toISOString() });
  t.messages = t.messages.slice(-200);
  t.dernier = new Date().toISOString();
  t.nonLu = de === "client" ? (t.nonLu || 0) + 1 : 0;
  t.nonLuClient = de === "equipe" ? (t.nonLuClient || 0) + 1 : 0;
  return set(`msg/${cid}`, t);
}

module.exports = { get, set, del, list, uid, thread, addMessage };
