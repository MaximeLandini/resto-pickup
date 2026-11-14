/* Resto Pickup : page carte cadeau (choix, aperçu en direct, paiement, carte à imprimer). */
(function () {
  var form = document.getElementById("gift-form");
  if (!form) return;
  var C = window.RP || {}, P = Math.round(((C.prixRepas || 11.99) + ((C.livraison || {}).parRepas || 2.14)) * 100) / 100, LIVE = !!C.apiBase;
  var API = String(C.apiBase || "").replace(/\/$/, "");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var euro = function (x) { return x.toFixed(2).replace(".", ",") + " €"; };
  var autreBox = $(".gift__autre", form), nIn = $("#g-n");

  function nb() {
    var f = form.querySelector('[name="formule"]:checked').value;
    if (f !== "autre") return +f;
    var n = Math.round(+nIn.value || 0);
    return Math.min(60, Math.max(3, n));
  }
  function update() {
    var autre = form.querySelector('[name="formule"]:checked').value === "autre";
    autreBox.hidden = !autre;
    var n = nb();
    $("[data-g-total]").textContent = euro(n * P);
    $("[data-g-autre]").textContent = autre ? euro(n * P) : "à vous de choisir";
    $("[data-g-repas]").textContent = n;
    $("[data-g-pour]").textContent = $("#g-pour").value.trim() || "Maman";
    $("[data-g-de]").textContent = $("#g-de").value.trim() || "Julien";
    $("#g-btn").textContent = "Payer " + euro(n * P) + " et recevoir la carte";
  }
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  form.addEventListener("click", function (e) {
    var b = e.target.closest("[data-step]"); if (!b) return;
    nIn.value = Math.min(60, Math.max(3, (+nIn.value || 0) + +b.dataset.step)); update();
  });
  nIn.addEventListener("blur", function () { nIn.value = nb(); update(); });
  update();

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("#g-err"); err.textContent = "";
    var miss = [["#g-pour", "à qui vous l'offrez"], ["#g-de", "de la part de qui"], ["#g-email", "votre e-mail"]].filter(function (x) { return !$(x[0]).value.trim(); });
    form.querySelectorAll(".field").forEach(function (f) { f.classList.remove("has-error"); });
    if (miss.length) { miss.forEach(function (x) { $(x[0]).closest(".field").classList.add("has-error"); }); err.textContent = "Indiquez " + miss.map(function (x) { return x[1]; }).join(", ") + "."; $(miss[0][0]).focus(); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test($("#g-email").value.trim())) { $("#g-email").closest(".field").classList.add("has-error"); err.textContent = "Cette adresse e-mail semble incomplète, par exemple : prenom@gmail.com"; $("#g-email").focus(); return; }
    var data = { repas: nb(), pour: $("#g-pour").value.trim(), de: $("#g-de").value.trim(), message: $("#g-msg").value.trim(), email: $("#g-email").value.trim() };
    if (!LIVE) {
      show({ code: "RP-NOEL-2026", repas: data.repas, montant: Math.round(data.repas * P * 100), de: data.de, pour: data.pour, message: data.message, expire: Date.now() / 1000 + 365 * 86400 }, true);
      return;
    }
    var btn = $("#g-btn"); btn.disabled = true; btn.textContent = "Ouverture du paiement sécurisé…";
    fetch(API + "/api/cadeau", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.url) location.href = j.url; else throw new Error(j.error); })
      .catch(function () { btn.disabled = false; update(); err.textContent = "Le paiement n'a pas pu s'ouvrir. Réessayez, ou appelez le " + (C.tel || "") + "."; });
  });

  /* Carte payée : affichage, impression, envoi */
  var card = null;
  function show(c, demo) {
    card = c;
    var sec = $("#carte"); sec.hidden = false;
    $("[data-c-repas]").textContent = c.repas;
    $("[data-c-pour]").textContent = c.pour;
    $("[data-c-de]").textContent = c.de;
    var m = $("[data-c-msg]"); m.textContent = c.message ? "« " + c.message + " »" : ""; m.hidden = !c.message;
    $("[data-c-code]").textContent = c.code;
    $("[data-c-exp]").textContent = new Date(c.expire * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    $("[data-done-lead]").textContent = demo ? "Aperçu : sur le site en ligne, le client paie d'abord, puis arrive ici. La carte part aussi sur son e-mail." : "Elle vient aussi de partir sur votre e-mail.";
    var body = "Bonjour " + c.pour + ",\n\nJe t'offre " + c.repas + " repas Resto Pickup, livrés chez toi. " + (c.message ? c.message + "\n\n" : "\n") +
      "Ton code : " + c.code + "\nPour l'utiliser, appelle le " + (C.tel || "") + " ou commande sur restopickup.fr.\n\n" + c.de;
    $("[data-mail]").href = "mailto:?subject=" + encodeURIComponent("Un cadeau pour toi : des repas Resto Pickup") + "&body=" + encodeURIComponent(body);
    sec.scrollIntoView({ behavior: "smooth" });
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-print]")) window.print();
    var cp = e.target.closest("[data-copy]");
    if (cp && card) {
      var done = function () { cp.textContent = "Code copié"; setTimeout(function () { cp.textContent = "Copier le code"; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(card.code).then(done, done); else done();
    }
  });
  var id = new URLSearchParams(location.search).get("carte");
  if (id && LIVE) {
    fetch(API + "/api/cadeau?id=" + encodeURIComponent(id)).then(function (r) { return r.json(); }).then(function (c) { if (c.code) show(c); });
  }
})();
