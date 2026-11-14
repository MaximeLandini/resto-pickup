/* Carte des communes (zoom, survol, toucher), recherche de commune, minuteur, repère de section. */
(function () {
  "use strict";
  function boot() {
  var C = window.RP || {};
  var M = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  var norm = function (s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); };
  var all = [];
  (C.zones || []).forEach(function (z) { z.communes.forEach(function (c) { if (!all.some(function (a) { return a.n === c[0]; })) all.push({ n: c[0], cp: c[1], z: z }); }); });
  var q = document.getElementById("z-q"), res = document.getElementById("z-res");
  var svg = document.getElementById("mapsvg"), tip = document.getElementById("map-tip"), pin = document.getElementById("pin");

  /* Zoom par viewBox, animé */
  var full = svg ? svg.getAttribute("data-full").split(" ").map(Number) : null, vb = full ? full.slice() : null, anim = null;
  function setVB(t, instant) {
    if (!svg) return;
    var from = vb.slice(), t0 = performance.now(), dur = instant || matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450;
    cancelAnimationFrame(anim);
    (function step(now) {
      var k = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3);
      vb = from.map(function (v, i) { return v + (t[i] - v) * e; });
      svg.setAttribute("viewBox", vb.join(" "));
      if (k < 1) anim = requestAnimationFrame(step);
    })(t0);
  }
  function zoomTo(cx, cy, w) {
    var h = w * full[3] / full[2];
    var x = Math.max(full[0], Math.min(cx - w / 2, full[2] - w)), y = Math.max(full[1], Math.min(cy - h / 2, full[3] - h));
    setVB([x, y, w, h]);
  }
  function pathOf(name) { return svg && svg.querySelector('.c[data-name="' + name.replace(/"/g, '\\"') + '"]'); }
  function center(z) {
    var ps = svg.querySelectorAll('.c[data-zone="' + z + '"]'), x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    ps.forEach(function (p) { var b = p.getBBox(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); });
    zoomTo((x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, (y1 - y0) * full[2] / full[3]) * 1.15);
  }
  function mark(name, zoom) {
    if (!svg) return;
    svg.querySelectorAll(".c.on").forEach(function (p) { p.classList.remove("on"); });
    var p = pathOf(name);
    if (!p) { pin.setAttribute("hidden", ""); return; }
    p.classList.add("on");
    pin.removeAttribute("hidden");
    pin.setAttribute("transform", "translate(" + p.dataset.cx + " " + p.dataset.cy + ")");
    pin.style.animation = "none"; void pin.getBBox(); pin.style.animation = "";
    if (zoom) zoomTo(+p.dataset.cx, +p.dataset.cy, full[2] * 0.45);
  }

  function answer(name) {
    var a = all.filter(function (x) { return x.n === name; })[0];
    if (!a) {
      res.innerHTML = '<div class="note-warn"><p><strong>' + name + " n'est pas encore livrée.</strong> Appelez le <b>" + (C.tel || "") + "</b> : nous ouvrons de nouvelles communes selon la demande.</p></div>";
      return;
    }
    var d = window.RPfirstDelivery ? window.RPfirstDelivery(a.z) : null;
    res.innerHTML = '<div class="note-ok"><p><strong>Oui, nous livrons ' + a.n + ".</strong> Chaque " + a.z.jourNom + (d ? ", la prochaine fois le <strong>" + d.getDate() + " " + M[d.getMonth()] + "</strong>" : "") + ".</p>" + (window.RPsemainier ? window.RPsemainier(a.z.jour) : "") + "</div>";
    try { localStorage.setItem("rp-cp", a.cp); localStorage.setItem("rp-commune", a.n); } catch (e) {}
  }

  if (svg) {
    var view = svg.parentNode;
    function showTip(p, e) {
      var r = view.getBoundingClientRect();
      var pt = e && e.clientX != null ? { x: e.clientX - r.left, y: e.clientY - r.top } : null;
      if (!pt) { var b = p.getBoundingClientRect(); pt = { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2 }; }
      tip.innerHTML = p.dataset.name + "<small>" + (p.dataset.jour ? "Livré le " + p.dataset.jour : "Pas encore livrée") + "</small>";
      tip.style.left = Math.max(70, Math.min(pt.x, r.width - 70)) + "px"; tip.style.top = Math.max(50, pt.y) + "px";
      tip.hidden = false;
    }
    svg.addEventListener("pointermove", function (e) { var p = e.target.closest(".c"); if (p && e.pointerType === "mouse") showTip(p, e); else if (e.pointerType === "mouse") tip.hidden = true; });
    svg.addEventListener("pointerleave", function () { tip.hidden = true; });
    svg.addEventListener("click", function (e) {
      var p = e.target.closest(".c"); if (!p) return;
      showTip(p, e); mark(p.dataset.name, false); answer(p.dataset.name);
      if (q) q.value = p.dataset.name;
    });
    document.querySelectorAll("[data-zoom]").forEach(function (b) { b.addEventListener("click", function () {
      var f = b.dataset.zoom === "in" ? 0.6 : 1 / 0.6, w = Math.min(full[2], Math.max(full[2] * 0.2, vb[2] * f));
      zoomTo(vb[0] + vb[2] / 2, vb[1] + vb[3] / 2, w); tip.hidden = true;
    }); });
    document.querySelectorAll("[data-go]").forEach(function (b) { b.addEventListener("click", function () {
      document.querySelectorAll("[data-go]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      tip.hidden = true;
      if (b.dataset.go === "all") setVB(full.slice()); else center(b.dataset.go);
    }); });
  }

  if (q) {
    q.addEventListener("input", function () {
      var v = norm(q.value);
      if (v.length < 2) { res.innerHTML = ""; return; }
      var hits = all.filter(function (a) { return norm(a.n).indexOf(v) === 0 || a.cp.indexOf(q.value.trim()) === 0; }).slice(0, 6);
      if (!hits.length) hits = all.filter(function (a) { return norm(a.n).indexOf(v) > -1; }).slice(0, 6);
      if (!hits.length) { res.innerHTML = '<div class="note-warn"><p>Nous ne livrons pas encore cette commune. Appelez le <b>' + (C.tel || "") + "</b>, nous ouvrons selon la demande.</p></div>"; mark("", false); return; }
      if (hits.length === 1 || norm(hits[0].n) === v) { answer(hits[0].n); mark(hits[0].n, true); return; }
      res.innerHTML = '<div class="chips">' + hits.map(function (h, i) { return '<button type="button" class="chip" data-i="' + i + '">' + h.n + "</button>"; }).join("") + "</div>";
      res.querySelectorAll(".chip").forEach(function (b) { b.addEventListener("click", function () { var h = hits[+b.dataset.i]; q.value = h.n; answer(h.n); mark(h.n, true); }); });
    });
  }

  /* Sur petit écran : la carte démarre cadrée sur les communes livrées */
  if (svg && innerWidth < 700) {
    var ps = svg.querySelectorAll(".c[data-zone]"), a0 = 1e9, b0 = 1e9, a1 = -1e9, b1 = -1e9;
    ps.forEach(function (p) { var b = p.getBBox(); a0 = Math.min(a0, b.x); b0 = Math.min(b0, b.y); a1 = Math.max(a1, b.x + b.width); b1 = Math.max(b1, b.y + b.height); });
    vb = [a0 - 10, b0 - 10, a1 - a0 + 20, b1 - b0 + 20]; svg.setAttribute("viewBox", vb.join(" "));
  }

  /* Barre basse : masquée tant que la phrase de commande est à l'écran */
  var dock = document.querySelector(".dock"), comp = document.getElementById("phrase");
  if (dock && comp && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { dock.classList.toggle("is-away", es[0].isIntersecting); }).observe(comp);
  }

  /* Minuteur du micro-ondes */
  var t = document.getElementById("mw-time");
  if (t && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var s = 180;
    setInterval(function () { s = s <= 0 ? 180 : s - 4; t.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }, 90);
  }

  /* Repère de section dans le menu */
  var links = Array.prototype.slice.call(document.querySelectorAll(".top__nav a[href*='#']"));
  if ("IntersectionObserver" in window && links.length) {
    var map = {};
    links.forEach(function (a) { var id = a.getAttribute("href").split("#")[1]; var el = document.getElementById(id); if (el) map[id] = a; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting && map[e.target.id]) { links.forEach(function (l) { l.classList.remove("is-here"); }); map[e.target.id].classList.add("is-here"); if (l2 = map[e.target.id], l2.scrollIntoView && innerWidth < 1240) l2.parentNode.scrollTo({ left: l2.offsetLeft - 16, behavior: "smooth" }); } });
    }, { rootMargin: "-40% 0px -55% 0px" });
    var l2;
    Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
  }
  }
  /* La carte (lourde) est dans un fichier à part, chargé après la page : la page s'affiche plus vite. */
  var slot = document.querySelector("[data-map-src]");
  if (slot && !document.getElementById("mapsvg")) {
    fetch(slot.getAttribute("data-map-src")).then(function (r) { if (!r.ok) throw 0; return r.text(); })
      .then(function (t) { slot.outerHTML = t; boot(); }).catch(function () { boot(); });
  } else boot();
})();
