/* Resto Pickup : outil équipe, commande prise au téléphone et lien de paiement envoyé par SMS. */
(function () {
  var form = document.getElementById("team-form");
  if (!form) return;
  var C = window.RP || {}, P = C.prixRepas || 11.99, LIVE = !!C.apiBase, MIN = C.joursMin || 3;
  var API = String(C.apiBase || "").replace(/\/$/, "");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var euro = function (x) { return x.toFixed(2).replace(".", ",") + " €"; };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var key = $("#t-key"); key.value = store.get("rp-admin") || "";
  // connecté à l'espace équipe : la clé n'est plus nécessaire
  if (store.get("rp-admin-token") && key.closest(".field")) key.closest(".field").hidden = true;
  key.addEventListener("change", function () { store.set("rp-admin", key.value); });
  var JN = ["", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

  function val(n) { var r = form.querySelector('[name="' + n + '"]:checked'); return r ? r.value : ""; }
  function jours() { return $$('[name="jours"]:checked', form).map(function (i) { return i.value; }); }
  function zoneOf(cp, commune) {
    var hit = null;
    (C.zones || []).forEach(function (z) { z.communes.forEach(function (c) { if (c[1] === cp && (!commune || c[0] === commune)) hit = hit || { zone: z, commune: c[0] }; }); });
    return hit;
  }
  function first(z) {
    var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + (C.delaiCommandeJours || 3));
    var js = z.jour % 7; while (d.getDay() !== js) d.setDate(d.getDate() + 1); return d;
  }
  function calc() {
    var j = jours(), per = val("service") === "midi-soir" ? 2 : 1, n = j.length * per * (+val("personnes") || 1);
    $("#t-total").innerHTML = n < (C.repasMin || 3) ? "Minimum " + (C.repasMin || 3) + " repas par semaine." : "<b>" + n + " repas, " + euro(RP.total(n)) + "</b> " + (val("essai") ? "une seule fois" : "par semaine") + ", dont " + euro(RP.fee(n)) + " de livraison";
    $("[data-t-proche]").hidden = val("pour") !== "proche";
    $("[data-t-moi]").hidden = val("pour") === "proche";
    return n;
  }
  form.addEventListener("change", calc);
  calc();

  var cp = $("#t-cp"), com = $("#t-com");
  cp.addEventListener("input", function () {
    var v = cp.value.replace(/\D/g, "").slice(0, 5), list = [];
    (C.zones || []).forEach(function (z) { z.communes.forEach(function (c) { if (c[1] === v && list.indexOf(c[0]) < 0) list.push(c[0]); }); });
    com.innerHTML = list.length ? list.map(function (n) { return "<option>" + n + "</option>"; }).join("") : '<option value="">' + (v.length === 5 ? "Non livré" : "Code postal d'abord") + "</option>";
    showZone();
  });
  com.addEventListener("change", showZone);
  function showZone() {
    var h = zoneOf(cp.value.trim(), com.value);
    $("#t-zone").textContent = h ? "Livré le " + h.zone.jourNom + ". Première livraison : " + first(h.zone).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) + "." : (cp.value.length === 5 ? "Commune non livrée." : "");
  }

  var hp = /#tel=([^&]+)/.exec(location.hash);
  if (hp) $("#t-tel").value = decodeURIComponent(hp[1]);

  function post(body) {
    return fetch(API + "/api/lien", { method: "POST", headers: Object.assign({ "Content-Type": "application/json", "x-admin-key": key.value }, store.get("rp-admin-token") ? { Authorization: "Bearer " + store.get("rp-admin-token") } : {}), body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Erreur"); return j; }); });
  }
  $("#t-check").addEventListener("click", function () {
    var m = $("#t-code-msg"), c = $("#t-code").value.trim();
    if (!c) { m.textContent = "Saisissez le code."; return; }
    if (!LIVE) { m.textContent = "Aperçu : code valable, 10 repas (119,90 €), offert par Julien."; return; }
    m.textContent = "Vérification…";
    post({ verifier_code: c }).then(function (g) {
      m.textContent = g.utilisee ? "Déjà utilisé." : g.expiree ? "Expiré." : "Valable : " + euro(g.montant / 100) + ", offert par " + (g.de || "?") + " pour " + (g.pour || "?") + ".";
    }).catch(function (e) { m.textContent = e.message; });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("#t-err"); err.textContent = "";
    var n = calc(), j = jours();
    var data = {}; new FormData(form).forEach(function (v, k) { data[k] = v; });
    data.jours = j.join(""); data.service = val("service"); data.essai = val("essai") ? "1" : "";
    var h = zoneOf(cp.value.trim(), com.value);
    if (n < (C.repasMin || 3)) { err.textContent = "Minimum " + (C.repasMin || 3) + " repas par semaine."; return; }
    var miss = ["prenom", "nom", "adresse", "tel"].filter(function (k) { return !String(data[k] || "").trim(); });
    if (miss.length || !h) { err.textContent = !h ? "Code postal ou commune non livrés." : "Il manque : " + miss.join(", ") + "."; return; }
    if (data.pour === "proche" && !String(data.p_tel || data.p_email || "").trim()) { err.textContent = "Indiquez le téléphone ou l'e-mail du proche qui paie."; return; }
    data.zone = h.zone.id; data.premiereLivraison = first(h.zone).toISOString().slice(0, 10);
    var btn = form.querySelector('[type="submit"]'); btn.disabled = true;
    var go = LIVE ? post(data) : Promise.resolve({ url: "https://checkout.stripe.com/c/pay/apercu", total: Math.round(RP.total(n) * 100) });
    go.then(function (r) { out(r, data, n); }).catch(function (e2) { err.textContent = e2.message; }).then(function () { btn.disabled = false; });
  });

  function out(r, d, n) {
    var box = $("#t-out"); box.hidden = false;
    $("#t-link").textContent = r.url + (LIVE ? "" : "   (aperçu, lien fictif)");
    var svc = { midi: "le midi", soir: "le soir", "midi-soir": "midi et soir" }[d.service];
    var days = d.jours.split("").map(function (x) { return JN[+x]; }).join(" ");
    var txt = "Bonjour " + (d.pour === "proche" ? (d.p_prenom || "") : d.prenom) + ", voici le lien pour régler " + (d.pour === "proche" ? "les repas Resto Pickup de " + d.prenom : "vos repas Resto Pickup") +
      " : " + n + " repas " + svc + " (" + days + "), " + euro((r.total || RP.total(n) * 100) / 100) + (d.essai ? "." : " par semaine, sans engagement.") +
      "\n" + r.url + "\nLe lien est valable 24 h. Une question : " + (C.tel || "") + ". Resto Pickup";
    $("#t-sms").value = txt;
    var sms = function (tel) { return "sms:" + String(tel || "").replace(/[^\d+]/g, "") + "?&body=" + encodeURIComponent($("#t-sms").value); };
    $("#t-sms-1").href = sms(d.tel);
    $("#t-sms-2").hidden = !(d.pour === "proche" && d.p_tel); $("#t-sms-2").href = sms(d.p_tel);
    $("#t-mail").href = "mailto:" + encodeURIComponent(d.pour === "proche" ? d.p_email || "" : d.email || "") + "?subject=" + encodeURIComponent("Vos repas Resto Pickup : lien de paiement") + "&body=" + encodeURIComponent($("#t-sms").value);
    box.scrollIntoView({ behavior: "smooth" });
  }
  $("#t-sms").addEventListener("input", function () { var d = $("#t-sms").value; ["#t-sms-1", "#t-sms-2"].forEach(function (s) { var a = $(s); a.href = a.href.replace(/body=.*$/, "body=" + encodeURIComponent(d)); }); });
  $("#t-copy").addEventListener("click", function () { var t = $("#t-sms").value, b = $("#t-copy"); var ok = function () { b.textContent = "Copié"; setTimeout(function () { b.textContent = "Copier"; }, 2000); }; if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, ok); else ok(); });
})();
