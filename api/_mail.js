// Pack de mails Resto Pickup : un seul gabarit, à la charte du site (marine, tomate, farine, nappe vichy, étiquette de barquette).
// Chaque modèle renvoie { subject, html, text, replyTo? }. HTML compatible messageries (tableaux, styles en ligne, images PNG hébergées).
const SITE = () => (process.env.SITE_URL || "https://restopickup.com").replace(/\/$/, "");
const TEL = "06 60 68 05 07", TEL_HREF = "+33660680507";
const TELN = `<span style="white-space:nowrap">${TEL}</span>`;
const C = { marine: "#1B2A4E", tomate: "#E04A2F", brique: "#B33A22", ardoise: "#4A5368", farine: "#FAF7F2", ciel: "#DCE5EF", persil: "#1A5230", moutarde: "#7A4300", filet: "#D9DEE8", blanc: "#FFFFFF" };
const SERIF = "'Young Serif',Georgia,'Times New Roman',serif";
const SANS = "'Atkinson Hyperlegible Next','Atkinson Hyperlegible',Verdana,Arial,sans-serif";
const JN = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const JC = ["", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const SVC = { midi: "le midi", soir: "le soir", "midi-soir": "midi et soir" };

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nl = (s) => esc(s).replace(/\n/g, "<br>");
const eur = (cents) => (Number(cents || 0) / 100).toFixed(2).replace(".", ",") + " €";
const dlong = (iso) => { if (!iso) return ""; const d = new Date(String(iso).length <= 10 ? iso + "T12:00:00" : iso); return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }); };
const jourOf = (iso) => (iso ? ((new Date(String(iso).slice(0, 10) + "T12:00:00").getDay() + 6) % 7) + 1 : 0);
const joursTxt = (j) => (j === "1234567" ? "tous les jours" : j === "12345" ? "du lundi au vendredi" : String(j || "").split("").map((d) => JC[+d]).join(" "));

/* ---------- briques (aucune image : tout est dessiné en HTML, rien n'est bloqué par les messageries) ---------- */
// Logo en texte : « resto ● pickup », la pastille tomate à la place du o
function wordmark(color = C.marine, size = 30) {
  return `<span style="font:400 ${size}px/1 ${SERIF};color:${color};letter-spacing:-.01em;white-space:nowrap">rest<span style="display:inline-block;width:${Math.round(size * .5)}px;height:${Math.round(size * .5)}px;border-radius:50%;background:${C.tomate};vertical-align:${Math.round(size * -.02)}px;margin:0 ${Math.round(size * .04)}px 0 ${Math.round(size * .02)}px"></span>&nbsp;pickup</span>`;
}
// Assiette tomate à liseré pointillé (l'emblème de la marque), avec un texte au centre si besoin
function assiette(size = 56, label = "", fs = 13) {
  const inner = size - 12;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate"><tr><td align="center" valign="middle" style="width:${size}px;height:${size}px;border-radius:50%;background:${C.tomate};padding:0">
  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:0 auto"><tr><td align="center" valign="middle" style="width:${inner - 4}px;height:${inner - 4}px;border-radius:50%;border:2px dashed #ffffff;font:700 ${fs}px/1.05 ${SANS};color:#ffffff;text-transform:uppercase;letter-spacing:.04em">${label || "&nbsp;"}</td></tr></table>
  </td></tr></table>`;
}
function vichy() {
  const row = (off) => Array.from({ length: 24 }, (_, i) => `<td width="4.16%" height="9" style="height:9px;font-size:0;line-height:0;background:${(i + off) % 2 ? C.marine : "#ffffff"}">&nbsp;</td>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed;width:100%"><tr>${row(0)}</tr><tr>${row(1)}</tr></table>`;
}
function button(label, url, tone = "marine") {
  const bg = tone === "tomate" ? C.brique : C.marine;
  return `<table role="presentation" class="btn" cellpadding="0" cellspacing="0" style="margin:24px 0 6px"><tr><td align="center" style="border-radius:999px;background:${bg}" bgcolor="${bg}">
  <a href="${esc(url)}" style="display:block;padding:17px 30px;font:700 18px/1.2 ${SANS};color:#ffffff;text-decoration:none;border-radius:999px;text-align:center">${esc(label)}</a></td></tr></table>`;
}
function link2(label, url) { return `<p style="margin:10px 0 0;font:16px/1.5 ${SANS}"><a href="${esc(url)}" style="color:${C.marine};font-weight:700">${esc(label)}</a></p>`; }
const P = (html, extra = "") => `<p style="margin:0 0 14px;font:18px/1.6 ${SANS};color:${C.marine};${extra}">${html}</p>`;

// Étiquette de barquette : la pastille du jour, comme sur les repas livrés
function etiquette(iso, sous) {
  const j = jourOf(iso) || 2;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;border:2px solid ${C.marine};border-radius:16px;background:#ffffff;border-collapse:separate"><tr>
  <td width="76" style="width:76px;padding:14px 4px 14px 14px;vertical-align:middle">${assiette(62, JC[j].replace(".", ""), 14)}</td>
  <td style="padding:14px 16px 14px 8px;vertical-align:middle"><div style="font:700 12px/1.2 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${C.brique}">Première livraison</div>
  <div style="font:23px/1.2 ${SERIF};color:${C.marine};margin-top:4px">${esc(dlong(iso))}</div>${sous ? `<div style="font:15px/1.4 ${SANS};color:${C.ardoise};margin-top:4px">${esc(sous)}</div>` : ""}</td></tr></table>`;
}
// Ticket façon « la carte » : intitulé, points de conduite, prix
function ticket(rows, total, titre) {
  const tr = rows.map(([k, v, s]) => `<tr><td style="padding:10px 0 2px;font:17px/1.3 ${SANS};color:${C.marine};vertical-align:bottom;white-space:nowrap">${esc(k)}</td>
    <td width="100%" style="padding:10px 6px 2px;vertical-align:bottom"><div style="border-bottom:2px dotted ${C.filet};height:1px;margin-bottom:5px;min-width:16px"></div></td>
    <td align="right" style="padding:10px 0 2px;font:700 17px/1.3 ${SANS};color:${C.marine};vertical-align:bottom">${v}</td></tr>
    ${s ? `<tr><td colspan="3" style="padding:0 0 6px;font:14px/1.3 ${SANS};color:${C.ardoise}">${esc(s)}</td></tr>` : ""}`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;border:2px solid ${C.marine};border-radius:8px;border-collapse:separate;background:#ffffff">
  <tr><td style="padding:4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.marine};border-radius:5px;border-collapse:separate"><tr><td style="padding:18px 18px 6px">
  ${titre ? `<div style="font:22px/1.2 ${SERIF};color:${C.marine};text-align:center;margin-bottom:8px">${esc(titre)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${tr}</table>
  ${total ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid ${C.marine};margin-top:8px"><tr><td style="padding:14px 0 14px;font:17px/1.3 ${SANS};color:${C.marine}">${esc(total[0])}</td><td align="right" style="padding:14px 0 14px;font:700 27px/1 ${SANS};color:${C.marine};white-space:nowrap">${total[1]}</td></tr></table>` : ""}
  </td></tr></table></td></tr></table>`;
}
// Encadré (info, attention, bonne nouvelle)
function note(html, tone = "info") {
  const t = { info: [C.ciel, C.marine], warn: ["#FBEFD9", C.moutarde], ok: ["#E2EFE6", C.persil], alert: ["#FBE3DE", C.brique] }[tone];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px"><tr><td style="background:${t[0]};border-left:6px solid ${t[1]};border-radius:12px;padding:15px 16px;font:17px/1.55 ${SANS};color:${C.marine}">${html}</td></tr></table>`;
}
// Code à 6 chiffres, lisible de loin, tient dans un écran de 320 px
function code6(code) {
  const cells = String(code).split("").map((d) => `<td align="center" style="width:40px;height:54px;border:2px solid ${C.marine};border-radius:10px;background:#ffffff;font:700 28px/54px ${SANS};color:${C.marine}">${esc(d)}</td>`).join(`<td style="width:6px;font-size:0">&nbsp;</td>`);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 20px;border-collapse:separate"><tr>${cells}</tr></table>`;
}
function citation(html, de) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px"><tr><td style="background:${C.farine};border-radius:16px;padding:18px 18px">
  <div style="font:40px/0.6 ${SERIF};color:${C.tomate}">“</div><div style="font:18px/1.6 ${SANS};color:${C.marine};margin-top:6px">${html}</div>${de ? `<div style="font:14px/1.4 ${SANS};color:${C.ardoise};margin-top:10px">${esc(de)}</div>` : ""}</td></tr></table>`;
}
function etapes(items) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 16px">${items.map((t, i) => `<tr><td width="42" style="width:42px;vertical-align:top;padding:6px 0"><table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate"><tr><td align="center" style="width:32px;height:32px;border-radius:50%;background:${C.marine};color:#ffffff;font:700 16px/32px ${SANS}">${i + 1}</td></tr></table></td><td style="padding:10px 0 6px;font:17px/1.5 ${SANS};color:${C.marine}">${t}</td></tr>`).join("")}</table>`;
}
// Carte cadeau, comme sur le site
function carteCadeau(c) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;border-collapse:separate"><tr><td style="background:${C.marine};border-radius:20px;padding:22px 22px;color:#ffffff" bgcolor="${C.marine}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle">${wordmark("#ffffff", 22)}</td><td align="right" width="60" style="vertical-align:middle;width:60px">${assiette(52)}</td></tr></table>
  <div style="font:700 12px/1 ${SANS};letter-spacing:.2em;text-transform:uppercase;margin-top:18px;color:${C.ciel}">Carte cadeau</div>
  <div style="font:34px/1.1 ${SERIF};margin-top:6px;color:#ffffff">${esc(c.repas)} repas</div>
  <div style="font:15px/1.4 ${SANS};color:${C.ciel}">plat et dessert, livrés chez vous</div>
  <div style="font:16px/1.4 ${SANS};margin-top:14px;color:#ffffff">Pour <b>${esc(c.pour)}</b>, de la part de <b>${esc(c.de)}</b></div>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;border-collapse:separate"><tr><td style="background:#ffffff;border-radius:10px;padding:9px 14px;font:700 19px/1 ${SANS};letter-spacing:.1em;color:${C.marine};white-space:nowrap">${esc(c.code)}</td></tr></table>
  </td></tr></table>`;
}
// Fiche équipe : intitulés et valeurs
function fiche(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;border:1px solid ${C.filet};border-radius:12px;border-collapse:separate">${rows.filter(Boolean).map(([k, v], i) => `<tr><td class="fk" width="34%" style="padding:11px 12px;background:${i % 2 ? "#ffffff" : C.farine};font:14px/1.4 ${SANS};color:${C.ardoise};width:34%;vertical-align:top">${esc(k)}</td><td class="fv" style="padding:11px 12px;background:${i % 2 ? "#ffffff" : C.farine};font:700 15px/1.45 ${SANS};color:${C.marine};word-break:break-word">${v}</td></tr>`).join("")}</table>`;
}

/* ---------- gabarits ---------- */
function footerClient(raison) {
  return `<tr><td class="pad" style="padding:22px 14px 6px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border-collapse:separate"><tr>
    <td width="66" style="width:66px;padding:16px 4px 16px 16px;vertical-align:middle">${assiette(48)}</td>
    <td style="padding:16px 16px 16px 8px;vertical-align:middle;font:16px/1.45 ${SANS};color:${C.marine}">Une question ? Une vraie personne vous répond, du lundi au vendredi.<br><a href="tel:${TEL_HREF}" style="font:700 22px/1.6 ${SANS};color:${C.marine};text-decoration:none;letter-spacing:.03em;white-space:nowrap">${TEL}</a></td>
  </tr></table></td></tr>
  <tr><td style="padding:16px 18px 34px;font:13px/1.6 ${SANS};color:${C.ardoise};text-align:center">
  ${raison ? esc(raison) + "<br>" : ""}Resto Pickup, marque de R L C RL CONCEPT, EURL, 1 B rue Pierre et Marie Curie, 92140 Clamart. RCS Nanterre 572 136 869.<br>
  <a href="${SITE()}/mon-compte.html" style="color:${C.ardoise}">Mon espace</a> · <a href="${SITE()}/politique-confidentialite.html" style="color:${C.ardoise}">Vos données</a> · <a href="${SITE()}/conditions-generales.html" style="color:${C.ardoise}">Conditions générales</a></td></tr>`;
}
// Conteneur fluide : 100 % sur téléphone, 600 px maximum ailleurs (table fantôme pour Outlook)
function shell(inner, { preheader = "", equipe = false } = {}) {
  return `<!doctype html><html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="x-apple-disable-message-reformatting"><meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>Resto Pickup</title>
<link href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Atkinson+Hyperlegible+Next:wght@400;700&display=swap" rel="stylesheet">
<style>body{margin:0!important;padding:0!important;background:${C.farine};-webkit-text-size-adjust:100%;text-size-adjust:100%}table{border-collapse:collapse}a{color:${C.marine}}
@media (max-width:480px){.pad{padding-left:10px!important;padding-right:10px!important}.inpad{padding:24px 18px 22px!important}.h1{font-size:26px!important;line-height:1.18!important}.btn{width:100%!important}.fk,.fv{display:block!important;width:auto!important}.fk{padding-bottom:0!important}.fv{padding-top:2px!important}}</style>
<!--[if mso]><style>table,td,div,p,a,span{font-family:Georgia,Arial,sans-serif!important}</style><![endif]--></head>
<body style="margin:0;padding:0;background:${C.farine}" bgcolor="${C.farine}"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:${C.farine}">${esc(preheader)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.farine};width:100%" bgcolor="${C.farine}"><tr><td align="center" style="padding:0">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto">
${equipe ? "" : `<tr><td>${vichy()}</td></tr>`}
${inner}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
// Mail client : en-tête logo, carte blanche, pied rassurant
function client(o) {
  const inner = `<tr><td align="center" style="padding:24px 14px 16px"><a href="${SITE()}" style="text-decoration:none">${wordmark(C.marine, 32)}</a></td></tr>
  <tr><td class="pad" style="padding:0 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:22px;border-collapse:separate" bgcolor="#ffffff"><tr><td class="inpad" style="padding:30px 28px 26px">
    ${o.eyebrow ? `<div style="font:700 13px/1 ${SANS};letter-spacing:.16em;text-transform:uppercase;color:${C.brique};margin-bottom:12px">${esc(o.eyebrow)}</div>` : ""}
    <h1 class="h1" style="margin:0 0 18px;font:400 30px/1.15 ${SERIF};color:${C.marine}">${o.title}</h1>
    ${o.body}
    ${o.sign === false ? "" : `<p style="margin:22px 0 0;font:17px/1.5 ${SANS};color:${C.marine}">À bientôt,<br><span style="font:20px/1.4 ${SERIF}">L'équipe Resto Pickup</span></p>`}
  </td></tr></table></td></tr>${footerClient(o.raison)}`;
  return { subject: o.subject, html: shell(inner, { preheader: o.preheader }), text: o.text || toText(o), replyTo: o.replyTo };
}
// Fiche équipe : bandeau marine, pastille de statut, faits, bouton admin
function equipe(o) {
  const tone = { vert: [C.persil, "#E2EFE6"], rouge: [C.brique, "#FBE3DE"], jaune: [C.moutarde, "#FBEFD9"], bleu: [C.marine, C.ciel] }[o.tone || "bleu"];
  const inner = `<tr><td class="pad" style="padding:18px 10px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.marine};border-radius:18px 18px 0 0;border-collapse:separate" bgcolor="${C.marine}"><tr>
    <td style="padding:16px 20px;vertical-align:middle">${wordmark("#ffffff", 22)}</td>
    <td align="right" style="padding:16px 20px;vertical-align:middle;font:700 11px/1.2 ${SANS};letter-spacing:.16em;text-transform:uppercase;color:${C.ciel}">Espace équipe</td></tr></table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:0 0 18px 18px;border-collapse:separate" bgcolor="#ffffff"><tr><td class="inpad" style="padding:24px 22px 8px">
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate"><tr><td style="background:${tone[1]};color:${tone[0]};border-radius:999px;padding:6px 12px;font:700 13px/1 ${SANS};letter-spacing:.04em">${esc(o.tag)}</td></tr></table>
    <h1 class="h1" style="margin:14px 0 6px;font:400 26px/1.2 ${SERIF};color:${C.marine}">${o.title}</h1>
    ${o.lead ? `<p style="margin:0 0 14px;font:16px/1.5 ${SANS};color:${C.ardoise}">${o.lead}</p>` : ""}
    ${o.body || ""}
    ${o.cta ? button(o.cta[0], o.cta[1]) : ""}
    <p style="margin:14px 0 20px;font:13px/1.5 ${SANS};color:${C.ardoise}">${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" })}</p>
  </td></tr></table></td></tr>
  <tr><td style="padding:14px 14px 30px;font:12px/1.5 ${SANS};color:${C.ardoise};text-align:center">Alerte automatique du site restopickup.com, réservée à l'équipe. Contient des données personnelles de clients : ne pas transférer.</td></tr>`;
  return { subject: o.subject, html: shell(inner, { preheader: o.preheader || o.lead || "", equipe: true }), text: o.text || toText(o), replyTo: o.replyTo };
}
function toText(o) {
  const h = [o.title, o.lead, o.body].filter(Boolean).join("\n\n");
  return h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|tr|h1|div|table)>/gi, "\n").replace(/<td[^>]*>/gi, " ").replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)").replace(/<[^>]+>/g, "").replace(/&nbsp;|&#8199;|&#65279;|&#847;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim()
    + `\n\nResto Pickup · ${TEL} · ${SITE()}`;
}

/* ---------- modèles ---------- */
const recapCommande = (m) => {
  const repas = (String(m.jours || "").length || 0) * (m.service === "midi-soir" ? 2 : 1) * (m.personnes === "2" ? 2 : 1);
  return [["Formule", `${SVC[m.service] || esc(m.service)}`, joursTxt(m.jours)], ["Pour", m.personnes === "2" ? "2 personnes" : "1 personne"], ["Barquettes", `${repas || ""} par semaine`]];
};
const T = {
  // Code de connexion à l'espace client ou équipe
  code: (code, { equipe: eq = false } = {}) => client({
    subject: `${code} est votre code Resto Pickup`, preheader: `Valable 15 minutes. ${code}`, eyebrow: eq ? "Espace équipe" : "Votre espace",
    title: "Votre code de connexion",
    body: P("Saisissez ces six chiffres sur la page de connexion :") + code6(code) + note("Il est valable <b>15 minutes</b>. Si vous n'avez rien demandé, ignorez ce message : personne ne peut entrer sans ce code.", "info"),
    raison: "Vous recevez ce message parce qu'une connexion a été demandée avec votre adresse.", sign: false,
  }),

  // Commande confirmée (abonnement ou semaine d'essai)
  commandeClient: (m, montantCents) => {
    const proche = m.pour && m.pour !== "moi";
    const rows = recapCommande(m);
    return client({
      subject: m.essai ? "Votre semaine d'essai est confirmée" : "Votre commande Resto Pickup est confirmée",
      preheader: `Première livraison ${dlong(m.premiere_livraison)}. Le livreur sonne et remet les repas en main propre.`,
      eyebrow: "Commande confirmée", title: proche ? `C'est noté, on s'occupe de tout pour ${esc(m.livre_nom || "votre proche")}.` : "C'est noté, on s'occupe de tout.",
      body: P(proche ? `Merci pour votre confiance. Les repas de <b>${esc(m.livre_nom || "votre proche")}</b> sont commandés.` : "Merci pour votre confiance. Votre commande est bien enregistrée.")
        + etiquette(m.premiere_livraison, m.essai ? m.livre_adresse : `${m.livre_adresse || ""}, puis chaque semaine le même jour.`)
        + ticket(rows.map((r) => [r[0], r[1], r[2]]), [m.essai ? "Semaine d'essai" : "Chaque semaine", eur(montantCents)], "Votre commande")
        + etapes([`Le livreur sonne et remet les repas <b>en main propre</b>${proche ? " à votre proche" : ""}, jamais devant la porte.`, "Les repas vont au frigo. Chaque barquette porte le jour et le repas : impossible de se tromper.", "Quelques minutes au micro-ondes, et c'est prêt."])
        + note(`Personne n'ouvre ? Le livreur appelle ${proche ? "votre proche, puis vous" : "le numéro indiqué"}.`, "ok")
        + button("Voir ma commande", `${SITE()}/mon-compte.html`)
        + P(`Absence, changement de repas, factures : tout se fait depuis votre espace, ou au ${TELN}.`, "font-size:16px;color:" + C.ardoise + ";margin-top:14px"),
      raison: "Vous recevez ce message parce que vous avez passé commande sur restopickup.com.",
    });
  },
  commandeEquipe: (m, o) => equipe({
    subject: `Nouvelle commande : ${m.livre_nom || o.email || "client"}${m.essai ? " (essai)" : ""}`, tone: "vert", tag: m.essai ? "Semaine d'essai" : "Nouvel abonnement",
    title: `${esc(m.livre_nom || "Nouveau client")}, ${esc(m.livre_commune || "")}`, lead: `Première livraison <b>${esc(dlong(m.premiere_livraison))}</b>`,
    body: fiche([["Formule", `${SVC[m.service] || esc(m.service)}, ${esc(joursTxt(m.jours))}`], ["Personnes", m.personnes === "2" ? "2" : "1"], ["Adresse", esc(m.livre_adresse)], ["Téléphone", esc(m.livre_tel)], ["Consignes", esc(m.consignes) || "aucune"], m.payeur ? ["Payeur", esc(m.payeur)] : null, ["E-mail", esc(o.email)], ["Montant", eur(o.montant)], ["Canal", m.canal === "telephone" ? "commande prise au téléphone" : "site"]]),
    cta: ["Ouvrir dans l'admin", `${SITE()}/admin.html`],
  }),

  // Paiement hebdomadaire refusé
  impayeClient: ({ montant, lien }) => client({
    subject: "Votre paiement de la semaine n'est pas passé", preheader: "Rien de grave : un clic pour régler, ou un appel.", eyebrow: "Paiement",
    title: "Le paiement de cette semaine n'est pas passé.",
    body: P(`Le règlement de <b>${eur(montant)}</b> pour vos repas a été refusé. Cela arrive souvent, par exemple quand une carte expire.`)
      + (lien ? button("Régler en un clic", lien) : "")
      + link2("Mettre à jour ma carte ou mon IBAN", `${SITE()}/mon-compte.html`)
      + note(`Vous préférez qu'on s'en occupe ensemble ? Appelez le <b>${TELN}</b>.`, "info"),
    raison: "Vous recevez ce message au sujet de votre abonnement Resto Pickup.",
  }),
  impayeEquipe: ({ nom, montant, cid }) => equipe({ subject: `Impayé : ${nom}`, tone: "rouge", tag: "Paiement refusé", title: esc(nom), lead: `${eur(montant)} refusés. Le client a reçu un lien pour régler.`, cta: ["Voir la fiche", `${SITE()}/admin.html#client=${cid}`] }),

  // Prélèvement SEPA refusé après coup (semaine d'essai)
  sepaClient: ({ montant }) => client({
    subject: "Votre prélèvement n'est pas passé", preheader: "Votre livraison n'est pas encore confirmée.", eyebrow: "Paiement",
    title: "Votre banque a refusé le prélèvement.",
    body: P(`Le prélèvement de <b>${eur(montant)}</b> pour votre commande n'a pas abouti, la livraison n'est donc pas confirmée.`) + note(`Appelez-nous au <b>${TELN}</b> : nous trouvons une solution ensemble, par carte ou par un nouveau prélèvement.`, "warn"),
    raison: "Vous recevez ce message au sujet de votre commande Resto Pickup.",
  }),
  sepaEquipe: (m, montant) => equipe({ subject: `Prélèvement refusé : ${m.livre_nom || ""}`, tone: "rouge", tag: "Ne pas livrer", title: esc(m.livre_nom || "Client"), lead: `Prélèvement SEPA de ${eur(montant)} refusé. Appeler le client avant toute livraison.`, body: fiche([["Téléphone", esc(m.livre_tel)], ["Adresse", esc(m.livre_adresse)]]), cta: ["Ouvrir l'admin", `${SITE()}/admin.html`] }),

  // Fin d'abonnement
  finClient: () => client({
    subject: "Votre abonnement Resto Pickup est arrêté", preheader: "Plus aucun prélèvement. Vous pouvez revenir quand vous voulez.", eyebrow: "Abonnement",
    title: "Votre abonnement est arrêté.",
    body: P("C'est bien pris en compte : plus aucune livraison ni aucun prélèvement. Vos factures restent disponibles dans votre espace.") + note("Un séjour à l'hôpital, des vacances ? La prochaine fois, une simple <b>pause</b> suffit, sans rien perdre.", "info") + button("Recommander", `${SITE()}/#composer`) + P(`Un mot sur ce qui n'allait pas nous aiderait beaucoup : répondez à ce mail ou appelez le ${TELN}.`, "font-size:16px;color:" + C.ardoise + ";margin-top:16px"),
    raison: "Vous recevez ce message pour confirmer la fin de votre abonnement.",
  }),
  finEquipe: ({ nom, cid }) => equipe({ subject: `Abonnement arrêté : ${nom}`, tone: "jaune", tag: "Résiliation", title: esc(nom), lead: "L'abonnement est terminé. Un appel pour comprendre pourquoi vaut de l'or.", cta: ["Voir la fiche", `${SITE()}/admin.html#client=${cid}`] }),

  // Messagerie
  reponseClient: (texte) => client({ subject: "Resto Pickup vous a répondu", preheader: String(texte).slice(0, 90), eyebrow: "Message", title: "Nous vous avons répondu.", body: citation(nl(texte), "L'équipe Resto Pickup") + button("Répondre depuis mon espace", `${SITE()}/mon-compte.html`), raison: "Vous recevez ce message parce que vous avez écrit à Resto Pickup.", sign: false }),
  messageEquipe: ({ nom, email, texte, cid }) => equipe({ subject: `Message de ${nom}`, tone: "bleu", tag: "Message client", title: esc(nom), lead: esc(email), body: citation(nl(texte)), cta: ["Répondre dans l'admin", `${SITE()}/admin.html#client=${cid}`], replyTo: email }),

  // Actions de l'espace client : accusé au client, fiche à l'équipe
  actionClient: (type, d) => {
    const M = {
      absence: ["Votre absence est bien notée", "Pas de livraison, pas de prélèvement.", `Pas de livraison le <b>${esc(d.debut)}</b>${d.semaines > 1 ? ` ni les ${d.semaines - 1} semaines suivantes` : ""}, et <b>rien n'est prélevé</b>. Les livraisons reprennent toutes seules le <b>${esc(d.reprise)}</b>.`, "ok"],
      reprise: ["Vos livraisons reprennent", "Retour à la normale dès la semaine prochaine.", "Votre absence est annulée : livraisons et prélèvements reprennent dès la semaine prochaine.", "ok"],
      formule: ["Votre nouvelle formule est enregistrée", d.resume, `À partir de la prochaine livraison : <b>${esc(d.resume)}</b>, soit ${esc(d.repas)} repas par semaine.`, "ok"],
      adresse: ["Votre adresse de livraison est modifiée", "Le livreur a la nouvelle adresse.", `Nouvelle adresse : <b>${esc(d.adresse)}</b>${d.consignes ? `<br>Consignes : ${esc(d.consignes)}` : ""}`, "ok"],
      cadeau: ["Votre carte cadeau est créditée", `${d.montant} déduits de vos prochains paiements.`, `La carte <b>${esc(d.code)}</b> est enregistrée : <b>${esc(d.montant)}</b> seront déduits de vos prochains paiements, semaine après semaine.`, "ok"],
    }[type];
    return client({ subject: M[0], preheader: M[1], eyebrow: "C'est enregistré", title: M[0] + ".", body: note(M[2], M[3]) + P(`Une erreur ? Modifiez depuis votre espace ou appelez le ${TELN}.`, "font-size:16px;color:" + C.ardoise) + button("Mon espace", `${SITE()}/mon-compte.html`), raison: "Vous recevez ce message pour confirmer une modification faite depuis votre espace." });
  },
  actionEquipe: ({ titre, nom, email, tel, detail, cid }) => equipe({ subject: `Espace client : ${titre} (${nom})`, tone: "jaune", tag: titre.charAt(0).toUpperCase() + titre.slice(1), title: esc(nom), lead: [esc(email), esc(tel)].filter(Boolean).join(" · "), body: note(detail, "info"), cta: ["Voir la fiche", `${SITE()}/admin.html#client=${cid}`], replyTo: email }),

  // Cartes cadeaux
  cadeauAcheteur: (c, lien) => client({
    subject: `Votre carte cadeau pour ${c.pour} est prête`, preheader: `${c.repas} repas, code ${c.code}. À imprimer ou à transférer.`, eyebrow: "Carte cadeau", title: `Un beau cadeau pour ${esc(c.pour)}.`,
    body: P(`Merci ${esc(c.de)} ! Voici la carte : <b>${esc(c.repas)} repas</b>, soit ${eur(c.montant)}, valable un an.`) + carteCadeau(c) + button("Imprimer ou transférer la carte", lien)
      + etapes(["Offrez la carte, imprimée ou transférée par e-mail.", `Votre proche commande en ligne avec le code, ou par téléphone au ${TELN}.`, "Les repas arrivent chez lui, en main propre."]),
    raison: "Vous recevez ce message suite à l'achat d'une carte cadeau sur restopickup.com.",
  }),
  cadeauEquipe: (g, montant, email) => equipe({ subject: `Carte cadeau vendue : ${g.repas} repas`, tone: "vert", tag: "Carte cadeau", title: `${esc(g.de)} offre ${esc(g.repas)} repas à ${esc(g.pour)}`, body: fiche([["Code", esc(g.code_cadeau)], ["Montant", eur(montant)], ["Acheteur", esc(email)]]), cta: ["Ouvrir l'admin", `${SITE()}/admin.html`] }),

  // Demandes du site (rappel, professionnel, flyers)
  demandeEquipe: ({ type, titre, champs, email }) => equipe({ subject: `${titre} : ${champs.nom || champs.tel || ""}`, tone: type === "rappel" ? "rouge" : "jaune", tag: titre, title: esc(champs.nom || champs.tel || "Demande"), lead: type === "rappel" ? "À rappeler au plus vite." : "", body: fiche(Object.entries(champs).filter(([, v]) => v).map(([k, v]) => [k, nl(v)])), cta: ["Voir les demandes", `${SITE()}/admin.html`], replyTo: email }),
  demandeAccuse: ({ type, prenom }) => client({
    subject: type === "rappel" ? "On vous rappelle très vite" : "Votre demande est bien reçue", preheader: "Une vraie personne s'en occupe.", eyebrow: type === "rappel" ? "Rappel" : "Demande reçue",
    title: type === "rappel" ? `Bonjour${prenom ? " " + esc(prenom) : ""}, on vous rappelle.` : "Merci, c'est bien reçu.",
    body: P(type === "rappel" ? "Votre demande est bien arrivée. Nous vous rappelons du lundi au vendredi, en général dans la journée. Pas besoin d'avoir un ordinateur : on fait la commande ensemble, au téléphone." : "Votre demande est bien arrivée, nous revenons vers vous rapidement.") + note(`Pressé ? Appelez directement le <b>${TELN}</b>.`, "info"),
    raison: "Vous recevez ce message parce que vous avez rempli un formulaire sur restopickup.com.",
  }),

  // Remboursement
  remboursementClient: ({ montant, motif, total }) => client({
    subject: `Nous vous remboursons ${eur(montant).replace("\u00a0", " ")}`, preheader: "Le montant revient sur votre carte ou votre compte sous 5 à 10 jours.", eyebrow: "Remboursement",
    title: `Nous vous remboursons ${eur(montant)}.`,
    body: (motif ? P(`Motif : ${esc(motif)}.`) : "") + ticket([["Remboursement", eur(montant), total ? "Paiement remboursé en totalité" : "Remboursement partiel"]], null, null)
      + note("L'argent revient sur la carte ou le compte utilisé pour payer, en général sous <b>5 à 10 jours</b> selon votre banque. Vous n'avez rien à faire.", "ok"),
    raison: "Vous recevez ce message pour confirmer un remboursement de Resto Pickup.",
  }),
  remboursementEquipe: ({ nom, montant, motif, par, cid }) => equipe({ subject: `Remboursement : ${eur(montant).replace("\u00a0", " ")} à ${nom}`, tone: "jaune", tag: "Remboursement", title: `${eur(montant)} remboursés à ${esc(nom)}`, body: fiche([["Motif", esc(motif) || "non précisé"], ["Fait par", esc(par)]]), cta: cid ? ["Voir la fiche", `${SITE()}/admin.html#client=${cid}`] : null }),

  // Bug technique
  bug: ({ where, msg, n, extra }) => equipe({ subject: `Bug sur le site : ${where}`, tone: "rouge", tag: "Erreur technique", title: esc(where), lead: n ? `${n} fois depuis la dernière alerte.` : "Une erreur vient de se produire.", body: `<pre style="white-space:pre-wrap;word-break:break-word;font:13px/1.5 Menlo,Consolas,monospace;background:${C.farine};color:${C.marine};padding:14px;border-radius:10px;margin:0 0 12px">${esc(msg)}</pre>${extra ? `<p style="font:14px/1.5 ${SANS};color:${C.ardoise}">${esc(extra)}</p>` : ""}` }),
};

module.exports = { T, esc, eur, dlong, joursTxt, SVC, JN };
