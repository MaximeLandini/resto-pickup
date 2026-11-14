/* Resto Pickup : fenêtre « On vous rappelle » et formulaires de contact (rappel, orientation pro, flyers).
   Envoi vers /api/rappel quand apiBase est configuré ; sinon aperçu (rien n'est envoyé). */
(function () {
  var C = window.RP || {};
  var API = C.apiBase === undefined ? "" : C.apiBase;
  var LIVE = !!C.apiBase || C.apiBase === "/";
  var dlg = document.getElementById("rappel");
  var lastFocus = null;

  function open(pour) {
    if (!dlg) return;
    lastFocus = document.activeElement;
    reset(dlg.querySelector("form"));
    if (pour) { var r = dlg.querySelector('[name="pour"][value="' + pour + '"]'); if (r) r.checked = true; }
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    document.documentElement.classList.add("has-sheet");
    setTimeout(function () { var i = dlg.querySelector("#r-nom"); if (i) i.focus(); }, 60);
  }
  function close() {
    if (!dlg) return;
    if (dlg.close) dlg.close(); else dlg.removeAttribute("open");
  }
  if (dlg) {
    dlg.addEventListener("close", function () { document.documentElement.classList.remove("has-sheet"); if (lastFocus) lastFocus.focus(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.closest("[data-close]")) close(); });
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-rappel]");
    if (t) { e.preventDefault(); open(t.getAttribute("data-rappel")); }
  });
  if (location.hash === "#rappel") open();

  function reset(f) {
    if (!f) return;
    var b = f.querySelector("[data-form-body]"), ok = f.querySelector("[data-ok]");
    if (b) b.hidden = false; if (ok) ok.hidden = true;
    f.querySelectorAll(".err").forEach(function (e) { e.textContent = ""; });
    var btn = f.querySelector('[type="submit"]'); if (btn) { btn.disabled = false; if (btn.dataset.lbl) btn.textContent = btn.dataset.lbl; }
  }
  function digits(s) { return String(s || "").replace(/\D/g, ""); }

  document.querySelectorAll("form[data-contact]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var type = f.getAttribute("data-contact");
      var data = {}; new FormData(f).forEach(function (v, k) { data[k] = v; });
      data.page = location.pathname.split("/").pop() || "index.html";
      var errTel = f.querySelector("[data-err]"), errAcc = f.querySelector("[data-err-accord]"), errGen = f.querySelector("[data-err-gen]");
      [errTel, errAcc, errGen].forEach(function (x) { if (x) x.textContent = ""; });
      var nom = f.querySelector('[name="nom"]');
      if (nom && !nom.value.trim()) { nom.focus(); nom.closest(".field").classList.add("has-error"); return; }
      if (nom) nom.closest(".field").classList.remove("has-error");
      if (type !== "flyers") {
        var d = digits(data.tel);
        if (d.length < 10) { errTel.textContent = d.length ? "Il manque des chiffres : un numéro en a 10, par exemple 06 12 34 56 78." : "Indiquez un numéro de téléphone."; f.querySelector('[name="tel"]').focus(); return; }
      }
      if (type === "orientation" && !data.accord) { errAcc.textContent = "Cochez la case : nous n'appelons personne sans son accord."; return; }
      if (type === "flyers") {
        var miss = ["structure", "adresse", "email"].filter(function (k) { return !String(data[k] || "").trim(); });
        if (miss.length) { errGen.textContent = "Complétez la structure, l'adresse et un moyen de vous joindre."; f.querySelector('[name="' + miss[0] + '"]').focus(); return; }
      }
      var btn = f.querySelector('[type="submit"]');
      btn.dataset.lbl = btn.textContent; btn.disabled = true; btn.textContent = "Envoi…";
      var done = function () {
        f.querySelector("[data-form-body]").hidden = true;
        var ok = f.querySelector("[data-ok]"); ok.hidden = false;
        var msg = ok.querySelector("[data-ok-msg]");
        if (msg) {
          var cr = { matin: "le matin", aprem: "l'après-midi" }[data.creneau];
          var prenom = String(data.nom || "").trim().split(/\s+/)[0];
          msg.textContent = (prenom ? "Merci " + prenom + ". " : "") + "Nous vous rappelons " + (cr ? cr + ", " : "") + "du lundi au vendredi, au " + String(data.tel).trim() + "." + (LIVE ? "" : " (Aperçu : rien n'a été envoyé.)");
        }
        var h = ok.querySelector("h2,h3"); if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
      };
      if (!LIVE) { setTimeout(done, 350); return; }
      fetch(API.replace(/\/$/, "") + "/api/rappel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); return j; }); })
        .then(done)
        .catch(function () {
          btn.disabled = false; btn.textContent = btn.dataset.lbl;
          (errGen || errTel || errAcc).textContent = "L'envoi n'a pas marché. Appelez-nous directement au " + (C.tel || "") + ".";
        });
    });
  });
  window.RPrappel = open;
  /* Prochaine date de livraison possible (pages communes) */
  document.querySelectorAll("[data-next-jour]").forEach(function (el) {
    var j = +el.getAttribute("data-next-jour") % 7, d = new Date(); d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + (C.delaiCommandeJours || 3));
    while (d.getDay() !== j) d.setDate(d.getDate() + 1);
    el.textContent = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  });
})();
