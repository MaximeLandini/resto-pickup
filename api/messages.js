// Messagerie client ↔ équipe. GET : le fil du client connecté. POST { texte } : nouveau message (e-mail à l'équipe).
const { stripe, verifyToken, body, sendMail } = require("./_lib");
const store = require("./_store");
const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
module.exports = async (req, res) => {
  const cid = verifyToken(req);
  if (!cid || cid.startsWith("admin:")) return res.status(401).json({ error: "Session expirée" });
  try {
    if (req.method === "GET") {
      const t = await store.thread(cid);
      if (t.nonLuClient) { t.nonLuClient = 0; await store.set(`msg/${cid}`, t); }
      return res.status(200).json({ messages: t.messages });
    }
    if (req.method !== "POST") return res.status(405).end();
    const texte = String(body(req).texte || "").trim().slice(0, 2000);
    if (texte.length < 2) return res.status(400).json({ error: "Message vide" });
    const c = await stripe.customers.retrieve(cid);
    const t = await store.addMessage(cid, "client", texte, c.name || c.email);
    await sendMail(process.env.MAIL_EQUIPE, `Message de ${c.name || c.email}`, `<p><b>${esc(c.name || "")}</b> (${esc(c.email || "")}) a écrit :</p><blockquote style="border-left:4px solid #E04A2F;padding-left:12px">${esc(texte).replace(/\n/g, "<br>")}</blockquote><p><a href="${process.env.SITE_URL}/admin.html#client=${cid}">Répondre depuis l'espace admin</a></p>`, c.email).catch(() => {});
    return res.status(200).json({ messages: t.messages });
  } catch (e) { console.error(e); return res.status(500).json({ error: "Erreur" }); }
};
