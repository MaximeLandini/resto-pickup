(function () {
  "use strict";
  var C = window.RP || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  // liens « Commander pour <commune> » des pages communes : la commune est mémorisée au clic
  document.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest("a[data-cp]"); if (a) { store.set("rp-cp", a.dataset.cp); store.set("rp-commune", a.dataset.commune || ""); } });
  var euro = function (n) { return n.toFixed(2).replace(".", ",") + "\u00a0€"; };
  var JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var fmtDate = function (d) { return JOURS[d.getDay()] + " " + (d.getDate() === 1 ? "1er" : d.getDate()) + " " + MOIS[d.getMonth()]; };

  /* Taille du texte */
  function setSize(n) {
    document.documentElement.setAttribute("data-size", n);
    $$(".textsize button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.size === String(n) ? "true" : "false"); });
    store.set("rp-size", n);
  }
  $$(".textsize button").forEach(function (b) { b.addEventListener("click", function () { setSize(b.dataset.size); }); });
  var sz = store.get("rp-size"); setSize(sz === "2" ? "2" : "1");

  /* Zones */
  var zones = C.zones || [];
  function findByCp(cp) {
    var out = [];
    zones.forEach(function (z) { z.communes.forEach(function (c) { if (c[1] === cp) out.push({ commune: c[0], cp: c[1], zone: z }); }); });
    return out;
  }
  function firstDelivery(zone) {
    var d = new Date(); d.setHours(12, 0, 0, 0);
    var min = new Date(d.getTime() + (C.delaiCommandeJours || 3) * 864e5);
    var x = new Date(min);
    while (x.getDay() !== zone.jour) x = new Date(x.getTime() + 864e5);
    return x;
  }
  window.RPfirstDelivery = firstDelivery;

  /* Prochaine livraison dans le héros */
  var tk = $("[data-next-delivery]");
  if (tk && zones[0]) {
    var a = firstDelivery(zones[0]);
    tk.textContent = "Prochaine livraison au Mans : " + fmtDate(a);
  }

  function semainier(jour) {
    var on = (jour + 6) % 7, L = ["L", "M", "M", "J", "V", "S", "D"];
    return '<div class="semainier" style="margin-top:.5rem"><ol aria-hidden="true">' + L.map(function (l, i) { return '<li' + (i === on ? ' class="on"' : "") + ">" + l + "</li>"; }).join("") + "</ol></div>";
  }
  window.RPsemainier = semainier;
  function zoneMessage(hit) {
    var d = firstDelivery(hit.zone);
    return '<div class="note-ok"><p><strong>Oui, nous livrons ' + hit.commune + ".</strong> Livré le " + hit.zone.jourNom +
      ". Si vous commandez aujourd'hui, première livraison le <strong>" + fmtDate(d) + "</strong>.</p>" + semainier(hit.zone.jour) + "</div>" +
      '<div class="row" style="margin-top:.8rem"><a class="btn btn--main" href="' + (document.getElementById("order-form") ? "#commander" : "#composer") + '" data-pick-cp="' + hit.cp + '" data-pick-commune="' + hit.commune + '">Voir mon prix</a></div>';
  }

  function bindZone(form) {
    var input = $("input", form), out = $(".zone__out", form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var cp = (input.value || "").replace(/\D/g, "").slice(0, 5);
      if (cp.length !== 5) { out.innerHTML = '<div class="note-warn"><p>' + (cp.length ? "Ce code postal a " + cp.length + " chiffre" + (cp.length > 1 ? "s" : "") + ". Il en faut 5." : "Indiquez votre code postal, 5 chiffres, par exemple 72000.") + "</p></div>"; input.focus(); return; }
      var hits = findByCp(cp);
      if (!hits.length) {
        out.innerHTML = '<div class="note-warn"><p><strong>Nous ne livrons pas encore le ' + cp + ".</strong> Nous ouvrons de nouvelles communes chaque mois. Appelez le <strong>" + (C.tel || "") +
          "</strong> pour être prévenu en premier, ou laissez votre e-mail :</p></div>" +
          '<div class="zone__row" style="margin-top:.6rem"><input type="email" id="wait-' + Math.random().toString(36).slice(2, 7) + '" placeholder="votre@email.fr" aria-label="Votre adresse e-mail"><button type="button" class="btn btn--ghost" data-wait="' + cp + '">Me prévenir</button></div>';
        return;
      }
      if (hits.length === 1) { out.innerHTML = zoneMessage(hits[0]); remember(hits[0]); return; }
      out.innerHTML = '<p style="font-weight:700">Quelle est votre commune ?</p><div class="chips">' + hits.map(function (h, i) { return '<button type="button" class="chip" data-i="' + i + '">' + h.commune + "</button>"; }).join("") + "</div>";
      $$(".chip", out).forEach(function (b) { b.addEventListener("click", function () { var h = hits[+b.dataset.i]; out.innerHTML = zoneMessage(h); remember(h); }); });
    });
    out.addEventListener("click", function (e) {
      var w = e.target.closest("[data-wait]");
      if (!w) return;
      var em = w.previousElementSibling.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(em)) { w.previousElementSibling.focus(); return; }
      if (C.waitlistEndpoint) { fetch(C.waitlistEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: em, cp: w.dataset.wait }) }).catch(function () {}); }
      w.parentNode.outerHTML = '<div class="note-ok" style="margin-top:.6rem"><p>C\'est noté. Nous vous écrirons dès que nous livrons le ' + w.dataset.wait + ".</p></div>";
    });
  }
  var lastHit = null;
  function remember(h) { lastHit = h; store.set("rp-cp", h.cp); store.set("rp-commune", h.commune); prefill(); }
  $$("form.zone").forEach(bindZone);

  /* Semainier : formule soir ou midi + soir */
  $$("[data-sem-toggle] button").forEach(function (b) {
    b.addEventListener("click", function () {
      $$("[data-sem-toggle] button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      var s = $(".sem"); if (s) s.dataset.show = b.dataset.show;
    });
  });

  $$("[data-dish-toggle] button").forEach(function (b) {
    b.addEventListener("click", function () {
      $$("[data-dish-toggle] button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      var s = $(".dishes"); if (s) s.dataset.show = b.dataset.show;
    });
  });
  /* Cartes formules : 1 ou 2 personnes */
  $$("[data-pers-toggle] button").forEach(function (b) {
    b.addEventListener("click", function () {
      var p = +b.dataset.p;
      $$("[data-pers-toggle] button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      $$(".plan").forEach(function (c) {
        var n = +c.dataset.repas * p;
        $("[data-total]", c).textContent = euro(RP.total(n));
        $("[data-count]", c).textContent = n + " repas" + (p === 2 ? " pour 2" : "");
        var a = $("a.btn", c); a.href = "commander.html#f-" + c.dataset.formule + "-" + p;
      });
    });
  });

  /* Tunnel de commande */
  var form = $("#order-form");
  if (!form) return;
  var step = 1;
  var steps = $$("fieldset[data-step]", form);
  var prog = $$(".progress li");

  function val(name) { var el = form.querySelector('[name="' + name + '"]:checked') || form.querySelector('[name="' + name + '"]'); return el ? el.value : ""; }
  var JN = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  function days() { return $$('[name="jours"]:checked', form).map(function (i) { return +i.value; }); }
  function daysLabel(d) {
    if (d.length === 7) return "tous les jours";
    if (d.join() === "1,2,3,4,5") return "du lundi au vendredi";
    if (d.join() === "1,3,5,7") return "un jour sur deux (lundi, mercredi, vendredi, dimanche)";
    if (d.length >= 5) { var miss = [1, 2, 3, 4, 5, 6, 7].filter(function (x) { return d.indexOf(x) < 0; }); return "tous les jours sauf le " + miss.map(function (x) { return JN[x]; }).join(" et le "); }
    return d.map(function (x) { return JN[x]; }).join(", ").replace(/, ([^,]*)$/, " et $1");
  }
  function state() {
    var svc = val("service") || "soir", p = +val("personnes") || 1, pour = val("pour");
    var d = days(), per = svc === "midi-soir" ? 2 : 1;
    var repas = d.length * per;
    var once = !!form.querySelector('[name="essai"]:checked');
    var cp = (val("cp") || "").replace(/\D/g, "");
    var hits = cp.length === 5 ? findByCp(cp) : [];
    var commune = val("commune");
    var hit = hits.filter(function (h) { return h.commune === commune; })[0] || hits[0] || null;
    return { once: once, service: svc, formule: svc, jours: d, personnes: p, pour: pour, repas: repas, nb: repas * p, total: RP.total(repas * p), liv: RP.fee(repas * p), hit: hit, hits: hits };
  }
  function svcLabel(s) { return s.service === "midi-soir" ? "Midi et soir" : s.service === "midi" ? "Le midi" : "Le soir"; }

  function render() {
    var s = state();
    $("#s-formule").textContent = svcLabel(s) + ", " + daysLabel(s.jours);
    $("#s-per").textContent = s.once ? "Une seule fois" : "Par semaine";
    $("#s-small").textContent = s.once ? "Une livraison, sans abonnement. Vous continuez ensuite si vous aimez." : "Payé chaque semaine. Pause, changement ou arrêt sans frais avant le samedi.";
    $("#s-pers").textContent = s.personnes === 2 ? "2 personnes" : "1 personne";
    $("#s-nb").textContent = s.nb + " repas";
    $("#s-unit").textContent = euro(C.prixRepas || 11.99);
    $("#s-liv").textContent = euro(s.liv) + (s.liv >= C.livraison.max ? " (plafond)" : "");
    var de = $("#days-err"); if (de) de.textContent = s.nb < (C.repasMin || 3) ? "Minimum " + (C.repasMin || 3) + " repas par semaine : ajoutez un jour ou prenez midi et soir." : (de.textContent.indexOf("Minimum") === 0 ? "" : de.textContent);
    $("#s-total").textContent = euro(s.total);
    var lab = svcLabel(s) + ", " + daysLabel(s.jours) + ", " + (s.personnes === 2 ? "2 personnes" : "1 personne") + (s.pour === "proche" ? ", pour un proche" : "");
    var mt = $("#mini-total"); if (mt) mt.innerHTML = "<b>" + euro(s.total) + "</b> " + (s.once ? "en une fois" : "par semaine") + " · " + s.nb + " repas";
    var mr = $("#mini-recap"); if (mr) mr.innerHTML = "<span>" + lab + " · <b>" + euro(s.total) + "</b>" + (s.once ? " en une fois" : " par semaine") + '</span><button type="button" class="linkbtn" data-goto="1">Modifier</button>';
    $("#s-first").textContent = s.hit ? fmtDate(firstDelivery(s.hit.zone)) : "après le code postal";
    $$("[data-proche]").forEach(function (el) { el.hidden = s.pour !== "proche"; });
    $$("[data-moi]").forEach(function (el) { el.hidden = s.pour === "proche"; });
    $$("[data-proche] input").forEach(function (el) { el.required = s.pour === "proche" && el.dataset.req === "1"; });
    $("#who-label").textContent = s.pour === "proche" ? "La personne qui reçoit les repas" : "Vos coordonnées de livraison";
    var pb = $("#pay-btn"); if (pb) pb.textContent = s.once ? "Payer ma semaine d'essai" : "Payer et valider";
  }

  function fillCommunes() {
    var s = state(), sel = $("#f-commune"), msg = $("#cp-msg");
    var cur = sel.value;
    sel.innerHTML = "";
    if (!s.hits.length) {
      sel.disabled = true; sel.innerHTML = "<option value=''>Saisissez d'abord le code postal</option>";
      msg.innerHTML = (val("cp").replace(/\D/g, "").length === 5) ? '<span class="err">Nous ne livrons pas encore ce code postal. Appelez le ' + (C.tel || "") + ".</span>" : "";
    } else {
      sel.disabled = false;
      s.hits.forEach(function (h) { var o = document.createElement("option"); o.value = h.commune; o.textContent = h.commune; sel.appendChild(o); });
      if (cur && s.hits.some(function (h) { return h.commune === cur; })) sel.value = cur;
      var h = state().hit;
      msg.innerHTML = '<span style="color:var(--rp-persil);font-weight:700">Livré le ' + h.zone.jourNom + ", première livraison le " + fmtDate(firstDelivery(h.zone)) + ".</span>" + semainier(h.zone.jour);
    }
    render();
  }

  function prefill() {
    if (!lastHit || !document.getElementById("f-cp")) return;
    var cp = $("#f-cp"); cp.value = lastHit.cp; fillCommunes();
    if (lastHit.commune) $("#f-commune").value = lastHit.commune; render();
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-pick-cp]");
    if (a) { lastHit = { cp: a.dataset.pickCp, commune: a.dataset.pickCommune }; prefill(); }
  });

  function show(n) {
    step = n;
    steps.forEach(function (f) { f.hidden = +f.dataset.step !== n; });
    prog.forEach(function (li, i) { li.classList.toggle("done", i + 1 < n); if (i + 1 === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current"); });
    if (n === 3) buildRecap();
    var lg = $("legend", steps[n - 1]); if (lg) { lg.setAttribute("tabindex", "-1"); lg.focus({ preventScroll: true }); }
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function validate(n) {
    var ok = true, first = null;
    if (n === 1 && state().nb < (C.repasMin || 3)) { $("#days-err").textContent = "Minimum " + (C.repasMin || 3) + " repas par semaine : ajoutez un jour ou prenez midi et soir."; $("#days-err").scrollIntoView({ block: "center" }); return false; }
    $$("input, select, textarea", steps[n - 1]).forEach(function (el) {
      var wrap = el.closest(".field"); if (!wrap) return;
      var e = wrap.querySelector(".err"); if (e) e.remove();
      wrap.classList.remove("has-error");
      if (el.disabled || el.closest("[hidden]")) return;
      var msg = "";
      if (el.required && !el.value.trim()) msg = "Ce champ est nécessaire pour vous livrer.";
      else if (el.type === "tel" && el.value && el.value.replace(/\D/g, "").length < 10) msg = "Le numéro doit comporter 10 chiffres.";
      else if (el.type === "email" && el.value && !/^\S+@\S+\.\S+$/.test(el.value)) msg = "Vérifiez l'adresse e-mail, il manque peut-être le @.";
      if (msg) { ok = false; wrap.classList.add("has-error"); var p = document.createElement("p"); p.className = "err"; p.textContent = msg; wrap.appendChild(p); first = first || el; }
    });
    if (n === 2 && !state().hit) { ok = false; first = first || $("#f-cp"); }
    if (first) first.focus();
    return ok;
  }

  function buildRecap() {
    var s = state(), g = function (n) { return (val(n) || "").trim(); };
    var lines = [
      "<b>" + svcLabel(s) + ", " + daysLabel(s.jours) + ", " + (s.personnes === 2 ? "2 personnes" : "1 personne") + "</b>",
      s.nb + " repas (plat et dessert) " + (s.once ? "livrés en une fois, sans abonnement" : "par semaine, livrés chaque " + (s.hit ? s.hit.zone.jourNom : "")),
      "Total : <b>" + euro(s.total) + (s.once ? "" : " par semaine") + "</b>",
      "Livraison : " + g("prenom") + " " + g("nom") + ", " + g("adresse") + ", " + g("cp") + " " + g("commune"),
      "Première livraison : <b>" + (s.hit ? fmtDate(firstDelivery(s.hit.zone)) : "") + "</b>"
    ];
    if (s.pour === "proche") lines.push("Payé par : " + g("p_prenom") + " " + g("p_nom") + ", " + g("p_email"));
    $("#recap").innerHTML = lines.map(function (l) { return "<span>" + l + "</span>"; }).join("");
  }


  var JMIN = C.joursMin || 3;
  form.addEventListener("click", function (e) {
    var b = e.target.closest("[data-preset]"); if (!b) return;
    var want = b.getAttribute("data-preset");
    $$('[name="jours"]', form).forEach(function (i) { i.checked = want.indexOf(i.value) > -1; });
    $$("[data-preset]", form).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
    $("#days-err").textContent = ""; render();
  });
  form.addEventListener("change", function (e) {
    if (e.target.name === "jours") $$("[data-preset]", form).forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-preset") === days().join("") ? "true" : "false"); });
    if (e.target.name === "jours") {
      var n = days().length, er = $("#days-err");
      if (n < JMIN) { e.target.checked = true; er.textContent = "Choisissez au moins " + JMIN + " jours : une livraison se fait pour plusieurs repas."; }
      else er.textContent = "";
    }
    render();
  });
  $("#f-cp").addEventListener("input", fillCommunes);
  $$("[data-next]", form).forEach(function (b) { b.addEventListener("click", function () { if (validate(step)) show(step + 1); }); });
  $$("[data-prev]", form).forEach(function (b) { b.addEventListener("click", function () { show(step - 1); }); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var cgv = $("#f-cgv"), wrap = cgv.closest(".field");
    var old = wrap.querySelector(".err"); if (old) old.remove();
    if (!cgv.checked) { var p = document.createElement("p"); p.className = "err"; p.textContent = "Cochez la case pour accepter les conditions."; wrap.appendChild(p); cgv.focus(); return; }
    var s = state(), data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });
    data.jours = s.jours.join(""); data.service = s.service; data.essai = s.once ? "1" : "";
    data.zone = s.hit ? s.hit.zone.id : "";
    data.premiereLivraison = s.hit ? firstDelivery(s.hit.zone).toISOString().slice(0, 10) : "";
    var btn = $("#pay-btn");
    if (!C.stripeCheckoutEndpoint) {
      $("#pay-demo").hidden = false; return;
    }
    btn.disabled = true; btn.textContent = "Ouverture du paiement sécurisé…";
    fetch(C.stripeCheckoutEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.url) location.href = j.url; else throw new Error(j.error || "Erreur"); })
      .catch(function (er) {
        btn.disabled = false; render();
        $("#pay-err").textContent = /cadeau/i.test(er && er.message) ? er.message + ". Vérifiez le code, ou appelez le " + (C.tel || "") + "." : "Le paiement n'a pas pu s'ouvrir. Réessayez, ou appelez le " + (C.tel || "") + ", nous prenons la commande par téléphone.";
      });
  });

  /* Retour de Stripe */
  if (location.hash === "#merci") { var t = $(".thanks"); if (t) { t.classList.add("is-on"); t.scrollIntoView(); } }

  /* Préselection depuis l'accueil : #f-<service>-<jours>-<personnes>[-proche][-essai], ex. #f-soir-12345-1 */
  var m = /^#f-(midi|soir|midi-soir)-([1-7]{1,7})-([12])(-proche)?(-essai)?$/.exec(location.hash);
  if (m) {
    form.querySelector('[name="service"][value="' + m[1] + '"]').checked = true;
    $$('[name="jours"]', form).forEach(function (i) { i.checked = m[2].indexOf(i.value) > -1; });
    form.querySelector('[name="personnes"][value="' + m[3] + '"]').checked = true;
    if (m[4]) form.querySelector('[name="pour"][value="proche"]').checked = true;
    if (m[5]) $("#f-essai").checked = true;
  }
  var qcode = new URLSearchParams(location.search).get("code");
  if (qcode && $("#f-code")) { $("#f-code").value = qcode; $("#giftcode").open = true; }
  var qs = new URLSearchParams(location.search);
  if (/^\d{5}$/.test(qs.get("cp") || "")) { store.set("rp-cp", qs.get("cp")); if (qs.get("commune")) store.set("rp-commune", qs.get("commune")); }
  var scp = store.get("rp-cp");
  show1();
  if (m) { steps.forEach(function (f) { f.hidden = +f.dataset.step !== 2; }); step = 2; prog.forEach(function (li, i) { li.classList.toggle("done", i === 0); if (i === 1) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current"); }); }
  form.addEventListener("click", function (e) { var g = e.target.closest("[data-goto]"); if (g) show(+g.dataset.goto); });
  if (scp && !lastHit) { lastHit = { cp: scp, commune: store.get("rp-commune") }; prefill(); }
  function show1() { steps.forEach(function (f) { f.hidden = +f.dataset.step !== 1; }); fillCommunes(); render(); }
})();
