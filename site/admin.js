/* Resto Pickup : espace équipe (pilotage). Données réelles via /api/admin, ou démonstration si apiBase est vide. */
(function () {
  var root = document.getElementById("adm");
  if (!root) return;
  var C = window.RP || {}, API = String(C.apiBase || "").replace(/\/$/, ""), LIVE = !!C.apiBase;
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var euro = function (n) { return (+n || 0).toFixed(2).replace(".", ",") + " €"; };
  var JN = ["", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."], JL = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  var SVC = { midi: "Midi", soir: "Soir", "midi-soir": "Midi et soir" };
  var ST = { active: ["Actif", "ok"], trialing: ["Actif", "ok"], past_due: ["Impayé", "bad"], canceled: ["Arrêté", "off"], fin_programmee: ["Fin programmée", "warn"], essai: ["Essai", "info"], incomplete: ["Incomplet", "off"], incomplete_expired: ["Abandonné", "off"], unpaid: ["Impayé", "bad"], paused: ["En pause", "warn"] };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };
  var token = store.get("rp-admin-token"), demo = false, DATA = null;
  var iso = function (d) { return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  var dlong = function (s) { return new Date(s + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); };
  var dshort = function (s) { return s ? new Date(s + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : ""; };
  var jourOf = function (z) { return ((C.zones || []).filter(function (x) { return x.id === z; })[0] || {}).jour; };
  var repasOf = function (c) { return c.jours.length * (c.service === "midi-soir" ? 2 : 1) * c.personnes; };
  var daysLab = function (j) { return j === "1234567" ? "tous les jours" : j === "12345" ? "lun. au ven." : j === "1357" ? "un jour sur deux" : j.split("").map(function (d) { return JN[+d]; }).join(" "); };

  function call(action, data) {
    if (demo) return Promise.resolve(DEMO(action, data || {}));
    var b = Object.assign({ action: action }, data || {});
    return fetch(API + "/api/admin", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(b) })
      .then(function (r) { return r.json().then(function (j) { if (r.status === 401) { logout(); throw new Error("Session expirée"); } if (!r.ok) throw new Error(j.error || "Erreur"); return j; }); });
  }

  /* ---------- Connexion ---------- */
  var email = "";
  $("al-1").addEventListener("submit", function (e) {
    e.preventDefault(); email = $("al-email").value.trim(); $("al-err").textContent = "";
    if (!LIVE) { $("al-err").textContent = "Le serveur n'est pas encore branché : ouvrez la démonstration."; return; }
    fetch(API + "/api/admin-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email }) })
      .then(function () { $("al-1").hidden = true; $("al-2").hidden = false; $("al-code").focus(); });
  });
  $("al-2").addEventListener("submit", function (e) {
    e.preventDefault();
    fetch(API + "/api/admin-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email, code: $("al-code").value }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); return j; }); })
      .then(function (j) { token = j.token; store.set("rp-admin-token", token); store.set("rp-admin-email", email); start(); })
      .catch(function (er) { $("al-err").textContent = er.message || "Code incorrect"; });
  });
  if (!LIVE) $("al-demo").hidden = false;
  $("al-demo").addEventListener("click", function () { demo = true; start(); });
  function logout() { token = null; store.set("rp-admin-token", null); $("adm-app").hidden = true; $("adm-login").hidden = false; }
  $("adm-out").addEventListener("click", logout);

  function start() {
    $("adm-login").hidden = true; $("adm-app").hidden = false; $("adm-demo").hidden = !demo;
    $("adm-who").textContent = demo ? "Démonstration" : (store.get("rp-admin-email") || "");
    load().then(function () {
      var h = /client=([\w]+)/.exec(location.hash); if (h) openClient(h[1]);
    });
    if (!demo) checkSetup();
  }
  // Vérifie Stripe, webhook, portail et e-mails ; crée ce qui manque. Bandeau seulement en cas de problème.
  function checkSetup() {
    fetch(API + "/api/setup", { headers: { Authorization: "Bearer " + token } }).then(function (r) { return r.json(); }).then(function (j) {
      var pb = [];
      if (!j.stripe) pb.push("clé Stripe absente (variable STRIPE_SECRET_KEY)");
      else if (!j.ok) pb.push("Stripe : " + (j.erreur || "configuration incomplète"));
      if (!j.brevo) pb.push("aucun e-mail ne part : clé Brevo absente (variable BREVO_API_KEY)");
      var el = $("adm-demo");
      if (pb.length) { el.hidden = false; el.textContent = "À régler : " + pb.join(" ; ") + "."; el.classList.add("adm-warn"); }
    }).catch(function () {});
  }

  /* ---------- Navigation ---------- */
  function tab(name) {
    $$("[data-tab]").forEach(function (b) { b.toggleAttribute("aria-current", b.dataset.tab === name); if (b.dataset.tab === name) b.setAttribute("aria-current", "page"); });
    $$("[data-panel]").forEach(function (p) { p.hidden = p.dataset.panel !== name; });
    if (name === "tournee") loadRun();
    if (name === "prod") renderProd();
    if (name === "messages") loadThreads();
    if (name === "demandes") loadReqs();
    if (name === "cadeaux") loadGifts();
    if (name === "clients") renderClients();
    window.scrollTo(0, 0);
  }
  $$("[data-tab]").forEach(function (b) { b.addEventListener("click", function () { tab(b.dataset.tab); }); });
  document.addEventListener("click", function (e) { if (e.target.closest("[data-refresh]")) load(); var g = e.target.closest("[data-goto]"); if (g) tab(g.dataset.goto); var o = e.target.closest("[data-client]"); if (o) openClient(o.dataset.client); });

  /* ---------- Tableau de bord ---------- */
  function load() {
    return call("overview").then(function (d) { DATA = d; renderBoard(); fillDates(); badge("messages", d.kpi.messagesNonLus); badge("demandes", d.kpi.demandesOuvertes); })
      .catch(function (e) { $("kpis").innerHTML = '<p class="err">' + esc(e.message) + "</p>"; });
  }
  function badge(k, n) { var b = document.querySelector('[data-badge="' + k + '"]'); if (b) { b.hidden = !n; b.textContent = n; } }
  function renderBoard() {
    var k = DATA.kpi;
    $("kpis").innerHTML = [["Clients actifs", k.actifs, ""], ["Chiffre par semaine", euro(k.hebdo), "hors pauses"], ["En pause", k.enPause, "absences"], ["Impayés", k.impayes, k.impayes ? "à relancer" : "aucun"], ["Nouveaux, 7 jours", k.nouveaux7j, ""]]
      .map(function (x, i) { return '<div class="kpi' + (i === 3 && x[1] ? " kpi--bad" : "") + '"><span>' + x[0] + "</span><b>" + x[1] + "</b><small>" + x[2] + "</small></div>"; }).join("");
    $("next-runs").innerHTML = DATA.prochaines.sort(function (a, b) { return a.date.localeCompare(b.date); }).map(function (r) {
      return '<button type="button" class="run" data-run="' + r.date + '"><span class="run__d">' + esc(dlong(r.date)) + "</span><b>" + r.arrets + " arrêts</b><small>" + r.barquettes + " barquettes</small></button>"; }).join("");
    $$("[data-run]").forEach(function (b) { b.addEventListener("click", function () { $("t-date").value = b.dataset.run; tab("tournee"); }); });
    var todo = [];
    if (k.messagesNonLus) todo.push(["messages", k.messagesNonLus + " message(s) client non lu(s)"]);
    if (k.demandesOuvertes) todo.push(["demandes", k.demandesOuvertes + " demande(s) de rappel à traiter"]);
    if (k.impayes) todo.push(["clients", k.impayes + " impayé(s) à relancer", "past_due"]);
    $("todo").innerHTML = todo.length ? todo.map(function (t) { return '<li><button type="button" class="linkbtn" data-goto="' + t[0] + '"' + (t[2] ? ' data-filter="' + t[2] + '"' : "") + ">" + esc(t[1]) + "</button></li>"; }).join("") : "<li>Rien en attente. Belle journée !</li>";
    $$("[data-filter]").forEach(function (b) { b.addEventListener("click", function () { $("c-f").value = b.dataset.filter; renderClients(); }); });
    var last = DATA.clients.slice().sort(function (a, b) { return b.cree.localeCompare(a.cree); }).slice(0, 6);
    $("last-clients").innerHTML = '<ul class="mini">' + last.map(function (c) { return '<li><button type="button" class="linkbtn" data-client="' + c.cid + '">' + esc(c.nom) + "</button><span>" + esc(c.commune) + " · " + repasOf(c) + " repas · " + dshort(c.cree) + "</span>" + pill(c) + "</li>"; }).join("") + "</ul>";
  }
  function pill(c) { var s = c.pauseJusquau && c.statut !== "canceled" ? ["Pause jusqu'au " + dshort(c.pauseJusquau), "warn"] : ST[c.statut] || [c.statut, "off"]; return '<span class="pill pill--' + s[1] + '">' + esc(s[0]) + "</span>"; }

  /* ---------- Tournées ---------- */
  function fillDates() {
    var sel = $("t-date"), now = new Date(), opts = [], days = {};
    (C.zones || []).forEach(function (z) { days[z.jour] = 1; });
    for (var i = -7; i < 21; i++) { var d = new Date(now); d.setDate(d.getDate() + i); if (days[d.getDay()]) opts.push(iso(d)); }
    var cur = sel.value || opts.filter(function (o) { return o >= iso(now); })[0];
    sel.innerHTML = opts.map(function (o) { return '<option value="' + o + '">' + esc(dlong(o)) + (o === iso(now) ? " (aujourd'hui)" : "") + "</option>"; }).join("");
    sel.value = cur;
    var wk = $("p-week"), mondays = [];
    for (var w = -1; w < 4; w++) { var m = new Date(now); m.setDate(m.getDate() - ((m.getDay() + 6) % 7) + 7 * w); mondays.push(iso(m)); }
    var curW = wk.value || mondays[1];
    wk.innerHTML = mondays.map(function (m, i) { return '<option value="' + m + '">Semaine du ' + esc(dshort(m)) + (i === 1 ? " (cette semaine)" : i === 2 ? " (la suivante)" : "") + "</option>"; }).join("");
    wk.value = curW;
  }
  $("t-date").addEventListener("change", loadRun);
  var RUN = null;
  function loadRun() {
    $("stops").innerHTML = '<li class="muted">Chargement…</li>';
    call("tournee", { date: $("t-date").value }).then(function (r) { RUN = r; renderRun(); });
  }
  function renderRun() {
    var a = RUN.arrets, tot = a.reduce(function (t, c) { return t + c.barquettes; }, 0), done = a.filter(function (c) { return c.etat && c.etat.statut === "livre"; }).length;
    $("run-sum").innerHTML = "<b>" + a.length + " arrêts</b> · " + tot + " barquettes · " + done + " livré(s)" + (a.length ? "" : " · aucune livraison prévue ce jour");
    $("stops").innerHTML = a.map(function (c, i) {
      var st = c.etat ? c.etat.statut : "";
      return '<li class="stop' + (st ? " stop--" + st : "") + '"><span class="stop__n">' + (i + 1) + '</span><div class="stop__main"><p class="stop__who"><button type="button" class="linkbtn" data-client="' + c.cid + '">' + esc(c.nom) + "</button>" + (c.essai ? ' <span class="pill pill--info">Essai</span>' : "") + "</p>" +
        '<p class="stop__adr"><a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.adresse) + '" target="_blank" rel="noopener">' + esc(c.adresse) + '</a></p><p class="stop__tel"><a href="tel:' + esc(c.tel) + '">' + esc(c.tel) + "</a>" + (c.payeur ? " · Proche : " + esc(c.payeur) : "") + "</p>" +
        (c.consignes ? '<p class="stop__note">' + esc(c.consignes) + "</p>" : "") + '<p class="stop__meals"><b>' + c.barquettes + " barquettes</b> · " + esc(SVC[c.service]) + ", " + esc(daysLab(c.jours)) + (c.personnes === 2 ? ", 2 pers." : "") + "</p></div>" +
        '<div class="stop__act"><button type="button" data-st="livre" data-cid="' + c.cid + '" aria-pressed="' + (st === "livre") + '">Livré</button><button type="button" data-st="absent" data-cid="' + c.cid + '" aria-pressed="' + (st === "absent") + '">Absent</button><button type="button" data-st="probleme" data-cid="' + c.cid + '" aria-pressed="' + (st === "probleme") + '">Problème</button></div></li>';
    }).join("");
    var addr = a.map(function (c) { return c.adresse; });
    $("t-maps").href = addr.length ? "https://www.google.com/maps/dir/" + addr.slice(0, 10).map(encodeURIComponent).join("/") : "#";
    $$("[data-st]").forEach(function (b) { b.addEventListener("click", function () {
      var c = RUN.arrets.filter(function (x) { return x.cid === b.dataset.cid; })[0];
      var note = b.dataset.st === "probleme" ? (prompt("Quel problème ?") || "") : "";
      call("livraison", { date: RUN.date, cid: c.cid, statut: b.dataset.st, note: note }).then(function () { c.etat = { statut: b.dataset.st, note: note }; renderRun(); });
    }); });
  }
  $("t-print").addEventListener("click", function () { document.body.classList.add("print-run"); window.print(); setTimeout(function () { document.body.classList.remove("print-run"); }, 500); });
  $("t-csv").addEventListener("click", function () {
    if (!RUN) return;
    csv("tournee-" + RUN.date + ".csv", [["Ordre", "Nom", "Adresse", "Code postal", "Commune", "Téléphone", "Consignes", "Barquettes", "Repas", "Jours", "Personnes", "Proche"]].concat(RUN.arrets.map(function (c, i) { return [i + 1, c.nom, c.adresse, c.cp, c.commune, c.tel, c.consignes, c.barquettes, SVC[c.service], daysLab(c.jours), c.personnes, c.payeur]; })));
  });
  function csv(name, rows) {
    var s = "﻿" + rows.map(function (r) { return r.map(function (v) { v = String(v == null ? "" : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(";"); }).join("\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([s], { type: "text/csv;charset=utf-8" })); a.download = name; a.click();
  }

  /* ---------- Production ---------- */
  function renderProd() {
    if (!DATA) return;
    var mon = new Date($("p-week").value + "T12:00:00"), byRun = {}, grid = {}, total = 0;
    (C.zones || []).forEach(function (z) { var d = new Date(mon); d.setDate(d.getDate() + ((z.jour + 6) % 7)); byRun[iso(d)] = byRun[iso(d)] || { jour: z.jour, n: 0, arrets: 0 }; });
    Object.keys(byRun).forEach(function (date) {
      var wd = new Date(date + "T12:00:00").getDay();
      DATA.clients.forEach(function (c) {
        if (jourOf(c.zone) % 7 !== wd) return;
        if (c.essai ? c.debut !== date : (["active", "trialing", "past_due", "fin_programmee"].indexOf(c.statut) < 0 || (c.debut && c.debut > date) || (c.pauseJusquau && c.pauseJusquau > date))) return;
        byRun[date].arrets++;
        c.jours.split("").forEach(function (d) {
          ["midi", "soir"].forEach(function (s) { if (c.service === s || c.service === "midi-soir") { var k = d + s; grid[k] = (grid[k] || 0) + c.personnes; byRun[date].n += c.personnes; total += c.personnes; } });
        });
      });
    });
    var menu = (window.RP_MENU || {}).jours || [];
    var rows = [1, 2, 3, 4, 5, 6, 7].map(function (d) {
      var m = menu[d - 1] || {};
      return "<tr><th>" + JL[d] + "</th>" + ["midi", "soir"].map(function (s) { return '<td><b class="qty">' + (grid[d + s] || 0) + "</b><small>" + esc((m[s] || {}).plat || "") + "<br>" + esc((m[s] || {}).dessert || "") + "</small></td>"; }).join("") + "<td><b>" + ((grid[d + "midi"] || 0) + (grid[d + "soir"] || 0)) + "</b></td></tr>";
    }).join("");
    $("prod").innerHTML = '<div class="kpis kpis--3">' + Object.keys(byRun).sort().map(function (d) { return '<div class="kpi"><span>Tournée du ' + esc(dlong(d)) + "</span><b>" + byRun[d].n + "</b><small>barquettes, " + byRun[d].arrets + " arrêts</small></div>"; }).join("") + '<div class="kpi"><span>Total de la semaine</span><b>' + total + "</b><small>barquettes (plat et dessert)</small></div></div>" +
      '<div class="tbl-wrap"><table class="adm-tbl prod-tbl"><thead><tr><th>Jour</th><th>Midi</th><th>Soir</th><th>Total</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
  }
  $("p-week").addEventListener("change", renderProd);
  $("p-print").addEventListener("click", function () { document.body.classList.add("print-prod"); window.print(); setTimeout(function () { document.body.classList.remove("print-prod"); }, 500); });

  /* ---------- Clients ---------- */
  function filtered() {
    var q = $("c-q").value.trim().toLowerCase(), f = $("c-f").value;
    return DATA.clients.filter(function (c) {
      if (q && (c.nom + " " + c.commune + " " + c.tel + " " + c.email + " " + c.cp).toLowerCase().indexOf(q) < 0) return false;
      if (f === "actif") return ["active", "trialing"].indexOf(c.statut) > -1 && !c.pauseJusquau;
      if (f === "pause") return !!c.pauseJusquau;
      if (f === "past_due") return c.statut === "past_due";
      if (f === "essai") return c.essai;
      if (f === "fin") return c.statut === "canceled" || c.statut === "fin_programmee";
      return true;
    }).sort(function (a, b) { return a.nom.localeCompare(b.nom, "fr"); });
  }
  function renderClients() {
    if (!DATA) return;
    $("c-tbl").querySelector("tbody").innerHTML = filtered().map(function (c) {
      return '<tr data-client="' + c.cid + '" tabindex="0"><td><b>' + esc(c.nom) + "</b><small>" + esc(c.tel) + "</small></td><td>" + esc(c.commune) + "<small>" + esc(c.cp) + "</small></td><td>" + esc(SVC[c.service]) + "<small>" + esc(daysLab(c.jours)) + (c.personnes === 2 ? ", 2 pers." : "") + "</small></td><td>" + euro(c.hebdo) + "</td><td>" + pill(c) + "</td></tr>";
    }).join("") || '<tr><td colspan="5" class="muted">Aucun client.</td></tr>';
  }
  $("c-q").addEventListener("input", renderClients); $("c-f").addEventListener("change", renderClients);
  $("c-csv").addEventListener("click", function () { csv("clients.csv", [["Nom", "E-mail", "Téléphone", "Adresse", "Code postal", "Commune", "Repas", "Jours", "Personnes", "Par semaine", "Statut", "Depuis"]].concat(filtered().map(function (c) { return [c.nom, c.email, c.tel, c.adresse, c.cp, c.commune, SVC[c.service], daysLab(c.jours), c.personnes, String(c.hebdo).replace(".", ","), (ST[c.statut] || [c.statut])[0], c.cree]; }))); });
  document.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.matches("tr[data-client]")) openClient(e.target.dataset.client); if (e.key === "Escape") closeDrawer(); });

  /* ---------- Fiche client (tiroir) ---------- */
  var CUR = null;
  function openClient(cid) {
    $("drawer").hidden = false; $("dr-body").innerHTML = '<p class="muted">Chargement…</p>';
    call("client", { cid: cid }).then(function (d) { CUR = d; renderClient(); });
  }
  function closeDrawer() { $("drawer").hidden = true; if (/client=/.test(location.hash)) history.replaceState(null, "", location.pathname); }
  $("drawer").addEventListener("click", function (e) { if (e.target.id === "drawer" || e.target.closest("[data-dclose]")) closeDrawer(); });
  function renderClient() {
    var d = CUR, cl = d.client, s = d.abonnements.filter(function (a) { return a.statut !== "canceled"; })[0] || d.abonnements[0];
    var h = '<p class="eyebrow">Fiche client</p><h2 id="dr-t">' + esc((s && s.nom) || cl.nom) + "</h2>" +
      '<p class="dr-contact"><a href="tel:' + esc((s && s.tel) || cl.tel) + '">' + esc((s && s.tel) || cl.tel || "") + "</a> · <a href=\"mailto:" + esc(cl.email) + '">' + esc(cl.email) + "</a>" + (cl.avoir ? " · Avoir " + euro(cl.avoir) : "") + "</p>";
    if (s) {
      h += '<div class="dr-card"><div class="dr-row"><span>Statut</span>' + pill(s) + '</div><div class="dr-row"><span>Repas</span><b>' + esc(SVC[s.service]) + ", " + esc(daysLab(s.jours)) + (s.personnes === 2 ? ", 2 personnes" : "") + '</b></div><div class="dr-row"><span>Par semaine</span><b>' + euro(s.hebdo) + '</b></div><div class="dr-row"><span>Adresse</span><b>' + esc(s.adresse) + "</b></div>" +
        (s.consignes ? '<div class="dr-row"><span>Consignes</span><b>' + esc(s.consignes) + "</b></div>" : "") + (s.payeur ? '<div class="dr-row"><span>Payé par</span><b>' + esc(s.payeur) + "</b></div>" : "") + '<div class="dr-row"><span>Client depuis</span><b>' + dshort(s.debut) + "</b></div></div>";
      if (s.sub) h += '<div class="dr-acts">' + (s.pauseJusquau ? '<button type="button" class="btn btn--ghost" data-do="reprendre">Annuler la pause</button>' : '<button type="button" class="btn btn--ghost" data-do="pause">Mettre en pause</button>') +
        '<button type="button" class="btn btn--ghost" data-do="change">Changer les repas</button><button type="button" class="btn btn--ghost" data-do="adresse">Adresse et consignes</button>' +
        (s.statut === "fin_programmee" ? '<button type="button" class="btn btn--ghost" data-do="reactiver">Réactiver</button>' : s.statut !== "canceled" ? '<button type="button" class="btn btn--quiet" data-do="arreter">Arrêter en fin de semaine</button>' : "") +
        (s.statut !== "canceled" ? '<button type="button" class="btn btn--quiet" data-do="annuler">Annuler maintenant</button>' : "") + "</div><div id=\"dr-form\"></div>";
    }
    h += '<h3>Messages</h3><div class="chat">' + (d.messages.length ? d.messages.map(function (m) { return '<p class="bubble bubble--' + m.de + '"><span>' + esc(m.texte).replace(/\n/g, "<br>") + "</span><small>" + (m.de === "equipe" ? "Équipe" : "Client") + " · " + new Date(m.date).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + "</small></p>"; }).join("") : '<p class="muted">Aucun message.</p>') + "</div>" +
      '<form class="reply" id="dr-reply"><textarea id="dr-txt" rows="3" placeholder="Écrire au client (il reçoit aussi un e-mail)"></textarea><button class="btn btn--main" type="submit">Envoyer</button></form>' +
      '<h3>Note interne</h3><textarea id="dr-note" rows="3" placeholder="Visible par l\'équipe seulement : habitudes, accès au logement, contact du voisin. Pas d\'information médicale.">' + esc(d.note) + '</textarea><p class="hint" id="dr-note-s"></p>' +
      "<h3>Paiements</h3>" + ((d.paiements || []).length ? '<ul class="mini pays">' + d.paiements.map(function (p, i) { var reste = Math.round((p.montant - p.rembourse) * 100) / 100; return '<li><span>' + dshort(p.date) + "</span><b>" + euro(p.montant) + "</b>" + (p.rembourse ? '<span class="pill pill--' + (reste > 0 ? "warn" : "off") + '">' + (reste > 0 ? "Remboursé " + euro(p.rembourse) : "Remboursé") + "</span>" : p.statut === "processing" ? '<span class="pill pill--info">En cours</span>' : '<span class="pill pill--ok">Payé</span>') + (reste > 0 && p.statut === "succeeded" ? '<button type="button" class="linkbtn" data-refund="' + i + '">Rembourser</button>' : "") + "</li>"; }).join("") + '</ul><div id="dr-refund"></div>' : '<p class="muted">Aucun paiement.</p>') +
      "<h3>Factures</h3>" + (d.factures.length ? '<ul class="mini">' + d.factures.map(function (f) { return "<li><span>" + dshort(f.date) + "</span><b>" + euro(f.montant) + "</b>" + '<span class="pill pill--' + (f.statut === "paid" ? "ok" : f.statut === "open" ? "bad" : "off") + '">' + ({ paid: "Payée", open: "À payer", void: "Annulée", uncollectible: "Irrécouvrable" }[f.statut] || f.statut) + "</span>" + (f.lien ? '<a href="' + esc(f.lien) + '" target="_blank" rel="noopener">Voir</a>' : "") + "</li>"; }).join("") + "</ul>" : '<p class="muted">Aucune facture.</p>');
    h += '<h3>Données personnelles</h3><p class="hint">Sur demande du client (droit à l\'effacement) : messages, notes et coordonnées supprimés, factures conservées comme la loi l\'impose. Abonnement à arrêter d\'abord.</p><p><button type="button" class="btn btn--quiet" id="dr-rgpd">Effacer les données de ce client</button></p><p id="dr-rgpd-s" class="hint"></p>';
    $("dr-body").innerHTML = h;
    (function () { var bt = $("dr-rgpd"), armed = false; bt.addEventListener("click", function () {
      if (!armed) { armed = true; bt.textContent = "Confirmer l'effacement définitif"; bt.classList.add("btn--danger"); $("dr-rgpd-s").textContent = "Cette action est irréversible."; return; }
      bt.disabled = true; call("effacer", { cid: cl.cid }).then(function () { $("dr-rgpd-s").textContent = "Données effacées."; load(); }).catch(function (e) { bt.disabled = false; $("dr-rgpd-s").textContent = e.message; });
    }); })();
    $$("[data-do]").forEach(function (b) { b.addEventListener("click", function () { act(s, b.dataset.do); }); });
    $$("[data-refund]").forEach(function (b) { b.addEventListener("click", function () { refundForm(d.paiements[+b.dataset.refund], cl); }); });
    $("dr-reply").addEventListener("submit", function (e) { e.preventDefault(); var t = $("dr-txt").value.trim(); if (!t) return; call("repondre", { cid: cl.cid, texte: t }).then(function (r) { CUR.messages = r.messages; renderClient(); }); });
    var nt; $("dr-note").addEventListener("input", function () { clearTimeout(nt); $("dr-note-s").textContent = "…"; nt = setTimeout(function () { call("note", { cid: cl.cid, texte: $("dr-note").value }).then(function () { $("dr-note-s").textContent = "Enregistré"; }); }, 700); });
  }
  // Remboursement total ou partiel, avec confirmation en deux temps
  function refundForm(p, cl) {
    var box = $("dr-refund"), reste = Math.round((p.montant - p.rembourse) * 100) / 100;
    box.innerHTML = '<form class="dr-f" id="rf"><p><b>Rembourser le paiement du ' + dshort(p.date) + "</b> (" + euro(reste) + ' remboursables)</p>' +
      '<label>Montant à rembourser (€)<input name="m" inputmode="decimal" value="' + reste.toFixed(2).replace(".", ",") + '"></label>' +
      '<label>Motif<select name="o"><option>Repas manquant ou abîmé</option><option>Annulation de la commande</option><option>Livraison impossible de notre fait</option><option>Geste commercial</option><option>Erreur de facturation</option><option value="">Autre</option></select></label>' +
      '<label class="check"><input type="checkbox" name="pv" checked><span>Prévenir le client par e-mail</span></label>' +
      '<button class="btn btn--main" type="submit">Vérifier</button> <button class="btn btn--ghost" type="button" data-x>Fermer</button><p class="err" id="rf-e"></p></form>';
    var f = $("rf"), armed = false;
    f.querySelector("[data-x]").addEventListener("click", function () { box.innerHTML = ""; });
    f.addEventListener("input", function () { armed = false; f.querySelector("[type=submit]").textContent = "Vérifier"; f.querySelector("[type=submit]").classList.remove("btn--danger"); });
    f.addEventListener("submit", function (e) {
      e.preventDefault(); var m = parseFloat(String(f.m.value).replace(",", ".")), bt = f.querySelector("[type=submit]");
      if (!(m > 0) || m > reste + 1e-9) { $("rf-e").textContent = "Montant entre 0,01 € et " + euro(reste) + "."; return; }
      if (!armed) { armed = true; bt.textContent = "Confirmer : rembourser " + euro(m) + " à " + (cl.nom || cl.email); bt.classList.add("btn--danger"); $("rf-e").textContent = "Irréversible : l'argent repart sur la carte ou le compte du client."; return; }
      bt.disabled = true; $("rf-e").textContent = "Remboursement en cours…";
      call("rembourser", { pi: p.id, montant: m, motif: f.o.value, prevenir: f.pv.checked }).then(function (r) { box.innerHTML = '<p class="note-ok"><b>' + euro(r.rembourse) + " remboursés.</b> Retour sur le compte du client sous 5 à 10 jours.</p>"; setTimeout(function () { openClient(cl.cid); }, 1800); })
        .catch(function (er) { bt.disabled = false; $("rf-e").textContent = er.message; });
    });
  }
  function act(s, kind) {
    var f = $("dr-form"), send = function (data, msg) { return call("modifier", Object.assign({ sub: s.sub }, data)).then(function () { f.innerHTML = '<p class="note-ok"><b>' + msg + "</b></p>"; load(); openClient(CUR.client.cid); }).catch(function (e) { f.innerHTML = '<p class="err">' + esc(e.message) + "</p>"; }); };
    if (kind === "reprendre" || kind === "reactiver") return send({ type: kind }, "C'est fait.");
    if (kind === "annuler") { if (confirm("Annuler l'abonnement tout de suite ? Plus aucune livraison ni prélèvement. Le client reçoit un e-mail de confirmation. Pour rembourser la semaine en cours, utilisez ensuite « Rembourser » dans Paiements.")) send({ type: "annuler" }, "Abonnement annulé. Pensez au remboursement si besoin, dans Paiements."); return; }
    if (kind === "arreter") { if (confirm("Arrêter l'abonnement à la fin de la période payée ?")) send({ type: "arreter" }, "L'abonnement s'arrêtera à la fin de la période payée."); return; }
    if (kind === "pause") { f.innerHTML = '<form class="dr-f"><label>Combien de semaines ?<select name="n">' + [1, 2, 3, 4, 6, 8].map(function (n) { return "<option>" + n + "</option>"; }).join("") + '</select></label><button class="btn btn--main">Valider la pause</button></form>'; f.querySelector("form").addEventListener("submit", function (e) { e.preventDefault(); send({ type: "pause", semaines: e.target.n.value }, "Pause enregistrée, ni livraison ni prélèvement."); }); return; }
    if (kind === "adresse") { f.innerHTML = '<form class="dr-f"><label>Adresse<input name="a" value="' + esc(s.adresse) + '"></label><label>Téléphone<input name="t" value="' + esc(s.tel) + '"></label><label>Consignes<textarea name="c">' + esc(s.consignes) + '</textarea></label><button class="btn btn--main">Enregistrer</button></form>'; f.querySelector("form").addEventListener("submit", function (e) { e.preventDefault(); send({ type: "adresse", adresse: e.target.a.value, tel: e.target.t.value, consignes: e.target.c.value }, "Adresse mise à jour."); }); return; }
    if (kind === "change") {
      f.innerHTML = '<form class="dr-f"><label>Service<select name="s"><option value="midi">Midi</option><option value="soir">Soir</option><option value="midi-soir">Midi et soir</option></select></label><fieldset class="daypick">' + [1, 2, 3, 4, 5, 6, 7].map(function (d) { return '<label><input type="checkbox" name="j" value="' + d + '"' + (s.jours.indexOf(String(d)) > -1 ? " checked" : "") + "><span>" + JN[d] + "</span></label>"; }).join("") + '</fieldset><label>Personnes<select name="p"><option>1</option><option>2</option></select></label><button class="btn btn--main">Enregistrer</button></form>';
      var fm = f.querySelector("form"); fm.s.value = s.service; fm.p.value = String(s.personnes);
      fm.addEventListener("submit", function (e) { e.preventDefault(); var j = $$('[name="j"]:checked', fm).map(function (i) { return i.value; }).join(""); send({ type: "change", service: fm.s.value, jours: j, personnes: fm.p.value }, "Repas modifiés à partir de la prochaine livraison."); });
    }
  }

  /* ---------- Messages ---------- */
  function loadThreads() {
    call("messages").then(function (r) {
      $("threads").innerHTML = r.fils.length ? r.fils.map(function (t) { return '<li><button type="button" class="thread' + (t.nonLu ? " thread--new" : "") + '" data-client="' + t.cid + '"><b>' + esc(t.nom) + "</b><span>" + esc(t.apercu.slice(0, 140)) + "</span><small>" + new Date(t.dernier).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + (t.nonLu ? " · " + t.nonLu + " non lu(s)" : "") + "</small></button></li>"; }).join("") : '<li class="muted">Aucun message pour l\'instant.</li>';
    });
  }

  /* ---------- Demandes ---------- */
  var TYP = { rappel: "Rappel demandé", orientation: "Orientée par un pro", flyers: "Flyers" };
  function loadReqs() {
    call("demandes").then(function (r) {
      var f = $("d-f").value, list = r.demandes.filter(function (d) { return !f || d.statut !== "traite"; });
      $("reqs").innerHTML = list.length ? list.map(function (d) {
        var ch = d.champs || {};
        return '<li class="req req--' + d.statut + '"><div><p class="req__t"><span class="pill pill--' + (d.statut === "traite" ? "ok" : d.statut === "en_cours" ? "warn" : "info") + '">' + esc(TYP[d.type] || d.type) + "</span> " + esc(new Date(d.date).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) + "</p>" +
          '<dl class="req__f">' + Object.keys(ch).map(function (k) { return "<dt>" + esc(k) + "</dt><dd>" + (k === "Téléphone" ? '<a href="tel:' + esc(ch[k]) + '">' + esc(ch[k]) + "</a>" : esc(ch[k])) + "</dd>"; }).join("") + "</dl></div>" +
          '<div class="req__act"><button type="button" class="btn btn--ghost" data-req="' + d.id + '" data-s="en_cours">En cours</button><button type="button" class="btn btn--main" data-req="' + d.id + '" data-s="traite">Traité</button><a class="btn btn--ghost" href="equipe.html#tel=' + encodeURIComponent(ch["Téléphone"] || "") + '">Prendre la commande</a></div></li>';
      }).join("") : '<li class="muted">Rien à traiter.</li>';
      $$("[data-req]").forEach(function (b) { b.addEventListener("click", function () { call("demande", { id: b.dataset.req, statut: b.dataset.s }).then(function () { loadReqs(); load(); }); }); });
    });
  }
  $("d-f").addEventListener("change", loadReqs);

  /* ---------- Cartes cadeaux ---------- */
  function loadGifts() {
    call("cadeaux").then(function (r) {
      $("g-tbl").querySelector("tbody").innerHTML = r.cartes.length ? r.cartes.map(function (g) { return "<tr><td><b>" + esc(g.code) + "</b></td><td>" + euro(g.montant) + "<small>" + g.repas + " repas</small></td><td>" + esc(g.de) + "<small>pour " + esc(g.pour) + "</small></td><td>" + dshort(g.achat) + "</td><td>" + dshort(g.expire) + "</td><td>" + (g.utilisee ? '<span class="pill pill--off">Utilisée</span>' : '<span class="pill pill--ok">Disponible</span>') + "</td></tr>"; }).join("") : '<tr><td colspan="6" class="muted">Aucune carte vendue.</td></tr>';
    });
  }

  /* ---------- Démonstration ---------- */
  var DEMO_STATE = null;
  function DEMO(action, d) {
    if (!DEMO_STATE) {
      var next = function (j) { var x = new Date(); x.setDate(x.getDate() + 1); while (x.getDay() !== j) x.setDate(x.getDate() + 1); return iso(x); };
      var mk = function (i, nom, adr, zone, service, jours, pers, statut, extra) { var p = /(\d{5})\s+(.+)$/.exec(adr); var c = { sub: "sub_" + i, cid: "cus_" + i, nom: nom, email: nom.split(" ")[0].toLowerCase() + "@exemple.fr", tel: "06 " + (10 + i) + " 22 33 44", adresse: adr, cp: p[1], commune: p[2], consignes: "", payeur: "", pour: "moi", zone: zone, service: service, jours: jours, personnes: pers, statut: statut, pauseJusquau: null, debut: "2026-10-06", cree: iso(new Date(Date.now() - i * 2.3 * 864e5)), canal: "site", essai: false }; Object.assign(c, extra || {}); c.hebdo = RP.total(repasOf(c)); return c; };
      var cl = [
        mk(1, "Jeanne Martin", "12 rue Nationale, 72000 Le Mans", "le-mans", "soir", "12345", 1, "active", { consignes: "Sonner deux fois, elle entend mal", payeur: "Claire Martin, 06 98 76 54 32", pour: "proche" }),
        mk(2, "Robert Lemoine", "4 allée des Tilleuls, 72190 Coulaines", "le-mans", "midi-soir", "1234567", 2, "active"),
        mk(3, "Odette Garnier", "8 place de l'Église, 72540 Loué", "loue", "soir", "1357", 1, "active"),
        mk(4, "Marcel Duval", "22 route de Sablé, 72350 Brûlon", "loue", "midi", "12345", 1, "active", { pauseJusquau: next(4) > iso(new Date()) ? iso(new Date(Date.now() + 10 * 864e5)) : null }),
        mk(5, "Simone Leroy", "3 rue du Pont, 53000 Laval", "mayenne-orne", "soir", "1234567", 1, "past_due"),
        mk(6, "Paul Besnard", "17 rue Gambetta, 53600 Évron", "mayenne-orne", "midi-soir", "12345", 1, "active", { canal: "telephone" }),
        mk(7, "Lucienne Hamon", "9 avenue de Courteille, 61000 Alençon", "mayenne-orne", "soir", "135", 1, "essai", { essai: true, sub: null, debut: next(4) }),
        mk(8, "Henri Fouquet", "2 rue de la Gare, 72650 La Milesse", "le-mans", "soir", "12345", 1, "fin_programmee"),
        mk(9, "Germaine Rousseau", "11 rue Saint-Nicolas, 72300 Sablé-sur-Sarthe", "loue", "soir", "123456", 1, "active", { consignes: "Clé chez la voisine du 13" }),
        mk(10, "André Pichon", "6 rue des Écoles, 72230 Arnage", "le-mans", "midi", "1234567", 1, "active")
      ];
      DEMO_STATE = { clients: cl, threads: [{ cid: "cus_1", nom: "Claire Martin", nonLu: 1, dernier: new Date(Date.now() - 3600e3).toISOString(), messages: [{ de: "client", texte: "Bonjour, maman sera hospitalisée la semaine prochaine, pouvez-vous suspendre ? Merci !", date: new Date(Date.now() - 3600e3).toISOString() }] },
        { cid: "cus_3", nom: "Odette Garnier", nonLu: 0, dernier: new Date(Date.now() - 2 * 864e5).toISOString(), messages: [{ de: "client", texte: "La blanquette était délicieuse !", date: new Date(Date.now() - 2.1 * 864e5).toISOString() }, { de: "equipe", texte: "Merci beaucoup Madame Garnier, nous transmettons au chef !", date: new Date(Date.now() - 2 * 864e5).toISOString() }] }],
        reqs: [{ id: "r1", type: "rappel", statut: "nouveau", date: new Date(Date.now() - 5400e3).toISOString(), champs: { Nom: "Yvette Morel", "Téléphone": "0243112233", Pour: "pour elle ou lui-même", "Créneau souhaité": "le matin", Page: "index.html" } },
          { id: "r2", type: "orientation", statut: "nouveau", date: new Date(Date.now() - 864e5).toISOString(), champs: { Nom: "M. Bellanger", "Téléphone": "0243445566", Commune: "Allonnes", Structure: "CCAS d'Allonnes", "Contact du professionnel": "Mme Roux, 02 43 00 00 00", Message: "Sort de l'hôpital vendredi, vit seul" } },
          { id: "r3", type: "flyers", statut: "traite", date: new Date(Date.now() - 4 * 864e5).toISOString(), champs: { Structure: "Pharmacie du Centre", "Adresse d'envoi": "5 place de la République, 72540 Loué", Quantité: "50" } }],
        etats: {}, notes: { cus_1: "Diabète léger, ne prend pas de dessert sucré le soir (signalé par sa fille)." } };
    }
    var S = DEMO_STATE, act = ["active", "trialing", "past_due", "fin_programmee"];
    var live = function (c, date) { var wd = new Date(date + "T12:00:00").getDay(); if (jourOf(c.zone) % 7 !== wd) return false; if (c.essai) return c.debut === date; return act.indexOf(c.statut) > -1 && !(c.pauseJusquau && c.pauseJusquau > date); };
    if (action === "overview") {
      var runs = [2, 4].map(function (j) { var x = new Date(); while (x.getDay() !== j) x.setDate(x.getDate() + 1); var dd = iso(x), l = S.clients.filter(function (c) { return live(c, dd); }); return { date: dd, arrets: l.length, barquettes: l.reduce(function (t, c) { return t + repasOf(c); }, 0) }; });
      var actifs = S.clients.filter(function (c) { return !c.essai && act.indexOf(c.statut) > -1; });
      return { clients: S.clients, prochaines: runs, kpi: { actifs: actifs.length, hebdo: Math.round(actifs.filter(function (c) { return !c.pauseJusquau; }).reduce(function (t, c) { return t + c.hebdo; }, 0) * 100) / 100, impayes: S.clients.filter(function (c) { return c.statut === "past_due"; }).length, enPause: actifs.filter(function (c) { return c.pauseJusquau; }).length, nouveaux7j: S.clients.filter(function (c) { return c.cree >= iso(new Date(Date.now() - 7 * 864e5)); }).length, messagesNonLus: S.threads.filter(function (t) { return t.nonLu; }).length, demandesOuvertes: S.reqs.filter(function (r) { return r.statut !== "traite"; }).length } };
    }
    if (action === "tournee") { var l = S.clients.filter(function (c) { return live(c, d.date); }).sort(function (a, b) { return (a.zone + a.commune).localeCompare(b.zone + b.commune, "fr"); }); return { date: d.date, arrets: l.map(function (c) { return Object.assign({}, c, { barquettes: repasOf(c), etat: S.etats[d.date + c.cid] || null }); }) }; }
    if (action === "livraison") { S.etats[d.date + d.cid] = { statut: d.statut, note: d.note }; return { ok: true }; }
    if (action === "client") { var c = S.clients.filter(function (x) { return x.cid === d.cid; })[0], t = S.threads.filter(function (x) { return x.cid === d.cid; })[0]; if (t) t.nonLu = 0; return { client: { cid: c.cid, nom: c.nom, email: c.email, tel: c.tel, avoir: 0 }, abonnements: [c], factures: [{ date: iso(new Date(Date.now() - 7 * 864e5)), montant: c.hebdo, statut: c.statut === "past_due" ? "open" : "paid", lien: "" }, { date: iso(new Date(Date.now() - 14 * 864e5)), montant: c.hebdo, statut: "paid", lien: "" }], paiements: [{ id: "pi_demo1", date: iso(new Date(Date.now() - 7 * 864e5)), montant: c.hebdo, rembourse: 0, statut: "succeeded" }, { id: "pi_demo2", date: iso(new Date(Date.now() - 14 * 864e5)), montant: c.hebdo, rembourse: 11.99, statut: "succeeded" }], messages: t ? t.messages : [], note: S.notes[d.cid] || "" }; }
    if (action === "rembourser") return { ok: true, rembourse: +d.montant };
    if (action === "modifier") { var c2 = S.clients.filter(function (x) { return x.sub === d.sub; })[0]; if (d.type === "pause") c2.pauseJusquau = iso(new Date(Date.now() + 7 * d.semaines * 864e5)); if (d.type === "reprendre") c2.pauseJusquau = null; if (d.type === "arreter") c2.statut = "fin_programmee"; if (d.type === "reactiver") c2.statut = "active"; if (d.type === "change") { c2.service = d.service; c2.jours = d.jours; c2.personnes = +d.personnes; c2.hebdo = RP.total(repasOf(c2)); } if (d.type === "adresse") { c2.adresse = d.adresse; c2.tel = d.tel; c2.consignes = d.consignes; } return { ok: true }; }
    if (action === "note") { S.notes[d.cid] = d.texte; return { ok: true }; }
    if (action === "repondre") { var t2 = S.threads.filter(function (x) { return x.cid === d.cid; })[0]; if (!t2) { t2 = { cid: d.cid, nom: "", messages: [] }; S.threads.push(t2); } t2.messages.push({ de: "equipe", texte: d.texte, date: new Date().toISOString() }); t2.dernier = new Date().toISOString(); return { messages: t2.messages }; }
    if (action === "messages") return { fils: S.threads.map(function (t) { return { cid: t.cid, nom: t.nom, nonLu: t.nonLu, dernier: t.dernier, apercu: t.messages[t.messages.length - 1].texte }; }) };
    if (action === "demandes") return { demandes: S.reqs };
    if (action === "demande") { S.reqs.filter(function (r) { return r.id === d.id; })[0].statut = d.statut; return { ok: true }; }
    if (action === "cadeaux") return { cartes: [{ code: "RP-K7QM-4XWA", montant: 141.3, repas: 10, de: "Julien", pour: "Maman", achat: iso(new Date(Date.now() - 3 * 864e5)), expire: iso(new Date(Date.now() + 362 * 864e5)), utilisee: "" }, { code: "RP-8HNZ-P2TC", montant: 70.65, repas: 5, de: "Les petits-enfants", pour: "Papi Jean", achat: iso(new Date(Date.now() - 12 * 864e5)), expire: iso(new Date(Date.now() + 353 * 864e5)), utilisee: "cus_6" }] };
    return {};
  }

  if (token && LIVE) start();
})();
