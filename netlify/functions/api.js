// Point d'entrée unique Netlify : /api/<nom> → api/<nom>.js
// Les gestionnaires sont écrits au format (req, res) ; cet adaptateur fait la traduction.
const R = {
  checkout: require("../../api/checkout"),
  login: require("../../api/login"),
  verify: require("../../api/verify"),
  account: require("../../api/account"),
  action: require("../../api/action"),
  messages: require("../../api/messages"),
  rappel: require("../../api/rappel"),
  cadeau: require("../../api/cadeau"),
  lien: require("../../api/lien"),
  webhook: require("../../api/webhook"),
  "admin-login": require("../../api/admin-login"),
  admin: require("../../api/admin"),
};

exports.handler = async (event) => {
  const name = String(event.path || "").replace(/^.*\/(api|\.netlify\/functions\/api)\/?/, "").split("/")[0];
  const fn = R[name];
  if (!fn) return { statusCode: 404, body: JSON.stringify({ error: "Inconnu" }) };
  const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event.body || "";
  const headers = {};
  for (const k in event.headers || {}) headers[k.toLowerCase()] = event.headers[k];
  const req = { method: event.httpMethod, headers, body: raw, rawBody: raw, query: event.queryStringParameters || {} };
  return new Promise((resolve) => {
    let code = 200; const h = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
    const res = {
      status(c) { code = c; return res; },
      setHeader(k, v) { h[k.toLowerCase()] = v; return res; },
      json(o) { resolve({ statusCode: code, headers: h, body: JSON.stringify(o) }); },
      send(s) { resolve({ statusCode: code, headers: h, body: String(s) }); },
      end() { resolve({ statusCode: code, headers: h, body: "" }); },
    };
    let p; try { p = Promise.resolve(fn(req, res)); } catch (e) { p = Promise.reject(e); }
    p.catch((e) => { console.error(e); resolve({ statusCode: e.status || 500, headers: h, body: JSON.stringify({ error: e.status === 503 ? "Service pas encore configuré, appelez le 06 60 68 05 07" : "Erreur serveur" }) }); });
  });
};
