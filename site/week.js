/* Composer sa semaine : la phrase, la table qui se remplit, la frise de dates. */
(function () {
  "use strict";
  var C = window.RP || {};
  var f = document.getElementById("phrase");
  if (!f) return;
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var J = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  var M = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var dfmt = function (d) { return J[d.getDay()] + " " + (d.getDate() === 1 ? "1er" : d.getDate()) + " " + M[d.getMonth()]; };
  var euro = function (n) { return n.toFixed(2).replace(".", ",") + "\u00a0€"; };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var WHO = {
    moi: ["Vous recevez", "Vous les rangez", "vous réchauffez", "Votre semaine"],
    mere: ["Votre mère reçoit", "Elle les range", "elle réchauffe", "La semaine de votre mère"],
    pere: ["Votre père reçoit", "Il les range", "il réchauffe", "La semaine de votre père"],
    parents: ["Vos parents reçoivent", "Ils les rangent", "ils réchauffent", "La semaine de vos parents"],
    proche: ["Votre proche reçoit", "Il ou elle les range", "réchauffe", "La semaine de votre proche"]
  };
  var grid = $("set-grid");
  var zone = (C.zones || [])[0], zoneCp = null;

  function findCp(cp) {
    var out = [];
    (C.zones || []).forEach(function (z) { z.communes.forEach(function (c) { if (c[1] === cp) out.push({ z: z, commune: c[0] }); }); });
    return out;
  }
  function first(z) { return window.RPfirstDelivery ? window.RPfirstDelivery(z) : new Date(); }

  var JN = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  var JMIN = C.joursMin || 3;
  var sel = [1, 2, 3, 4, 5, 6, 7];
  function daysLabel(d) {
    if (d.length === 7) return "tous les jours";
    if (d.join() === "1,2,3,4,5") return "du lundi au vendredi";
    if (d.length >= 5) { var miss = [1, 2, 3, 4, 5, 6, 7].filter(function (x) { return d.indexOf(x) < 0; }); return "tous les jours sauf le " + miss.map(function (x) { return JN[x]; }).join(" et le "); }
    return d.map(function (x) { return JN[x]; }).join(", ").replace(/, ([^,]*)$/, " et $1");
  }
  // Jours proposés par défaut pour chaque choix du menu déroulant (répartis dans la semaine).
  var PRESET = { "7": [1, 2, 3, 4, 5, 6, 7], "6": [1, 2, 3, 4, 5, 6], "5": [1, 2, 3, 4, 5], "4": [1, 2, 4, 5], "alt": [1, 3, 5, 7], "3": [1, 3, 5], "2": [2, 5] };
  function setFromCount(n) { sel = (PRESET[String(n)] || PRESET["7"]).slice(); }
  function syncSelect() {
    var j = $("ph-jours"), key = null;
    Object.keys(PRESET).forEach(function (k) { if (PRESET[k].join() === sel.join()) key = k; });
    var std = !!key;
    if (std) j.value = key;
    else { var o = j.querySelector('[value="x"]'); o.textContent = sel.length + " jours choisis"; j.value = "x"; }
  }

  function update(animate) {
    var pour = $("ph-pour").value, p = +$("ph-pers").value, svc = $("ph-svc").value, once = $("ph-essai").checked;
    var per = svc === "midi-soir" ? 2 : 1, n = sel.length * per * p, total = RP.total(n);
    var w = WHO[pour] || WHO.moi;
    $("ph-total").textContent = euro(total);
    $("ph-per").textContent = n < (C.repasMin || 3) ? "Minimum " + (C.repasMin || 3) + " repas par semaine : ajoutez un jour ou prenez midi et soir." : (once ? "en une fois, " : "par semaine, ") + n + " repas, dont " + euro(RP.fee(n)) + " de livraison" + (once ? ", sans abonnement" : "");
    $("ph-go").classList.toggle("is-disabled", n < (C.repasMin || 3)); $("ph-go").setAttribute("aria-disabled", n < (C.repasMin || 3) ? "true" : "false");
    $("set-title").textContent = w[3] + (p === 2 ? ", pour deux" : "");
    $("set-foot").innerHTML = w[0] + " <b>" + n + " repas</b> le " + zone.jourNom + " : " + (svc === "midi-soir" ? "midi et soir" : svc === "midi" ? "le midi" : "le soir") + ", " + daysLabel(sel) + ". " + w[1] + " au frigo, et " + w[2] + " celui du jour.";
    grid.dataset.pers = p;
    $$(".pl", grid).forEach(function (b, i) {
      var day = +b.closest(".col").dataset.j;
      var on = sel.indexOf(day) > -1 && (svc === "midi-soir" || b.dataset.svc === svc);
      if (b.classList.contains("on") !== on && animate) b.style.setProperty("--i", i % 7);
      b.classList.toggle("on", on);
    });
    $$(".col", grid).forEach(function (c) {
      var d = +c.dataset.j, on = sel.indexOf(d) > -1;
      c.classList.toggle("is-off", !on);
      var bt = c.querySelector(".col__d"); bt.setAttribute("aria-pressed", on ? "true" : "false");
      c.classList.toggle("is-liv", d === ((zone.jour + 6) % 7) + 1);
    });
    var hash = "#f-" + svc + "-" + sel.join("") + "-" + p + (pour !== "moi" ? "-proche" : "") + (once ? "-essai" : "");
    $("ph-go").href = "commander.html" + hash;
    $("ph-go").textContent = once ? "Essayer une semaine" : "Continuer";
  }

  function onCp() {
    var cp = $("ph-cp").value.replace(/\D/g, "").slice(0, 5), when = $("ph-when");
    $("ph-cp").value = cp;
    f.classList.remove("is-out");
    if (cp.length < 5) { when.textContent = "Indiquez le code postal pour voir votre jour de livraison."; zone = C.zones[0]; update(false); return; }
    var hits = findCp(cp);
    if (!hits.length) {
      f.classList.add("is-out");
      when.innerHTML = "Nous ne livrons pas encore le " + cp + ". Appelez le <b>" + (C.tel || "") + "</b> : nous ouvrons de nouvelles communes selon la demande.";
      return;
    }
    zone = hits[0].z; zoneCp = cp;
    var names = hits.map(function (h) { return h.commune; });
    var d = first(zone);
    when.innerHTML = "Livré le <b>" + dfmt(d) + "</b>, puis chaque " + zone.jourNom + ", à " + (names.length > 2 ? names.slice(0, 2).join(", ") + " et alentour" : names.join(" ou ")) + ".";
    store.set("rp-cp", cp);
    if (hits.length === 1) store.set("rp-commune", names[0]); else store.set("rp-commune", "");
    update(true);
  }

  function frise() {
    var d = first(zone), cut = new Date(d.getTime() - (C.delaiCommandeJours || 3) * 864e5);
    var MS = ["janv.", "févr.", "mars", "avril", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    var leaf = function (k, dt) {
      var el = document.querySelector('.leaf[data-k="' + k + '"]'); if (!el) return;
      el.querySelector(".leaf__m").textContent = MS[dt.getMonth()];
      el.querySelector(".leaf__n").textContent = dt.getDate();
      el.querySelector(".leaf__w").textContent = J[dt.getDay()];
    };
    leaf("today", new Date()); leaf("cutoff", cut); leaf("delivery", d);
  }

  grid.addEventListener("click", function (e) {
    var d = e.target.closest(".col__d");
    if (d) {
      var day = +d.dataset.day, k = sel.indexOf(day);
      if (k > -1) { var per2 = $("ph-svc").value === "midi-soir" ? 2 : 1; if (sel.length <= JMIN || (sel.length - 1) * per2 * (+$("ph-pers").value) < (C.repasMin || 3)) { $("set-foot").innerHTML = "<b>Minimum " + (C.repasMin || 3) + " repas par semaine</b> : ajoutez un jour ou prenez midi et soir."; return; } sel.splice(k, 1); }
      else { sel.push(day); sel.sort(); }
      syncSelect(); update(true); return;
    }
    var b = e.target.closest(".pl"); if (!b) return;
    var added = "";
    var day2 = +b.closest(".col").dataset.j, svc = $("ph-svc").value;
    if (sel.indexOf(day2) < 0) { sel.push(day2); sel.sort(); syncSelect(); added = "Le " + JN[day2] + " est ajouté."; }
    if (svc !== "midi-soir" && b.dataset.svc !== svc) { $("ph-svc").value = "midi-soir"; added = (added ? added + " " : "") + "Midi et soir sélectionnés."; }
    update(true);
    $$(".pl.is-pick", grid).forEach(function (x) { x.classList.remove("is-pick"); });
    b.classList.add("is-pick");
    var sv = b.dataset.svc === "midi" ? "le midi" : "le soir";
    $("set-foot").innerHTML = '<span class="pick">' + (b.dataset.photo ? '<img src="' + b.dataset.photo + '" alt="" width="64" height="64">' : "") +
      "<span><small>" + b.dataset.day + ", " + sv + "</small><b>" + b.dataset.plat + "</b>" + (added ? "<em>" + added + "</em>" : "") + "</span></span>";
  });
  $("ph-jours").addEventListener("change", function () { if ($("ph-jours").value !== "x") { setFromCount($("ph-jours").value); update(true); } });
  $("ph-essai").addEventListener("change", function () { update(false); });
  ["ph-pour", "ph-pers", "ph-svc"].forEach(function (id) { $(id).addEventListener("change", function () { update(true); }); });
  $("ph-cp").addEventListener("input", onCp);
  f.addEventListener("submit", function (e) { e.preventDefault(); location.href = $("ph-go").href; });

  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-pour],[data-formule]");
    if (!a || a.id) return;
    if (a.dataset.pour) $("ph-pour").value = a.dataset.pour;
    if (a.dataset.formule === "essai") $("ph-essai").checked = true;
    update(true);
  });

  var saved = store.get("rp-cp");
  if (saved) { $("ph-cp").value = saved; onCp(); } else update(false);
})();
