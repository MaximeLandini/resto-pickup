// Menu public : semaine en cours et suivante, seulement si publiées depuis l'espace équipe.
const M = require("./_menu");
module.exports = async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const lun = M.lundi(String((req.query && req.query.semaine) || today));
  const byId = Object.fromEntries((await M.recettes()).map((r) => [r.id, r]));
  const semaines = [];
  for (const l of [lun, M.addDays(lun, 7)]) { const m = await M.menu(l); if (m.publie) semaines.push(M.resoudre(m, byId)); }
  res.setHeader("cache-control", "public, max-age=300");
  return res.status(200).json({ semaines });
};
