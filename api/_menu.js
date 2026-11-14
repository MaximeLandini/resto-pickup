// Menus : bibliothèque de recettes, planning hebdomadaire, étiquettes de barquettes.
// Stockage Netlify Blobs : recette/<id>, photo/<id> (image JPEG en base64), menu/<lundi AAAA-MM-JJ>.
const store = require("./_store");

// Les 14 allergènes à déclarer (liste réglementaire européenne)
const ALLERGENES = {
  gluten: "Gluten", crustaces: "Crustacés", oeufs: "Œufs", poissons: "Poissons", arachides: "Arachides", soja: "Soja", lait: "Lait",
  fruits_coque: "Fruits à coque", celeri: "Céleri", moutarde: "Moutarde", sesame: "Graines de sésame", sulfites: "Sulfites", lupin: "Lupin", mollusques: "Mollusques",
};
// Mots qui, dans la liste d'ingrédients, sont mis en gras sur l'étiquette
const MOTS = {
  gluten: ["blé", "farine", "seigle", "orge", "avoine", "épeautre", "kamut", "gluten", "chapelure", "pâtes", "semoule", "pain"],
  crustaces: ["crevette", "crabe", "homard", "langoustine", "écrevisse", "crustacé"], oeufs: ["œuf", "oeuf", "oeufs", "œufs", "mayonnaise"],
  poissons: ["poisson", "colin", "cabillaud", "saumon", "thon", "merlu", "lieu", "anchois"], arachides: ["arachide", "cacahuète"], soja: ["soja"],
  lait: ["lait", "beurre", "crème", "fromage", "emmental", "comté", "yaourt", "mozzarella", "parmesan", "lactose"],
  fruits_coque: ["amande", "noisette", "noix", "pistache", "cajou", "pécan"], celeri: ["céleri"], moutarde: ["moutarde"], sesame: ["sésame"],
  sulfites: ["sulfite", "vin", "vinaigre"], lupin: ["lupin"], mollusques: ["moule", "huître", "calmar", "seiche", "escargot", "mollusque"],
};
const SVCS = ["midi", "soir"];
const clean = (v, n = 300) => String(v == null ? "" : v).trim().slice(0, n);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Lundi de la semaine d'une date (AAAA-MM-JJ, heure de Paris approximée à midi)
function lundi(iso) {
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00Z");
  const wd = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - wd);
  return d.toISOString().slice(0, 10);
}
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const jourIso = (iso) => ((new Date(iso + "T12:00:00Z").getUTCDay() + 6) % 7) + 1; // 1 = lundi

function normRecette(b, old = {}) {
  const type = b.type === "dessert" ? "dessert" : "plat";
  const allergenes = [...new Set((Array.isArray(b.allergenes) ? b.allergenes : []).filter((a) => ALLERGENES[a]))];
  return {
    id: old.id || clean(b.id, 40) || uid(), type, nom: clean(b.nom, 120), description: clean(b.description, 400), ingredients: clean(b.ingredients, 1500),
    allergenes, traces: clean(b.traces, 200), poids: Math.max(0, Math.min(2000, parseInt(b.poids, 10) || 0)),
    conservation: clean(b.conservation, 80) || "Entre 0 et 4 °C", dlcJours: Math.max(1, Math.min(30, parseInt(b.dlcJours, 10) || 6)),
    rechauffage: clean(b.rechauffage, 300), sanitaire: clean(b.sanitaire, 120), photo: old.photo || null, maj: new Date().toISOString(),
  };
}
async function recettes() {
  const keys = await store.list("recette/");
  const all = await Promise.all(keys.map((k) => store.get(k)));
  return all.filter(Boolean).sort((a, b) => a.type.localeCompare(b.type) || a.nom.localeCompare(b.nom, "fr"));
}
// Planning d'une semaine : { lundi, publie, jours: { "1": { midi: { plat, dessert }, soir: {...} }, ... } }
async function menu(lun) { return store.get(`menu/${lun}`, { lundi: lun, publie: false, jours: {} }); }

// Résout un menu (identifiants -> recettes) pour l'affichage public
function resoudre(m, byId, avecDetails = true) {
  const out = { lundi: m.lundi, publie: !!m.publie, jours: {} };
  for (let j = 1; j <= 7; j++) {
    const jj = (m.jours || {})[j] || {};
    out.jours[j] = {};
    for (const s of SVCS) {
      const p = byId[(jj[s] || {}).plat], d = byId[(jj[s] || {}).dessert];
      if (!p && !d) continue;
      const pub = (r) => r && { id: r.id, nom: r.nom, description: r.description, photo: r.photo ? `/api/photo?id=${r.photo}` : null, allergenes: r.allergenes.map((a) => ALLERGENES[a]), ...(avecDetails ? { ingredients: r.ingredients, traces: r.traces, conservation: r.conservation } : {}) };
      out.jours[j][s] = { plat: pub(p), dessert: pub(d) };
    }
  }
  return out;
}

// Liste d'ingrédients avec les allergènes en gras (HTML échappé)
function ingredientsGras(txt, allergenes) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let h = esc(txt);
  const mots = allergenes.flatMap((a) => MOTS[a] || []).sort((a, b) => b.length - a.length);
  if (mots.length) h = h.replace(new RegExp(`(^|[^\\p{L}])(${mots.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(s|x)?(?=[^\\p{L}]|$)`, "giu"), (m0, a, w, pl) => `${a}<b>${w}${pl || ""}</b>`);
  return h;
}

// Étiquettes d'une tournée : une par repas livré (jour x service x personne), avec la recette du jour
// Règle : une livraison couvre les 7 jours qui commencent le jour de la livraison.
async function etiquettes(clients, dateLiv) {
  const byId = Object.fromEntries((await recettes()).map((r) => [r.id, r]));
  const menus = {};
  const get = async (lun) => (menus[lun] = menus[lun] || (await menu(lun)));
  const out = [], manques = new Set();
  for (const c of clients) {
    for (let k = 0; k < 7; k++) {
      const dIso = addDays(dateLiv, k), j = jourIso(dIso);
      if (!String(c.jours || "").includes(String(j))) continue;
      const m = await get(lundi(dIso));
      for (const s of SVCS) {
        if (c.service !== "midi-soir" && c.service !== s) continue;
        const sel = ((m.jours || {})[j] || {})[s] || {};
        const p = byId[sel.plat], d = byId[sel.dessert];
        if (!p) manques.add(`${dIso} ${s}`);
        const dlcJ = Math.min(p ? p.dlcJours : 99, d ? d.dlcJours : 99);
        const dlc = dlcJ < 99 ? addDays(dateLiv, dlcJ) : null;
        for (let n = 0; n < (c.personnes || 1); n++) {
          out.push({
            client: c.nom, commune: c.commune, cid: c.cid, date: dIso, jour: j, service: s,
            plat: p ? { nom: p.nom, ingredients: ingredientsGras(p.ingredients, p.allergenes), allergenes: p.allergenes.map((a) => ALLERGENES[a]), traces: p.traces, poids: p.poids, sanitaire: p.sanitaire, rechauffage: p.rechauffage } : null,
            dessert: d ? { nom: d.nom, ingredients: ingredientsGras(d.ingredients, d.allergenes), allergenes: d.allergenes.map((a) => ALLERGENES[a]), traces: d.traces, poids: d.poids, sanitaire: d.sanitaire } : null,
            conservation: (p && p.conservation) || (d && d.conservation) || "Entre 0 et 4 °C", dlc, horsDlc: !!(dlc && dIso > dlc), lot: dateLiv.replace(/-/g, ""),
          });
        }
      }
    }
  }
  return { etiquettes: out, manques: [...manques].sort() };
}

module.exports = { ALLERGENES, SVCS, lundi, addDays, jourIso, normRecette, recettes, menu, resoudre, etiquettes, ingredientsGras, uid };
