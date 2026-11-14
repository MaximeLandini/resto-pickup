// Erreurs JavaScript remontées par les navigateurs des visiteurs : e-mail à l'équipe (une alerte par erreur et par heure).
const { body, reportBug } = require("./_lib");
const hits = new Map();
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const ip = String(req.headers["x-nf-client-connection-ip"] || req.headers["x-forwarded-for"] || "").split(",")[0];
  const n = (hits.get(ip) || 0) + 1; hits.set(ip, n);
  if (n > 20) return res.status(204).end();
  let b = {}; try { b = body(req); } catch (e) { return res.status(204).end(); }
  const msg = String(b.msg || "").slice(0, 500), page = String(b.page || "").slice(0, 200), src = String(b.src || "").slice(0, 300);
  if (!msg || /ResizeObserver|Script error\.?$|extension:\/\/|chrome-extension/i.test(msg + src)) return res.status(204).end();
  const ua = String(req.headers["user-agent"] || "").slice(0, 200).replace(/[<>&]/g, "");
  await reportBug("navigateur, " + page, msg + (src ? "\n" + src : ""), "Appareil : " + ua);
  return res.status(204).end();
};
