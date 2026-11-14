// Espace admin : POST { action, ... } avec le jeton équipe (Authorization: Bearer).
const { stripe, body, verifyAdmin, sendMail, weekly, nextDelivery, ZONES, site } = require("./_lib");
const { fee, REPAS_MIN, findGift } = require("./_commande");
const store = require("./_store");
const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ACTIFS = ["active", "trialing", "past_due"];
const day = (iso) => new Date(iso + "T12:00:00");
const isoOf = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

function lieu(adr) { const m = /(\d{5})\s+([^,]+)$/.exec(String(adr || "").trim()); return m ? { cp: m[1], commune: m[2].trim() } : { cp: "", commune: "" }; }
function shape(s) {
  const m = s.metadata || {}, c = typeof s.customer === "object" ? s.customer : { id: s.customer };
  const pause = s.pause_collection && s.pause_collection.resumes_at ? isoOf(new Date(s.pause_collection.resumes_at * 1000)) : null;
  return {
    sub: s.id, cid: c.id, email: c.email || "", nom: m.livre_nom || c.name || "", tel: m.livre_tel || c.phone || "", adresse: m.livre_adresse || "", ...lieu(m.livre_adresse),
    consignes: m.consignes || "", payeur: m.payeur || "", pour: m.pour || "moi", zone: m.zone || "", service: m.service || "soir", jours: m.jours || "", personnes: +m.personnes || 1,
    statut: s.cancel_at_period_end ? "fin_programmee" : s.status, pauseJusquau: pause, debut: m.premiere_livraison || isoOf(new Date(s.created * 1000)),
    hebdo: weekly(s), canal: m.canal || "site", cree: isoOf(new Date(s.created * 1000)), essai: false,
  };
}
async function allSubs() {
  const list = await stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer"] }).autoPagingToArray({ limit: 2000 });
  return list.map(shape);
}
async function essais(sinceDays = 21) {
  const since = Math.floor(Date.now() / 1000) - sinceDays * 86400;
  const ss = await stripe.checkout.sessions.list({ limit: 100, created: { gte: since } }).autoPagingToArray({ limit: 500 });
  return ss.filter((s) => s.mode === "payment" && s.payment_status === "paid" && s.metadata && s.metadata.service && s.metadata.essai === "1").map((s) => {
    const m = s.metadata;
    return { sub: null, session: s.id, cid: s.customer, email: (s.customer_details || {}).email || "", nom: m.livre_nom, tel: m.livre_tel, adresse: m.livre_adresse, ...lieu(m.livre_adresse), consignes: m.consignes, payeur: m.payeur, pour: m.pour,
      zone: m.zone, service: m.service, jours: m.jours, personnes: +m.personnes || 1, statut: "essai", debut: m.premiere_livraison, hebdo: (s.amount_total || 0) / 100, canal: m.canal || "site", cree: isoOf(new Date(s.created * 1000)), essai: true };
  });
}
// Qui est livré à cette date ?
function livresLe(clients, dateIso) {
  const wd = day(dateIso).getDay();
  return clients.filter((c) => {
    const z = ZONES[c.zone]; if (!z || z.jour % 7 !== wd) return false;
    if (c.essai) return c.debut === dateIso;
    if (!ACTIFS.includes(c.statut) && c.statut !== "fin_programmee") return false;
    if (c.debut && c.debut > dateIso) return false;
    if (c.pauseJusquau && c.pauseJusquau > dateIso) return false;
    return true;
  });
}
const barquettes = (c) => c.jours.length * (c.service === "midi-soir" ? 2 : 1) * c.personnes;

// Durées de conservation de la politique de confidentialité, appliquées automatiquement
async function purge() {
  const last = await store.get("cfg/purge");
  if (last && Date.now() - last.t < 864e5) return;
  await store.set("cfg/purge", { t: Date.now() });
  const now = Date.now(), an = 365 * 864e5;
  for (const k of await store.list("req/")) { const r = await store.get(k); if (r && now - Date.parse(r.date) > an) await store.del(k); }
  for (const k of await store.list("bug/")) { const r = await store.get(k); if (r && now - r.t > 30 * 864e5) await store.del(k); }
  for (const k of await store.list("evt/")) { const t = +k.split("/")[1].split("-")[0]; if (t && now - t > 90 * 864e5) await store.del(k); }
  for (const k of await store.list("deliv/")) { const d = k.split("/")[1]; if (d && now - Date.parse(d) > an) await store.del(k); }
  for (const k of await store.list("msg/")) { const t = await store.get(k); if (t && t.dernier && now - Date.parse(t.dernier) > 3 * an) await store.del(k); }
  for (const k of await store.list("adminlogin/")) { const r = await store.get(k); if (r && r.exp < now) await store.del(k); }
  for (const k of await store.list("adminlock/")) { const r = await store.get(k); if (r && now - r.t > 3600e3) await store.del(k); }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const admin = verifyAdmin(req);
  if (!admin) return res.status(401).json({ error: "Session équipe expirée" });
  try {
    const b = body(req), a = b.action;

    if (a === "overview") purge().catch((e) => console.error("purge", e.message)); // durées de conservation (une fois par jour)
    /* ---------- Menus et étiquettes ---------- */
    if (a.startsWith("menu_") || a.startsWith("recette") || a === "etiquettes") {
      const M = require("./_menu");
      if (a === "recettes") return res.status(200).json({ recettes: await M.recettes(), allergenes: M.ALLERGENES });
      if (a === "recette_save") {
        const old = b.id ? await store.get(`recette/${String(b.id).replace(/[^a-z0-9]/gi, "")}`) : null;
        const r = M.normRecette(b, old || {});
        if (!r.nom) return res.status(400).json({ error: "Nom de la recette obligatoire" });
        if (b.photo && /^data:image\/(jpeg|png|webp);base64,/.test(b.photo)) {
          const [head, data] = b.photo.split(",");
          if (data.length > 1.5e6) return res.status(400).json({ error: "Photo trop lourde (1 Mo maximum)" });
          const pid = M.uid();
          await store.set(`photo/${pid}`, { type: head.slice(5, head.indexOf(";")), data });
          if (r.photo) await store.del(`photo/${r.photo}`).catch(() => {});
          r.photo = pid;
        }
        await store.set(`recette/${r.id}`, r);
        return res.status(200).json({ recette: r });
      }
      if (a === "recette_delete") {
        const id = String(b.id || "").replace(/[^a-z0-9]/gi, ""); const r = await store.get(`recette/${id}`);
        if (r && r.photo) await store.del(`photo/${r.photo}`).catch(() => {});
        await store.del(`recette/${id}`);
        return res.status(200).json({ ok: true });
      }
      if (a === "menu_get") { const l = M.lundi(b.semaine || new Date().toISOString()); return res.status(200).json({ menu: await M.menu(l) }); }
      if (a === "menu_save") {
        const l = M.lundi(b.semaine), jours = {};
        for (let j = 1; j <= 7; j++) for (const sv of M.SVCS) { const x = ((b.jours || {})[j] || {})[sv] || {}; if (x.plat || x.dessert) { jours[j] = jours[j] || {}; jours[j][sv] = { plat: String(x.plat || "").slice(0, 40), dessert: String(x.dessert || "").slice(0, 40) }; } }
        const m = { lundi: l, publie: !!b.publie, jours, maj: new Date().toISOString(), par: admin };
        await store.set(`menu/${l}`, m);
        return res.status(200).json({ menu: m });
      }
      if (a === "etiquettes") {
        const date = String(b.date || "").slice(0, 10);
        const clients = livresLe((await allSubs()).concat(await essais(28)), date).sort((x, y) => (x.zone + x.commune + x.adresse).localeCompare(y.zone + y.commune + y.adresse, "fr"));
        return res.status(200).json({ date, ...(await M.etiquettes(clients, date)) });
      }
    }

    if (a === "rembourser") {
      // Remboursement total ou partiel d'un paiement : l'argent revient sur la carte ou le compte du client (5 à 10 jours)
      const pid = String(b.pi || ""); if (!/^pi_/.test(pid)) return res.status(400).json({ error: "Paiement inconnu" });
      const pi = await stripe.paymentIntents.retrieve(pid, { expand: ["latest_charge"] });
      const ch = pi.latest_charge || {}, reste = (pi.amount_received || 0) - (ch.amount_refunded || 0);
      const montant = b.montant ? Math.round(parseFloat(String(b.montant).replace(",", ".")) * 100) : reste;
      if (!(montant > 0) || montant > reste) return res.status(400).json({ error: `Montant impossible : ${(reste / 100).toFixed(2).replace(".", ",")} € remboursables au maximum` });
      const motif = String(b.motif || "").slice(0, 200);
      const r = await stripe.refunds.create({ payment_intent: pid, amount: montant, reason: "requested_by_customer", metadata: { par: admin, motif } }, { idempotencyKey: `rp-${pid}-${montant}-${reste}` });
      const { T } = require("./_mail"), { team } = require("./_lib");
      const c = pi.customer ? await stripe.customers.retrieve(typeof pi.customer === "string" ? pi.customer : pi.customer.id).catch(() => ({})) : {};
      if (c.email && b.prevenir !== false) await sendMail(c.email, T.remboursementClient({ montant, motif, total: montant === reste && !ch.amount_refunded })).catch((e) => console.error(e));
      await sendMail(team(), T.remboursementEquipe({ nom: c.name || c.email || "Client", montant, motif, par: admin, cid: c.id })).catch(() => {});
      return res.status(200).json({ ok: true, rembourse: montant / 100, statut: r.status });
    }

    if (a === "effacer") {
      // Droit à l'effacement : supprime messages, notes, statuts de livraison et anonymise la fiche Stripe (les factures restent, obligation légale)
      const cid = String(b.cid || ""); if (!/^cus_/.test(cid)) return res.status(400).json({ error: "Client inconnu" });
      const subs = await stripe.subscriptions.list({ customer: cid, status: "all", limit: 20 });
      for (const sub of subs.data) {
        if (["active", "trialing", "past_due"].includes(sub.status)) return res.status(400).json({ error: "Arrêtez d'abord l'abonnement" });
        await stripe.subscriptions.update(sub.id, { metadata: { livre_nom: "", livre_adresse: "", livre_tel: "", livre_email: "", consignes: "", payeur: "", livre_commune: "" } }).catch(() => {});
      }
      await stripe.customers.update(cid, { name: "Client effacé", phone: "", address: null, shipping: null, metadata: { efface: new Date().toISOString().slice(0, 10), efface_par: admin } });
      for (const k of [`msg/${cid}`, `note/${cid}`]) await store.del(k).catch(() => {});
      for (const k of await store.list("deliv/")) if (k.endsWith("/" + cid)) await store.del(k).catch(() => {});
      return res.status(200).json({ ok: true });
    }

    if (a === "overview") {
      const [subs, ess, threads, reqs] = await Promise.all([allSubs(), essais(), store.list("msg/"), store.list("req/")]);
      const clients = subs.concat(ess);
      const actifs = subs.filter((c) => ACTIFS.includes(c.statut) || c.statut === "fin_programmee");
      const prochaines = Object.values(ZONES).map((z) => z.jour).filter((v, i, t) => t.indexOf(v) === i).map((j) => {
        const d = isoOf(nextDelivery(j, new Date(Date.now() - 3 * 864e5)));
        const l = livresLe(clients, d);
        return { date: d, arrets: l.length, barquettes: l.reduce((t, c) => t + barquettes(c), 0) };
      });
      const th = await Promise.all(threads.map((k) => store.get(k)));
      const rq = await Promise.all(reqs.map((k) => store.get(k)));
      return res.status(200).json({
        clients, prochaines,
        kpi: { actifs: actifs.length, hebdo: Math.round(actifs.filter((c) => !c.pauseJusquau).reduce((t, c) => t + c.hebdo, 0) * 100) / 100,
          impayes: subs.filter((c) => c.statut === "past_due").length, enPause: actifs.filter((c) => c.pauseJusquau).length,
          nouveaux7j: clients.filter((c) => c.cree >= isoOf(new Date(Date.now() - 7 * 864e5))).length,
          messagesNonLus: th.filter((t) => t && t.nonLu).length, demandesOuvertes: rq.filter((r) => r && r.statut !== "traite").length },
      });
    }

    if (a === "tournee") {
      const date = String(b.date || "").slice(0, 10);
      const clients = (await allSubs()).concat(await essais(28));
      const l = livresLe(clients, date).sort((x, y) => (x.zone + x.commune + x.adresse).localeCompare(y.zone + y.commune + y.adresse, "fr"));
      const etats = await Promise.all(l.map((c) => store.get(`deliv/${date}/${c.cid}`)));
      return res.status(200).json({ date, arrets: l.map((c, i) => ({ ...c, barquettes: barquettes(c), etat: etats[i] || null })) });
    }

    if (a === "livraison") {
      const k = `deliv/${String(b.date).slice(0, 10)}/${b.cid}`;
      await store.set(k, { statut: b.statut, note: String(b.note || "").slice(0, 300), par: admin, date: new Date().toISOString() });
      return res.status(200).json({ ok: true });
    }

    if (a === "client") {
      const c = await stripe.customers.retrieve(b.cid);
      const subs = await stripe.subscriptions.list({ customer: b.cid, status: "all", limit: 10, expand: ["data.customer"] });
      const inv = await stripe.invoices.list({ customer: b.cid, limit: 12 });
      const pis = await stripe.paymentIntents.list({ customer: b.cid, limit: 20, expand: ["data.latest_charge"] }).catch(() => ({ data: [] }));
      const t = await store.thread(b.cid);
      if (t.nonLu) { t.nonLu = 0; await store.set(`msg/${b.cid}`, t); }
      const note = await store.get(`note/${b.cid}`, { texte: "" });
      return res.status(200).json({
        client: { cid: c.id, nom: c.name, email: c.email, tel: c.phone, avoir: c.balance < 0 ? -c.balance / 100 : 0, cree: isoOf(new Date(c.created * 1000)) },
        abonnements: subs.data.map(shape), factures: inv.data.map((i) => ({ date: isoOf(new Date(i.created * 1000)), montant: i.total / 100, statut: i.status, lien: i.hosted_invoice_url })),
        paiements: pis.data.filter((p) => p.status === "succeeded" || p.status === "processing").map((p) => { const ch = typeof p.latest_charge === "object" && p.latest_charge ? p.latest_charge : {}; return { id: p.id, date: isoOf(new Date(p.created * 1000)), montant: (p.amount_received || p.amount) / 100, rembourse: (ch.amount_refunded || 0) / 100, statut: p.status, libelle: p.description || "" }; }),
        messages: t.messages, note: note.texte,
      });
    }

    if (a === "modifier") {
      const s = await stripe.subscriptions.retrieve(b.sub);
      const m = s.metadata || {};
      if (b.type === "change") {
        const service = ["midi", "soir", "midi-soir"].includes(b.service) ? b.service : "soir";
        const jours = [...new Set(String(b.jours || "").replace(/[^1-7]/g, "").split(""))].sort().join("");
        const personnes = String(b.personnes) === "2" ? 2 : 1;
        const repas = jours.length * (service === "midi-soir" ? 2 : 1) * personnes;
        if (repas < REPAS_MIN) return res.status(400).json({ error: `Minimum ${REPAS_MIN} repas` });
        const cat = await require("./_setup").catalog();
        const itRepas = s.items.data.find((i) => i.price.id === cat.repas) || s.items.data[0];
        const itLiv = s.items.data.find((i) => i.id !== itRepas.id);
        const liv = { currency: "eur", unit_amount: fee(repas), product: cat.livraison, recurring: { interval: "week" } };
        await stripe.subscriptions.update(s.id, { items: [{ id: itRepas.id, quantity: repas }, itLiv ? { id: itLiv.id, price_data: liv, quantity: 1 } : { price_data: liv, quantity: 1 }], proration_behavior: "none", metadata: { service, jours, personnes: String(personnes) } });
      } else if (b.type === "pause") {
        const z = ZONES[m.zone] || ZONES["le-mans"];
        const semaines = Math.min(12, Math.max(1, +b.semaines || 1));
        const resume = new Date(nextDelivery(z.jour).getTime() + (7 * (semaines - 1) + 4) * 864e5);
        await stripe.subscriptions.update(s.id, { pause_collection: { behavior: "void", resumes_at: Math.floor(resume / 1000) } });
      } else if (b.type === "reprendre") {
        await stripe.subscriptions.update(s.id, { pause_collection: "" });
      } else if (b.type === "arreter") {
        await stripe.subscriptions.update(s.id, { cancel_at_period_end: true });
      } else if (b.type === "annuler") {
        // arrêt immédiat, sans attendre la fin de la semaine payée (le remboursement éventuel se fait ensuite, paiement par paiement)
        await stripe.subscriptions.cancel(s.id, { invoice_now: false, prorate: false });
      } else if (b.type === "reactiver") {
        await stripe.subscriptions.update(s.id, { cancel_at_period_end: false });
      } else if (b.type === "adresse") {
        await stripe.subscriptions.update(s.id, { metadata: { livre_adresse: String(b.adresse || "").slice(0, 300), consignes: String(b.consignes || "").slice(0, 450), livre_tel: String(b.tel || m.livre_tel || "").slice(0, 20) } });
      } else return res.status(400).json({ error: "Action inconnue" });
      return res.status(200).json({ ok: true });
    }

    if (a === "note") { await store.set(`note/${b.cid}`, { texte: String(b.texte || "").slice(0, 5000), par: admin, date: new Date().toISOString() }); return res.status(200).json({ ok: true }); }

    if (a === "repondre") {
      const texte = String(b.texte || "").trim().slice(0, 2000);
      if (!texte) return res.status(400).json({ error: "Message vide" });
      const c = await stripe.customers.retrieve(b.cid);
      const t = await store.addMessage(b.cid, "equipe", texte, c.name || c.email);
      if (c.email) await sendMail(c.email, require("./_mail").T.reponseClient(texte)).catch((e) => console.error(e));
      return res.status(200).json({ messages: t.messages });
    }

    if (a === "messages") {
      const keys = await store.list("msg/");
      const th = (await Promise.all(keys.map((k) => store.get(k)))).filter(Boolean).sort((x, y) => String(y.dernier).localeCompare(String(x.dernier)));
      return res.status(200).json({ fils: th.map((t) => ({ cid: t.cid, nom: t.nom, nonLu: t.nonLu || 0, dernier: t.dernier, apercu: (t.messages[t.messages.length - 1] || {}).texte || "" })) });
    }

    if (a === "demandes") {
      const keys = await store.list("req/");
      const rq = (await Promise.all(keys.map((k) => store.get(k)))).filter(Boolean).sort((x, y) => y.date.localeCompare(x.date));
      return res.status(200).json({ demandes: rq });
    }
    if (a === "demande") {
      const r = await store.get(`req/${b.id}`); if (!r) return res.status(404).json({ error: "Introuvable" });
      r.statut = b.statut === "traite" ? "traite" : b.statut === "en_cours" ? "en_cours" : "nouveau"; r.note = String(b.note || r.note || "").slice(0, 500); r.par = admin;
      await store.set(`req/${b.id}`, r); return res.status(200).json({ ok: true });
    }

    if (a === "cadeaux") {
      const r = await stripe.paymentIntents.search({ query: "metadata['type']:'carte_cadeau' AND status:'succeeded'", limit: 100 });
      return res.status(200).json({ cartes: r.data.map((p) => ({ code: p.metadata.code_cadeau, montant: p.amount_received / 100, repas: +p.metadata.repas, de: p.metadata.de, pour: p.metadata.pour, achat: isoOf(new Date(p.created * 1000)), expire: isoOf(new Date(+p.metadata.expire * 1000)), utilisee: p.metadata.utilisee || "" })) });
    }

    return res.status(400).json({ error: "Action inconnue" });
  } catch (e) { console.error(e); await require("./_lib").reportBug("/api/admin", e); return res.status(500).json({ error: e.message || "Erreur" }); }
};
