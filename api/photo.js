// Photos des recettes, stockées dans Netlify Blobs (JPEG en base64)
const store = require("./_store");
module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || "").replace(/[^a-z0-9]/gi, "").slice(0, 40);
  const p = id && (await store.get(`photo/${id}`));
  if (!p || !p.data) return res.status(404).json({ error: "Photo introuvable" });
  res.setHeader("content-type", p.type || "image/jpeg");
  res.setHeader("cache-control", "public, max-age=31536000, immutable");
  return res.binary(Buffer.from(p.data, "base64"));
};
