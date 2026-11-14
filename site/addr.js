/* Saisie d'adresse assistée par la Base Adresse Nationale (api-adresse.data.gouv.fr, gratuite, sans clé).
   Si le service ne répond pas, le champ reste un champ texte normal. */
(function () {
  "use strict";
  var input = document.getElementById("f-adresse");
  if (!input || !window.fetch) return;
  var list = document.createElement("ul");
  list.className = "sugg"; list.id = "addr-sugg"; list.setAttribute("role", "listbox"); list.hidden = true;
  input.parentNode.appendChild(list);
  input.setAttribute("aria-autocomplete", "list"); input.setAttribute("aria-controls", "addr-sugg"); input.setAttribute("autocomplete", "off");
  var t = null, items = [];

  function pick(f) {
    var p = f.properties;
    input.value = p.name || p.label;
    var cp = document.getElementById("f-cp");
    if (cp && p.postcode) { cp.value = p.postcode; cp.dispatchEvent(new Event("input", { bubbles: true })); }
    var sel = document.getElementById("f-commune");
    if (sel && p.city) { setTimeout(function () { for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value.toLowerCase() === p.city.toLowerCase()) sel.value = sel.options[i].value; sel.dispatchEvent(new Event("change", { bubbles: true })); }, 0); }
    list.hidden = true;
  }
  input.addEventListener("input", function () {
    clearTimeout(t);
    var q = input.value.trim();
    if (q.length < 5) { list.hidden = true; return; }
    t = setTimeout(function () {
      var cp = (document.getElementById("f-cp") || {}).value || "";
      var url = "https://api-adresse.data.gouv.fr/search/?limit=4&type=housenumber&q=" + encodeURIComponent(q) + (cp.length === 5 ? "&postcode=" + cp : "&lat=48.05&lon=-0.1");
      fetch(url).then(function (r) { return r.json(); }).then(function (j) {
        items = (j.features || []).filter(function (f) { return /^(72|53|61)/.test(f.properties.postcode || ""); });
        if (!items.length) { list.hidden = true; return; }
        list.innerHTML = items.map(function (f, i) { return '<li><button type="button" role="option" data-i="' + i + '">' + f.properties.label + "</button></li>"; }).join("");
        list.hidden = false;
      }).catch(function () { list.hidden = true; });
    }, 250);
  });
  list.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) pick(items[+b.dataset.i]); });
  document.addEventListener("click", function (e) { if (!list.contains(e.target) && e.target !== input) list.hidden = true; });
})();
