/* Espace client : connexion par code e-mail, prochaine livraison, absence, formule, adresse, factures. */
(function () {
  "use strict";
  var C = window.RP || {};
  var $ = function (id) { return document.getElementById(id); };
  if (!$("acct-login")) return;
  var API = C.apiBase || "";
  var J = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  var M = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var MS = ["janv.", "févr.", "mars", "avril", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var dfmt = function (d) { return J[d.getDay()] + " " + (d.getDate() === 1 ? "1er" : d.getDate()) + " " + M[d.getMonth()]; };
  var JN = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  function nbRepas(a) { return String(a.jours || "").length * (a.service === "midi-soir" ? 2 : 1) * a.personnes; }
  function svcLab(a) { return a.service === "midi-soir" ? "Midi et soir" : a.service === "midi" ? "Le midi" : "Le soir"; }
  function daysLab(j) { var d = j.split("").map(Number); if (d.length === 7) return "tous les jours"; if (j === "12345") return "du lundi au vendredi"; if (j === "1357") return "un jour sur deux"; if (d.length >= 5) return "tous les jours sauf le " + [1,2,3,4,5,6,7].filter(function (x) { return d.indexOf(x) < 0; }).map(function (x) { return JN[x]; }).join(" et le "); return d.map(function (x) { return JN[x]; }).join(", ").replace(/, ([^,]*)$/, " et $1"); }
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  var euro = function (n) { return n.toFixed(2).replace(".", ",") + "\u00a0€"; };
  var esc = function (s) { return String(s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} } };
  var token = store.get("rp-token"), demo = false, A = null, email = "";

  function call(path, data) {
    return fetch(API + path, { method: data ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (token || "") }, body: data ? JSON.stringify(data) : undefined })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Erreur"); return j; }); });
  }
  function err(t) { $("l-err").textContent = t || ""; }

  /* Connexion */
  if (!API) $("l-demo").hidden = false;
  $("f-login").addEventListener("submit", function (e) {
    e.preventDefault(); err();
    email = $("l-email").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return err("Vérifiez l'adresse e-mail, il manque peut-être le @.");
    if (!API) return err("L'espace client s'ouvrira à la mise en ligne. En attendant, regardez l'exemple ci-dessous.");
    call("/api/login", { email: email }).then(function () {
      $("f-login").hidden = true; $("f-code").hidden = false;
      $("l-sent").textContent = "Envoyé à " + email + ". Pensez à regarder dans les courriers indésirables.";
      $("l-code").focus();
    }).catch(function () { err("L'envoi n'a pas fonctionné. Réessayez, ou appelez le " + (C.tel || "") + "."); });
  });
  $("f-code").addEventListener("submit", function (e) {
    e.preventDefault(); err();
    var code = $("l-code").value.replace(/\D/g, "");
    if (code.length !== 6) return err("Le code a 6 chiffres. Il en manque " + (6 - code.length) + ".");
    call("/api/verify", { email: email, code: code }).then(function (j) { token = j.token; store.set("rp-token", token); load(); })
      .catch(function () { err("Ce code ne fonctionne pas ou a expiré. Demandez-en un nouveau."); });
  });
  $("l-back").addEventListener("click", function () { $("f-code").hidden = true; $("f-login").hidden = false; err(); });
  $("l-demo").addEventListener("click", function () {
    demo = true;
    var z = (C.zones || [])[0], d = window.RPfirstDelivery ? window.RPfirstDelivery(z) : new Date();
    A = { actif: true, nom: "Jeanne Martin", email: "exemple@mail.fr", service: "soir", jours: "12345", personnes: 1, jour: z.jour, jourNom: z.jourNom,
      prochaine: d.toISOString().slice(0, 10), pauseJusquau: null, adresse: "3 rue des Lilas, 72000 Le Mans", consignes: "2e étage, sonner longtemps",
      payeur: "Claire Martin (sa fille)", prixSemaine: RP.total(5), avoir: 0, nonLu: 1, prochainPrelevement: d.toISOString().slice(0, 10),
      factures: [0, 1, 2].map(function (i) { return { date: new Date(Date.now() - (i + 1) * 7 * 864e5).toISOString().slice(0, 10), montant: RP.total(5), statut: "paid", lien: "" }; }),
      messages: [{ de: "client", texte: "Bonjour, maman sera à l'hôpital la semaine du 24, pouvez-vous suspendre ?", date: new Date(Date.now() - 2 * 864e5).toISOString() }, { de: "equipe", texte: "Bonjour Madame, c'est fait : pas de livraison ni de paiement la semaine du 24. Bon rétablissement à votre maman !", date: new Date(Date.now() - 1.9 * 864e5).toISOString() }] };
    render();
  });
  $("a-out").addEventListener("click", function () { store.set("rp-token", null); token = null; location.reload(); });

  function load() {
    call("/api/account").then(function (j) { A = j; render(); }).catch(function () { store.set("rp-token", null); token = null; });
  }

  /* Tableau de bord */
  function render() {
    $("acct-login").hidden = true; $("acct-home").hidden = false;
    $("a-hello").textContent = "Bonjour " + (A.nom || "").split(" ")[0];
    // Actions réservées à un abonnement en cours
    document.querySelectorAll('[data-open="skip"],[data-open="change"],[data-open="address"]').forEach(function (b) { var card = b.closest("li,.act,.card") || b; card.hidden = !A.actif; });
    var ub0 = $("a-unread"); if (ub0) { ub0.hidden = !A.nonLu; ub0.textContent = A.nonLu || ""; }
    invoices();
    if (!A.actif) {
      var E = A.essai, wk = $("a-week"); if (wk) wk.hidden = !E;
      $("a-sem").innerHTML = "";
      if (E) {
        var de = new Date(E.livraison + "T12:00:00"), lf = $("a-leaf");
        lf.querySelector(".leaf__m").textContent = MS[de.getMonth()]; lf.querySelector(".leaf__n").textContent = de.getDate(); lf.querySelector(".leaf__w").textContent = J[de.getDay()];
        $("a-status").textContent = "Votre semaine d'essai, livrée le"; $("a-next").textContent = cap(dfmt(de));
        $("a-nextsub").textContent = nbRepas(E) + " repas, remis en main propre. Vous aimez ? Passez à l'abonnement quand vous voulez, sans engagement.";
        $("a-kv").innerHTML = [["Repas", svcLab(E)], ["Jours", daysLab(E.jours || "")], ["Pour", E.personnes === 2 ? "2 personnes" : "1 personne"], ["Payé", euro(E.montant)], ["Adresse", E.adresse || ""]].map(function (r) { return "<dt>" + r[0] + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("");
        document.querySelectorAll("#a-week figure").forEach(function (f) { var dd = { lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6, dim: 7 }[f.querySelector("figcaption").textContent.slice(0, 3).toLowerCase()]; f.hidden = (E.service !== "midi-soir" && f.dataset.svc !== E.service) || String(E.jours || "").indexOf(String(dd)) < 0; });
        if (window.RPMenu) RPMenu.account(E.livraison, E.service, E.jours);
      } else {
        $("a-status").textContent = A.ancienAbonne ? "Votre abonnement est arrêté" : "Aucune commande en cours";
        $("a-next").textContent = "Envie de recommander ?";
        $("a-nextsub").innerHTML = 'Composez votre semaine en une minute, ou appelez le ' + esc(C.tel || "06 60 68 05 07") + '. <a href="index.html#composer">Commander</a>';
        $("a-kv").innerHTML = "";
      }
      var pn0 = $("a-paynext"); if (pn0) pn0.innerHTML = A.avoir ? "Avoir carte cadeau : <b>" + euro(A.avoir) + "</b>, déduit de votre prochaine commande." : "Aucun paiement prévu.";
      return;
    }
    $("a-week") && ($("a-week").hidden = false);
    var d = new Date(A.prochaine + "T12:00:00");
    var leaf = $("a-leaf");
    leaf.querySelector(".leaf__m").textContent = MS[d.getMonth()];
    leaf.querySelector(".leaf__n").textContent = d.getDate();
    leaf.querySelector(".leaf__w").textContent = J[d.getDay()];
    $("a-status").textContent = A.pauseJusquau ? "Absence enregistrée, reprise le" : "Prochaine livraison";
    $("a-next").textContent = cap(dfmt(d));
    var n = nbRepas(A);
    $("a-nextsub").textContent = n + " repas, remis en main propre. Pensez à faire de la place au frigo !";
    $("a-sem").innerHTML = window.RPsemainier ? window.RPsemainier(A.jour) : "";
    $("a-skip-t").textContent = A.pauseJusquau ? "Finalement, je serai là" : "Je serai absent cette semaine";
    $("a-skip-s").textContent = A.pauseJusquau ? "Annuler l'absence et recevoir la prochaine livraison." : "Pas de livraison, pas de paiement. Reprise la semaine suivante.";
    document.querySelectorAll("#a-week figure").forEach(function (f) { var dd = { lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6, dim: 7 }[f.querySelector("figcaption").textContent.slice(0, 3).toLowerCase()]; f.hidden = (A.service !== "midi-soir" && f.dataset.svc !== A.service) || A.jours.indexOf(String(dd)) < 0; });
    if (window.RPMenu) RPMenu.account(A.prochaine, A.service, A.jours);
    var rows = [["Repas", svcLab(A)], ["Jours", daysLab(A.jours)], ["Pour", A.personnes === 2 ? "2 personnes" : "1 personne"],
      ["Par semaine", euro(A.prixSemaine)], ["Livraison", "chaque " + A.jourNom], ["Adresse", A.adresse], ["Consignes", A.consignes || "aucune"]];
    if (A.payeur) rows.push(["Payé par", A.payeur]);
    var ub = $("a-unread"); if (ub) { ub.hidden = !A.nonLu; ub.textContent = A.nonLu || ""; }
    var pn = $("a-paynext"), fs = A.factures || [];
    if (pn) pn.innerHTML = (A.statutPaiement === "past_due" ? '<b style="color:var(--rp-brique)">Le dernier paiement n\'est pas passé.</b> Mettez à jour votre carte ou votre IBAN dans « Moyen de paiement ». ' : "") +
      (A.pauseJusquau ? "Pas de paiement pendant votre absence." : "Prochain paiement : <b>" + euro(Math.max(0, A.prixSemaine - (A.avoir || 0))) + "</b>" + (A.prochainPrelevement ? " vers le " + dfmt(new Date(A.prochainPrelevement + "T12:00:00")) : "") + ".") +
      (A.avoir ? "<br>Avoir carte cadeau : <b>" + euro(A.avoir) + "</b>, déduit automatiquement." : "");
    $("a-kv").innerHTML = rows.map(function (r) { return "<dt>" + r[0] + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("");
  }
  function invoices() {
    var fs = A.factures || [], li = $("a-invoices");
    if (li) li.innerHTML = fs.length ? fs.map(function (f) { return "<li><span>" + new Date(f.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + "</span><b>" + euro(f.montant) + '</b><span class="pill pill--' + (f.statut === "paid" ? "ok" : f.statut === "open" ? "bad" : "off") + '">' + ({ paid: "Payée", open: "À régler", void: "Annulée" }[f.statut] || f.statut) + "</span>" + (f.lien ? '<a href="' + esc(f.lien) + '" target="_blank" rel="noopener">' + (f.statut === "open" ? "Régler" : "Facture") + "</a>" : "") + "</li>"; }).join("") : '<li class="muted">Aucune facture pour l\'instant.</li>';
  }
  function chatHtml(ms) {
    if (!ms.length) return '<p class="muted" style="padding:.6rem">Pas encore de message. Écrivez-nous, une vraie personne vous répond.</p>';
    return ms.map(function (m) { return '<p class="bubble bubble--' + (m.de === "client" ? "equipe" : "client") + '"><span>' + esc(m.texte).replace(/\n/g, "<br>") + "</span><small>" + (m.de === "client" ? "Vous" : "Resto Pickup") + " · " + new Date(m.date).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + "</small></p>"; }).join("");
  }
  function say(t) { var m = $("a-msg"); m.hidden = false; m.querySelector("p").textContent = t; }

  /* Fenêtres d'action */
  var current = null;
  function open(kind) {
    if (!A.actif && (kind === "skip" || kind === "change" || kind === "address")) return say("Cette action concerne un abonnement en cours. Pour toute question : " + (C.tel || "06 60 68 05 07") + ".");
    current = kind;
    var t = "", b = "", d = new Date(A.prochaine + "T12:00:00"), next = new Date(d.getTime() + 7 * 864e5);
    if (kind === "portal") {
      if (demo) return say("Ici, le client ouvre la page sécurisée Stripe : factures, carte ou IBAN, arrêt de l'abonnement.");
      return call("/api/action", { type: "portal" }).then(function (j) { location.href = j.url; }).catch(function () { say("La page ne s'ouvre pas. Appelez-nous, nous le faisons avec vous."); });
    }
    if (kind === "skip" && !A.pauseJusquau) { t = "Vous serez absent ?"; b = '<p>Première livraison annulée : le <b>' + dfmt(d) + '</b>.</p><div class="field"><label for="s-weeks">Pendant combien de semaines ?</label><select id="s-weeks">' + [1, 2, 3, 4, 5, 6, 8].map(function (n) { return '<option value="' + n + '">' + (n === 1 ? "1 semaine" : n + " semaines") + "</option>"; }).join("") + '</select></div><p id="s-back" style="margin-top:.8rem"></p><p class="hint" style="color:var(--rp-ardoise)">Ni livraison ni paiement pendant votre absence. La livraison reprend toute seule.</p>'; }
    if (kind === "skip" && A.pauseJusquau) { t = "Vous serez là ?"; b = "<p>Nous livrons de nouveau dès le prochain " + A.jourNom + ".</p>"; current = "resume"; }
    if (kind === "change") {
      t = "Changer mes repas";
      b = '<span class="qlabel" style="margin-top:0">Quels repas ?</span><div class="choices choices--3">' + [["midi", "Le midi"], ["soir", "Le soir"], ["midi-soir", "Midi et soir"]].map(function (o) {
        return '<label class="choice"><input type="radio" name="chg-svc" value="' + o[0] + '"' + (A.service === o[0] ? " checked" : "") + "><span><b>" + o[1] + "</b></span></label>"; }).join("") + "</div>" +
        '<span class="qlabel">Quels jours ?</span><div class="daypick">' + ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."].map(function (l, i) {
        return '<label><input type="checkbox" name="chg-j" value="' + (i + 1) + '"' + (A.jours.indexOf(String(i + 1)) > -1 ? " checked" : "") + "><span>" + l + "</span></label>"; }).join("") + "</div>" +
        '<span class="qlabel">Pour combien de personnes ?</span><div class="choices"><label class="choice"><input type="radio" name="chg-p" value="1"' + (A.personnes === 1 ? " checked" : "") + '><span><b>1 personne</b></span></label><label class="choice"><input type="radio" name="chg-p" value="2"' + (A.personnes === 2 ? " checked" : "") + '><span><b>2 personnes</b></span></label></div>' +
        '<p class="hint" style="margin-top:.8rem;color:var(--rp-ardoise)">Pris en compte dès la prochaine livraison si vous changez avant le samedi.</p><p class="err" id="chg-err"></p>';
    }
    if (kind === "msg") {
      t = "Écrire à l'équipe";
      b = '<div class="chat" id="s-chat">' + chatHtml(A.messages || []) + '</div><div class="field" style="margin-top:.8rem"><label for="s-txt">Votre message</label><textarea id="s-txt" rows="4" placeholder="Par exemple : je serai à l\'hôpital du 3 au 10, ou : la blanquette était délicieuse !"></textarea></div><p class="err" id="s-err"></p>';
      A.nonLu = 0; var ub = $("a-unread"); if (ub) ub.hidden = true;
    }
    if (kind === "gift") {
      t = "Votre carte cadeau";
      b = '<div class="field"><label for="s-code">Code de la carte</label><input id="s-code" placeholder="RP-XXXX-XXXX" autocapitalize="characters" autocomplete="off"></div><p class="err" id="s-err"></p>';
    }
    if (kind === "address") {
      t = "Adresse et consignes";
      b = '<div class="form-stack"><div class="field"><label for="s-adr">Adresse de livraison</label><input id="s-adr" value="' + esc(A.adresse) + '"></div><div class="field"><label for="s-cons">Consignes au livreur</label><textarea id="s-cons">' + esc(A.consignes) + "</textarea></div></div>";
    }
    $("sheet-t").textContent = t; $("sheet-b").innerHTML = b;
    $("sheet-ok").textContent = kind === "msg" ? "Envoyer" : kind === "gift" ? "Utiliser la carte" : "Confirmer";
    if (kind === "skip" && $("s-weeks")) { var upd = function () { var w = +$("s-weeks").value, r = new Date(d.getTime() + 7 * w * 864e5); $("s-back").innerHTML = "Reprise le <b>" + dfmt(r) + "</b>."; }; $("s-weeks").addEventListener("change", upd); upd(); }
    if (kind === "msg") { var ch = $("s-chat"); ch.scrollTop = ch.scrollHeight; }
    $("sheet").hidden = false; $("veil").hidden = false; $("sheet-ok").focus();
  }
  function close() { $("sheet").hidden = true; $("veil").hidden = true; }
  document.querySelectorAll("[data-open]").forEach(function (b) { b.addEventListener("click", function () { open(b.dataset.open); }); });
  $("sheet-x").addEventListener("click", close); $("veil").addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  $("sheet-ok").addEventListener("click", function () {
    var data = { type: current }, after;
    if (current === "skip") { data.semaines = +($("s-weeks") || {}).value || 1; after = function () { A.pauseJusquau = new Date(new Date(A.prochaine).getTime() + 7 * data.semaines * 864e5).toISOString().slice(0, 10); A.prochaine = A.pauseJusquau; return "C'est noté : ni livraison ni paiement pendant " + (data.semaines === 1 ? "une semaine" : data.semaines + " semaines") + "."; }; }
    if (current === "msg") {
      var txt = $("s-txt").value.trim(); if (txt.length < 2) { $("s-err").textContent = "Écrivez votre message."; return; }
      var okMsg = function (j) { A.messages = j.messages; close(); say("Message envoyé. Nous vous répondons vite, et vous recevrez la réponse par e-mail."); };
      if (demo) return okMsg({ messages: (A.messages || []).concat([{ de: "client", texte: txt, date: new Date().toISOString() }]) });
      return fetch(API + "/api/messages", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ texte: txt }) }).then(function (r) { return r.json(); }).then(okMsg).catch(function () { $("s-err").textContent = "L'envoi n'a pas marché. Appelez-nous."; });
    }
    if (current === "gift") {
      data = { type: "cadeau", code: $("s-code").value.trim() };
      if (!data.code) { $("s-err").textContent = "Saisissez le code."; return; }
      if (demo) { A.avoir = (A.avoir || 0) + 141.3; close(); render(); return say("Carte acceptée : 141,30 € seront déduits de vos prochaines semaines."); }
      return call("/api/action", data).then(function (j) { A.avoir = (A.avoir || 0) + j.montant; close(); render(); say("Carte acceptée : " + euro(j.montant) + " seront déduits de vos prochaines semaines."); }).catch(function (e) { $("s-err").textContent = (e && e.message) || "Code non valable."; });
    }
    if (current === "resume") after = function () { A.pauseJusquau = null; return "C'est noté : nous livrons de nouveau dès le prochain " + A.jourNom + "."; };
    if (current === "change") {
      var js = Array.prototype.map.call(document.querySelectorAll('[name="chg-j"]:checked'), function (i) { return i.value; }).join("");
      var sv0 = (document.querySelector('[name="chg-svc"]:checked') || {}).value || "soir", p0 = +((document.querySelector('[name="chg-p"]:checked') || {}).value || 1); if (js.length * (sv0 === "midi-soir" ? 2 : 1) * p0 < (C.repasMin || 3)) { $("chg-err").textContent = "Minimum " + (C.repasMin || 3) + " repas par semaine : ajoutez un jour ou prenez midi et soir."; return; }
      data.service = (document.querySelector('[name="chg-svc"]:checked') || {}).value || "soir"; data.jours = js; data.personnes = +((document.querySelector('[name="chg-p"]:checked') || {}).value || 1);
      after = function () { A.service = data.service; A.jours = data.jours; A.personnes = data.personnes; A.prixSemaine = RP.total(nbRepas(A)); return "C'est noté : vos nouveaux repas commencent à la prochaine livraison."; };
    }
    if (current === "address") { data.adresse = $("s-adr").value; data.consignes = $("s-cons").value; after = function () { A.adresse = data.adresse; A.consignes = data.consignes; return "C'est noté : le livreur aura vos nouvelles consignes."; }; }
    var done = function () { var m = after(); close(); render(); say(m); };
    if (demo) return done();
    call("/api/action", data).then(done).catch(function () { close(); say("La modification n'a pas pu être enregistrée. Appelez-nous, nous la faisons pour vous."); });
  });

  if (token && API) load();
})();
