/* Menu publié depuis l'espace équipe : page d'accueil et espace client. Sans API, le menu statique reste affiché. */
(function () {
  var C = window.RP || {}, API = String(C.apiBase || "").replace(/\/$/, "");
  var JN = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var lc = function (t) { return t ? t.charAt(0).toLowerCase() + t.slice(1) : ""; };
  var src = function (p) { return p ? (API + p.replace(/^\./, "")) : ""; };
  function isoLocal(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoLocal(d); }
  function monday(iso) { var d = new Date(iso + "T12:00:00"); return addDays(iso, -((d.getDay() + 6) % 7)); }
  var cache = {};
  function load(iso) { var l = monday(iso || isoLocal(new Date())); if (!API) return Promise.resolve([]); return cache[l] = cache[l] || fetch(API + "/api/menu?semaine=" + l).then(function (r) { return r.ok ? r.json() : { semaines: [] }; }).then(function (r) { return r.semaines || []; }).catch(function () { return []; }); }
  // repas d'une date précise, ou null si la semaine n'est pas publiée
  function slot(semaines, iso, svc) { var l = monday(iso); var w = semaines.filter(function (s) { return s.lundi === l; })[0]; if (!w) return undefined; var j = (new Date(iso + "T12:00:00").getDay() + 6) % 7 + 1; return (w.jours[j] || {})[svc] || null; }
  function allerg(m) { var a = [].concat(m.plat ? m.plat.allergenes : [], m.dessert ? m.dessert.allergenes : []).filter(function (v, i, t) { return t.indexOf(v) === i; }); return a.length ? a.join(", ") : "aucun"; }

  /* Page d'accueil : remplace les plats d'exemple par la semaine publiée */
  var box = document.querySelector("#menu .dishes");
  if (box && API) load().then(function (S) {
    var w = S[0]; if (!w) return;
    var out = [];
    for (var j = 1; j <= 7; j++) ["midi", "soir"].forEach(function (s) {
      var m = (w.jours[j] || {})[s]; if (!m || !m.plat) return;
      var ph = m.plat.photo, img = ph ? '<img src="' + esc(src(ph)) + '" alt="' + esc(m.plat.nom) + '" loading="lazy">' : '<div class="plate__label"><small>' + JN[j] + ", le " + s + "</small><b>" + esc(m.plat.nom) + "</b></div>";
      out.push('<figure class="dish" data-svc="' + s + '"><div class="plate' + (ph ? "" : " plate--menu") + '">' + img + '</div><figcaption><span class="dish__day"><img src="img/jour-' + j + '.svg" alt="" width="26" height="26">' + JN[j] + ", le " + s + "</span>" +
        (ph ? '<span class="dish__name">' + esc(m.plat.nom) + "</span>" : "") + (m.dessert ? '<span class="dish__side">En dessert, ' + esc(lc(m.dessert.nom)) + ".</span>" : "") + '<span class="dish__alg">Allergènes : ' + esc(allerg(m)) + "</span></figcaption></figure>");
    });
    if (!out.length) return;
    box.innerHTML = out.join("");
    var sec = document.getElementById("menu"), h = sec.querySelector("h2"), b = sec.querySelector(".badge-ex"), fin = addDays(w.lundi, 6);
    var f = function (iso, mo) { return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", mo ? { day: "numeric", month: "long" } : { day: "numeric" }); };
    if (h) h.textContent = "Semaine du " + f(w.lundi, w.lundi.slice(5, 7) !== fin.slice(5, 7)) + " au " + f(fin, true);
    if (b) b.remove();
  });

  /* Espace client : les repas de sa livraison (ses jours, son service), sur les 7 jours qui suivent la livraison */
  window.RPMenu = {
    account: function (livraison, service, jours) {
      var wk = document.getElementById("a-week"); if (!wk || !API || !livraison) return;
      Promise.all([load(livraison), load(addDays(livraison, 6))]).then(function (r) {
        var S = r[0].concat(r[1]), items = [], vide = true;
        for (var k = 0; k < 7; k++) {
          var d = addDays(livraison, k), j = (new Date(d + "T12:00:00").getDay() + 6) % 7 + 1;
          if (String(jours || "").indexOf(String(j)) < 0) continue;
          ["midi", "soir"].forEach(function (s) {
            if (service !== "midi-soir" && service !== s) return;
            var m = slot(S, d, s); if (m === undefined || !m || !m.plat) return; vide = false;
            var ph = m.plat.photo;
            items.push('<figure data-svc="' + s + '" title="' + esc(m.plat.nom + (m.dessert ? ", " + lc(m.dessert.nom) : "") + ". Allergènes : " + allerg(m)) + '">' + (ph ? '<img src="' + esc(src(ph)) + '" alt="' + esc(m.plat.nom) + '" loading="lazy">' : '<span class="wk-dot" aria-hidden="true">' + JN[j].slice(0, 1) + "</span>") +
              "<figcaption>" + JN[j].slice(0, 3).toLowerCase() + ". " + s + '<span class="wk-nm">' + esc(m.plat.nom) + "</span></figcaption></figure>");
          });
        }
        if (!vide) { wk.innerHTML = items.join(""); wk.classList.add("weekstrip--live"); }
      });
    }
  };
})();
