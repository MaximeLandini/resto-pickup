// Demandes de contact : « On vous rappelle », orientation par un professionnel, demande de flyers.
// Envoie un e-mail à l'équipe (MAIL_EQUIPE). Rien n'est stocké ailleurs.
const { body, site, team } = require("./_lib");
const { clean, esc, sendMail, fail } = require("./_commande");

const TYPES = {
  rappel: "Demande de rappel",
  orientation: "Personne orientée par un professionnel",
  flyers: "Demande de flyers",
};
const CRENEAUX = { matin: "le matin", aprem: "l'après-midi", "": "peu importe" };
const POUR = { moi: "pour elle ou lui-même", parent: "pour un parent ou un proche", pro: "un professionnel" };

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  try {
    const b = body(req);
    if (b.site_web) return res.status(200).json({ ok: true }); // piège à robots : champ caché rempli
    const type = TYPES[b.type] ? b.type : "rappel";
    const tel = clean(b.tel, 20).replace(/[^\d+]/g, "");
    if (type !== "flyers" && tel.replace(/\D/g, "").length < 10) return res.status(400).json({ error: "Numéro de téléphone incomplet" });
    if (type === "orientation" && b.accord !== "1") return res.status(400).json({ error: "Accord de la personne requis" });
    const rows = [
      ["Nom", clean(b.nom, 120)],
      ["Téléphone", tel],
      ["Commune", clean(b.commune, 80)],
      ["Pour", POUR[b.pour] || ""],
      ["Créneau souhaité", type === "rappel" ? CRENEAUX[b.creneau || ""] || "" : ""],
      ["Structure", clean(b.structure, 120)],
      ["Contact du professionnel", clean(b.pro, 200)],
      ["E-mail", clean(b.email, 120)],
      ["Adresse d'envoi", clean(b.adresse, 300)],
      ["Quantité", clean(b.quantite, 10)],
      ["Message", clean(b.message, 600)],
      ["Page", clean(b.page, 80)],
    ].filter((r) => r[1]);
    const store = require("./_store");
    const id = store.uid();
    await store.set(`req/${id}`, { id, type, statut: "nouveau", date: new Date().toISOString(), champs: Object.fromEntries(rows) }).catch((e) => console.error(e));
    const { T } = require("./_mail");
    const champs = Object.fromEntries(rows);
    await sendMail(team(), T.demandeEquipe({ type, titre: TYPES[type], champs, email: clean(b.email, 120) || undefined }));
    // accusé de réception à la personne, si elle a laissé son e-mail (pas pour une personne orientée par un tiers)
    const mailPerso = type === "orientation" ? "" : clean(b.email, 120);
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(mailPerso)) await sendMail(mailPerso, T.demandeAccuse({ type, prenom: clean(b.nom, 60).split(" ")[0] })).catch(() => {});
    return res.status(200).json({ ok: true });
  } catch (e) {
    return fail(res, e);
  }
};
