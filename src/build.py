#!/usr/bin/env python3
"""Génère le site statique Resto Pickup depuis data.json et les gabarits.
Usage : python3 build.py   (sortie dans ../site et ../artifact)
Pour changer le menu de la semaine : modifier "menu" dans data.json puis relancer."""
import hashlib, json, html, os, shutil, datetime, re

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, "..", "site")
ART = os.path.join(ROOT, "..", "artifact")
D = json.load(open(os.path.join(ROOT, "data.json"), encoding="utf-8"))
E = html.escape
TODAY = datetime.date.today().isoformat()
HASHES = {}

def eur(x):
    return f"{x:.2f}".replace(".", ",") + "\u00a0€"

P = D["prixRepas"]
LPR, LMIN, LMAX, RMIN = D["livraisonParRepas"], D["livraisonMin"], D["livraisonMax"], D["repasMin"]
def fee(n): return round(min(LMAX, max(LMIN, LPR * n)), 2)
def tot(n): return round(n * P + fee(n), 2)
G = round(P + LPR, 2)  # repas offert, livraison comprise (carte cadeau)
VARS = {
    "tel": D["tel"], "telHref": D["telHref"], "email": D["email"], "prix": eur(P),
    "p1": eur(tot(7)), "g5": eur(5 * G), "g10": eur(10 * G), "g20": eur(20 * G), "p5": eur(tot(5)), "p1x2": eur(tot(14)), "p2": eur(tot(14)), "p2x2": eur(tot(28)), "liv": eur(LPR), "r5": eur(5 * P), "r7": eur(7 * P), "r14": eur(14 * P), "livmin": eur(LMIN), "livmax": eur(LMAX), "gunit": eur(G),
    "semaine": D["menu"]["semaine"],
    "badge": '<span class="badge-ex">exemple</span>' if D["menu"].get("exemple") else "",
}

FAQ = [
    ("Combien ça coûte ?",
     f"{eur(P)} le repas, plat et dessert. La livraison coûte {eur(LPR)} par repas, avec un minimum de {eur(LMIN)} et jamais plus de {eur(LMAX)} par semaine, même pour 14 ou 28 repas. Par exemple, 5 soirs par semaine font {eur(tot(5))} livraison comprise, et toute la semaine midi et soir {eur(tot(14))}. Commande minimum : {RMIN} repas par semaine. Pas de frais d'inscription, pas d'engagement."),
    ("Quel jour êtes-vous livré ?",
     "Le mardi au Mans et dans un rayon de 30 km (Ballon, Bonnétable, Connerré, Écommoy, Beaumont-sur-Sarthe…). Le jeudi autour de Loué et Sablé, et en Mayenne et dans l'Orne côté Sarthe : Laval, Évron, Mayenne, Château-Gontier, Meslay, Alençon et leurs alentours. Vous recevez tous les repas de la semaine en une seule fois."),
    ("Faut-il être chez soi à la livraison ?",
     "Oui, ou une personne de confiance. Le livreur remet le carton en main propre et ne le laisse jamais devant la porte. Si personne n'ouvre, il vous appelle, puis appelle le proche que vous avez indiqué."),
    ("Comment réchauffer les repas ?",
     "Au micro-ondes, en quelques minutes. Le temps est écrit sur l'étiquette. Vous retirez le film et vous lancez : pas de cuisine, pas de vaisselle."),
    ("Combien de temps se gardent les repas ?",
     "Chaque barquette porte sa date limite. Rangez-les au frigo dès la livraison et mangez-les dans l'ordre des jours écrits sur l'étiquette."),
    ("Peut-on choisir le nombre de repas ?",
     "Oui. Vous choisissez le midi, le soir ou les deux, et les jours qui vous conviennent, à partir de 3 jours par semaine. Vous pouvez changer chaque semaine, avant le samedi."),
    ("Peut-on choisir ses plats ?",
     "Non. Tous nos clients reçoivent le même menu, qui change chaque semaine. C'est ce qui nous permet de garder ce prix sans rien jeter. Le menu est publié à l'avance sur cette page."),
    ("Faites-vous des menus sans sel, diabétiques ou mixés ?",
     "Nous préférons être clairs : nous ne faisons pas de menus spéciaux. Il n'y a pas de version sans sel, sans sucre ou mixée, tout le monde mange le même menu. Si votre médecin vous a prescrit un régime strict, notre service n'est pas adapté. Pour une alimentation simplement variée et équilibrée, nos plats conviennent. Les ingrédients et les allergènes sont écrits sur chaque barquette."),
    ("Comment faire une pause ou arrêter ?",
     f"Un appel au {D['tel']} suffit, ou un clic dans votre espace client, avant le samedi pour la semaine suivante. Sans frais et sans avoir à vous justifier."),
    ("Peut-on essayer avant de s'abonner ?",
     "Oui. Cochez « Juste une semaine pour essayer » : vous composez vos repas comme vous voulez, ils sont livrés une seule fois, sans abonnement. Vous continuez seulement si vous aimez."),
    ("Puis-je commander pour mon père ou ma mère ?",
     "Oui. Vous choisissez « ma mère », « mon père » ou « un proche » au moment de commander. Vous payez et recevez les factures, votre parent reçoit les repas chez lui."),
    ("Comment payer ?",
     "Par carte bancaire ou par prélèvement, chaque semaine. Le paiement est sécurisé par Stripe : nous ne voyons jamais vos coordonnées bancaires. Vous n'êtes pas à l'aise avec Internet ? Demandez à être rappelé : nous faisons la commande avec vous et nous envoyons le lien de paiement par SMS, à vous ou à votre enfant."),
]

FAQ_IC = ["cadenas", "calendrier", "livraison", "micro", "refrigere", "calendrier", "calendrier", "allergenes", "pause", "calendrier", "telephone", "cadenas"]
def faq_html(items, icons=False):
    out = []
    for i, (q, a) in enumerate(items):
        ic = icon(FAQ_IC[i % len(FAQ_IC)]) if icons else ""
        first, _, rest = a.partition(". ")
        ans = f"<p><b>{E(first)}.</b> {E(rest)}</p>" if icons and rest else f"<p>{E(a)}</p>"
        out.append(f"<details><summary>{ic}<span>{E(q)}</span></summary>{ans}</details>")
    return "".join(out)

def faq_ld(items):
    return {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in items]}

def semainier():
    out = []
    for j in D["menu"]["jours"]:
        cells = []
        for k, lab in (("midi", "Midi"), ("soir", "Soir")):
            m = j[k]
            cells.append(f'<div class="meal meal--{k}"><span class="tag">{lab}</span>'
                         f'<span class="plat">{E(m["plat"])}</span><span class="side">{E(m["dessert"])}</span></div>')
        out.append(f'<article class="day"><h3>{j["jour"]}</h3>{"".join(cells)}</article>')
    return "".join(out)

IC = {
 "livraison": '<path d="M2.5 7h11v9h-11zM13.5 10h4l3 3.2V16h-7z"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/><circle class="dot" cx="8" cy="11.5" r="1.6"/>',
 "calendrier": '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle class="dot" cx="12" cy="15.2" r="1.9"/>',
 "four": '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 8h17"/><rect x="7" y="11" width="10" height="6.5" rx="1.5"/><circle class="dot" cx="7" cy="5.8" r="1.1"/>',
 "refrigere": '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.6 4.6 12 7l2.4-2.4M9.6 19.4 12 17l2.4 2.4"/><circle class="dot" cx="12" cy="12" r="1.6"/>',
 "telephone": '<path d="M7 3.5h3l1.4 4.3-2 1.5a11.5 11.5 0 0 0 5.3 5.3l1.5-2 4.3 1.4v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 5 5.5a2 2 0 0 1 2-2z"/>',
 "cadenas": '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle class="dot" cx="12" cy="15.5" r="1.5"/>',
 "micro": '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><rect x="5" y="7.5" width="10" height="9" rx="1.5"/><path d="M18 8.5v.1M18 11.5v.1"/><circle class="dot" cx="18" cy="15" r="1.3"/>',
 "pause": '<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/>',
 "allergenes": '<path d="M12 21V9M12 13c-2.4 0-3.8-1.4-3.8-3.8 2.4 0 3.8 1.4 3.8 3.8zm0 0c2.4 0 3.8-1.4 3.8-3.8-2.4 0-3.8 1.4-3.8 3.8zM12 17.5c-2.4 0-3.8-1.4-3.8-3.8 2.4 0 3.8 1.4 3.8 3.8zm0 0c2.4 0 3.8-1.4 3.8-3.8-2.4 0-3.8 1.4-3.8 3.8zM12 8.5c-1.4-1-1.4-3 0-5 1.4 2 1.4 4 0 5z"/>',
 "maison": '<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
 "coeur": '<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
 "croix": '<path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z"/>',
 "personnes": '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.8-3.3 2.9-5 5.5-5s4.7 1.7 5.5 5"/><circle cx="16.5" cy="9" r="2.6"/><path d="M15.5 14.6c2.5-.3 4.4 1.2 5 4.4"/>',
 "immeuble": '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 7.5h2M13 7.5h2M9 11h2M13 11h2M9 14.5h2M13 14.5h2M10.5 20.5v-3h3v3"/>',
}
def icon(n, cls="ic"):
    return f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{IC[n]}</svg>'

JOURN = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]

def lc(t): return t[0].lower()+t[1:]

def dish(j, svc, big=False):
    m = j[svc]
    ph = m.get("photo") or ""
    n = JOURN.index(j["jour"]) + 1
    inner = (f'<img src="{E(ph)}" alt="{E(m["plat"])}" loading="lazy">' if ph else
             f'<div class="plate__label"><small>{j["jour"]}, le {svc}</small><b>{E(m["plat"])}</b></div>')
    return (f'<figure class="dish" data-svc="{svc}"><div class="plate{"" if ph else " plate--menu"}">{inner}</div><figcaption>'
            f'<span class="dish__day"><img src="img/jour-{n}.svg" alt="" width="26" height="26">{j["jour"]}, le {svc}</span>' +
            (f'<span class="dish__name">{E(m["plat"])}</span>' if ph else '') +
            f'<span class="dish__side">En dessert, {E(lc(m["dessert"]))}.</span></figcaption></figure>')

def weekstrip():
    return "".join(f'<figure data-svc="{svc}"><img src="{E(j[svc].get("photo",""))}" alt="{E(j[svc]["plat"])}" loading="lazy"><figcaption>{j["jour"][:3]}. {svc}</figcaption></figure>' for j in D["menu"]["jours"] for svc in ("midi", "soir"))

def settable():
    out = []
    for i, j in enumerate(D["menu"]["jours"]):
        pls = "".join(f'<button type="button" class="pl" data-svc="{svc}" data-day="{j["jour"]}" data-plat="{E(j[svc]["plat"])}" data-photo="{E(j[svc].get("photo",""))}" aria-label="{j["jour"]} {svc} : {E(j[svc]["plat"])}"><span style="background-image:url({E(j[svc].get("photo",""))})"></span></button>' for svc in ("midi", "soir"))
        out.append(f'<div class="col" data-j="{i+1}"><button type="button" class="col__d" data-day="{i+1}" aria-pressed="true" aria-label="{j["jour"]}">{j["jour"][0]}</button>{pls}</div>')
    return '<div class="rowlab"><span></span><span>Midi</span><span>Soir</span></div>' + "".join(out)

def labels():
    J = D["menu"]["jours"]
    picks = [(J[1], "soir", 2, "gluten, lait, œuf"), (J[2], "midi", 3, "poisson, lait"), (J[3], "soir", 4, "gluten, lait")]
    out = []
    for k, (j, svc, n, al) in enumerate(picks):
        m = j[svc]
        out.append(f'<article class="label label--{k+1}"><header><img src="img/jour-{n}.svg" alt="" width="44" height="44"><p><b>{j["jour"]}</b><span>le {svc}</span></p><img class="label__logo" src="img/logo-compacte.svg" alt="" width="96" height="24"></header>'
                   f'<h3>{E(m["plat"])}</h3><p class="label__sides">En dessert, {E(lc(m["dessert"]))}.</p>'
                   f'<dl><div><dt>Au four</dt><dd>temps à indiquer</dd></div><div><dt>À consommer jusqu\'au</dt><dd class="num">{10+n}/11/2026</dd></div></dl>'
                   f'<p class="label__all">Allergènes : <b>{al}</b></p></article>')
    return "".join(out)

def dishes():
    return "".join(dish(j, svc) for j in D["menu"]["jours"] for svc in ("midi", "soir"))

def bento():
    return ""

def plans():
    items = [
        ("essai", 7, "Semaine d'essai", "Pour goûter, sans abonnement", "", ["7 repas du soir", "Une seule livraison", "Aucun abonnement", "Vous continuez si vous aimez"], "Essayer une semaine", "btn--ghost"),
        ("soir", 7, "Le soir", "Le dîner de toute la semaine", "", ["7 repas du soir", "Livrés chaque semaine", "Pause ou arrêt sans frais", "Possible pour un proche"], "Choisir le soir", "btn--main"),
        ("midi-soir", 14, "Midi et soir", "Plus besoin de cuisiner", "Le plus complet", ["14 repas, midi et soir", "Livrés chaque semaine", "Pause ou arrêt sans frais", "Possible pour un proche"], "Choisir midi et soir", "btn--main"),
    ]
    out = []
    for f, n, t, sub, flag, feats, cta, bcls in items:
        hl = " plan--hl" if flag else ""
        fl = f'<span class="plan__flag">{flag}</span>' if flag else '<span class="plan__flag" style="visibility:hidden">.</span>'
        per = "en une fois" if f == "essai" else "par semaine"
        out.append(f'<article class="plan{hl}" data-formule="{f}" data-repas="{n}">{fl}<h3>{t}</h3><p class="plan__sub">{sub}</p>'
                   f'<div class="plan__price"><b>{eur(P)}<small>le repas complet</small></b>'
                   f'<span>soit <strong data-total>{eur(tot(n))}</strong> {per}, <span data-count>{n} repas</span></span></div>'
                   f'<ul>{"".join(f"<li>{x}</li>" for x in feats)}</ul><a class="btn {bcls} btn--lg" href="commander.html#f-{f}-1">{cta}</a></article>')
    return "".join(out)

def zonecards():
    out = []
    for z in D["zones"]:
        names = sorted({c[0] for c in z["communes"]})
        out.append(f'<article class="zcard"><img src="img/jour-{z["jour"]}.svg" alt="Assiette du {z["jourNom"]}" width="72" height="72"><span class="day-pill">Livré le {z["jourNom"]}</span><h3>{E(z["nom"])}</h3><span></span>'
                   f'<p class="towns">{E(", ".join(names))}.</p><a href="{z["page"]}">Portage de repas : {E(z["nom"])}</a></article>')
    return "".join(out)

COORDS = json.load(open(os.path.join(ROOT, "coords.json"), encoding="utf-8"))
import math
def hull(pts):
    pts = sorted(set(pts))
    if len(pts) < 3: return pts
    cr = lambda o, a, b: (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]

GEO = json.load(open(os.path.join(ROOT, "geo.json"), encoding="utf-8"))
def zmap():
    x0, y0, x1, y1 = GEO["bbox"]
    kx = math.cos(math.radians((y0 + y1) / 2))
    W = 800; H = round(W * (y1 - y0) / ((x1 - x0) * kx))
    P = lambda x, y: ((x - x0) / (x1 - x0) * W, (y1 - y) / (y1 - y0) * H)
    zone_of = {row[2]: z for z in D["zones"] for row in z["communes"]}
    col = {2: "mardi", 4: "jeudi"}
    base, served, labels, cent = [], [], [], {}
    key = {"Le Mans", "Loué", "Sillé-le-Guillaume", "Brûlon", "La Suze-sur-Sarthe", "Noyen-sur-Sarthe", "Conlie", "Allonnes", "Coulaines", "Mulsanne", "Coulans-sur-Gée", "Sablé-sur-Sarthe", "Ballon-Saint Mars", "Écommoy", "Parigné-l'Évêque", "Montfort-le-Gesnois", "Savigné-l'Évêque", "Sainte-Suzanne-et-Chammes", "Solesmes", "Malicorne-sur-Sarthe", "Parcé-sur-Sarthe", "Saulges", "Bernay-Neuvy-en-Champagne", "Tennie", "Laval", "Évron", "Mayenne", "Alençon", "Château-Gontier-sur-Mayenne", "Meslay-du-Maine", "Villaines-la-Juhel", "Montsûrs", "Bais", "Pré-en-Pail-Saint-Samson", "Bonnétable", "Beaumont-sur-Sarthe", "Fresnay-sur-Sarthe", "Le Grand-Lucé", "Bouloire"}
    for c in GEO["communes"]:
        dd = []; sx = sy = cnt = 0
        for r in c["r"]:
            pts, last = [], None
            for x, y in r:
                px, py = P(x, y)
                if last is None or abs(px - last[0]) + abs(py - last[1]) > 3.2:
                    pts.append(f"{px:.0f},{py:.0f}"); last = (px, py); sx += px; sy += py; cnt += 1
            if len(pts) > 2: dd.append("M" + "L".join(pts) + "Z")
        if not dd: continue
        cx, cy = sx / cnt, sy / cnt
        z = zone_of.get(c.get("c"))
        cls = f'c c--{col[z["jour"]]}' if z else "c"
        attr = f' data-zone="{z["id"]}" data-jour="{z["jourNom"]}"' if z else ""
        path = f'<path class="{cls}" d="{"".join(dd)}" data-name="{E(c["n"])}" data-cx="{cx:.0f}" data-cy="{cy:.0f}"{attr}/>'
        (served if z else base).append(path)
        if c["n"] in key and not (c["n"] == "Changé" and str(c.get("c", "")).startswith("53")) and 0 < cx < W and 0 < cy < H:
            hub = c["n"] in ("Le Mans", "Loué", "Laval", "Alençon")
            labels.append(f'<text class="ml{" ml--hub" if hub else ""}{" ml--out" if not z else ""}" x="{cx:.0f}" y="{cy + (6 if hub else 4):.0f}" text-anchor="middle">{E(c["n"])}</text>')
    return (f'<svg id="mapsvg" preserveAspectRatio="xMidYMid slice" viewBox="0 0 {W} {H}" data-full="0 0 {W} {H}" role="img" aria-labelledby="map-t"><title id="map-t">Carte : communes livrées le mardi autour du Mans, et le jeudi autour de Loué, Sablé, Laval, Évron et Alençon</title>'
            f'<rect class="sea" x="-400" y="-400" width="{W+800}" height="{H+800}"/><g>{"".join(base)}</g><g>{"".join(served)}</g><g class="labels">{"".join(labels)}</g>'
            '<g id="pin" class="pin" hidden><path d="M0 0c-9-13-15-20-15-29a15 15 0 0 1 30 0c0 9-6 16-15 29z"/><circle cy="-29" r="6"/></g></svg>')

def zonedays():
    out = []
    for z in D["zones"]:
        names = sorted({c[0] for c in z["communes"]})
        out.append(f'<details class="zd"><summary><img src="img/jour-{z["jour"]}.svg" alt="" width="44" height="44"><span><b>{E(z["nom"])}</b>Livré le {z["jourNom"]}, {len(names)} communes</span></summary>'
                   f'<p class="zd__list">{E(", ".join(names))}.</p><a href="{z["page"]}">Tout sur la livraison : {E(z["nom"])}</a></details>')
    return "".join(out)

def towns(z):
    seen, out = set(), []
    for n, cp, *_ in z["communes"]:
        if n in seen: continue
        seen.add(n)
        cps = ", ".join(sorted({c for nn, c, *_ in z["communes"] if nn == n}))
        cc = next((c for c in COMMUNES.values() if c["nom"] == n and c["zone"] is z), None)
        out.append(f'<li><a href="{cc["page"]}">{E(n)}</a> <small>{cps}</small></li>' if cc else f"<li>{E(n)} <small>{cps}</small></li>")
    tid = "tg-" + slugify(z["id"]) if "slugify" in globals() else "tg-" + z["id"]
    more = (f'<label for="{tid}" class="btn btn--ghost tg-more__btn">Voir les {len(out)} communes</label>' if len(out) > 20 else "")
    return f'<input type="checkbox" id="{tid}" class="tg-more" hidden><ul class="towns-grid">' + "".join(out) + "</ul>" + more

J0 = D["menu"]["jours"]
def _short(p): p = p.split(",")[0].strip(); return p[0].lower() + p[1:]
VARS["vsRecettes"] = E(", ".join(_short(J0[i]["midi"]["plat"]) for i in range(3)))
VARS.update({"heroPlat": E(J0[1]["midi"]["plat"]), "heroDessert": E(J0[1]["midi"]["dessert"]), **{"ic_"+k: icon(k) for k in IC}, "dishes": dishes(), "weekstrip": weekstrip(), "settable": settable(), "labels": labels(), "bento": bento(), "plans": plans(), "semainier": semainier(), "zonecards": zonecards(), "faq": faq_html(FAQ, True), "map": '<div class="map__load" data-map-src="carte.svg" aria-hidden="true"></div>', "zonedays": zonedays()})

def fill(s):
    return re.sub(r"\{\{(\w+)\}\}", lambda m: VARS[m.group(1)], s)

HEADER = """<a class="skip" href="#contenu">Aller au contenu</a>
<div class="topbar"><div class="wrap topbar__in">
  <p class="topbar__msg"><a href="offrir-des-repas.html"><b>Noël</b> : offrez des repas à vos parents</a></p>
  <div class="topbar__tools">
    <div class="textsize" role="group" aria-label="Taille du texte"><span class="textsize__l">Texte</span><button type="button" data-size="1" aria-pressed="true" aria-label="Texte normal">A</button><button type="button" data-size="2" aria-pressed="false" aria-label="Texte plus grand">A+</button></div>
    <a class="acct-link" href="mon-compte.html"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4"/></svg><span>Mon espace</span></a>
    <a class="tel" href="tel:{{telHref}}">""" + icon("telephone") + """<span>{{tel}}</span></a>
  </div>
</div></div>
<header class="top"><div class="wrap top__in">
  <a class="brand" href="./"><img src="img/logo-compacte.svg" alt="Resto Pickup, retour à l'accueil" width="260" height="64"></a>
  <nav class="top__nav" aria-label="Navigation principale"><a href="./#carton">Comment ça marche</a><a href="./#menu">Le menu</a><a href="./#composer">Prix et commande</a><a href="./#proches">Pour un parent</a><a href="./#zones">Où livrons-nous</a><a href="./#questions">Questions</a></nav>
  <a class="btn btn--main top__cta" href="./#composer">Commander</a><a class="top__call" href="tel:{{telHref}}" aria-label="Appeler le {{tel}}">""" + icon("telephone") + """</a>
</div></header>
<main id="contenu">"""

RAPPEL = """
<dialog class="sheet" id="rappel" aria-labelledby="rappel-t">
  <form class="sheet__in" data-contact="rappel" novalidate>
    <button type="button" class="sheet__x" data-close aria-label="Fermer">×</button>
    <div data-form-body>
      <p class="eyebrow">Commander par téléphone</p>
      <h2 id="rappel-t">On vous rappelle.</h2>
      <p class="sheet__lead">Laissez votre nom et votre numéro. Nous vous rappelons, nous faisons la commande avec vous, puis nous envoyons le lien de paiement par SMS, à vous ou à votre enfant.</p>
      <div class="field"><label for="r-nom">Votre nom</label><input id="r-nom" name="nom" autocomplete="name" required></div>
      <div class="field"><label for="r-tel">Votre téléphone</label><input id="r-tel" name="tel" type="tel" inputmode="tel" autocomplete="tel" required><p class="err" data-err></p></div>
      <span class="qlabel">C'est pour</span>
      <div class="rseg" role="radiogroup"><label><input type="radio" name="pour" value="moi" checked><span>Moi</span></label><label><input type="radio" name="pour" value="parent"><span>Un parent</span></label></div>
      <span class="qlabel">Quand vous rappeler ?</span>
      <div class="rseg rseg--3" role="radiogroup"><label><input type="radio" name="creneau" value="matin"><span>Le matin</span></label><label><input type="radio" name="creneau" value="aprem"><span>L'après-midi</span></label><label><input type="radio" name="creneau" value="" checked><span>Peu importe</span></label></div>
      <input type="hidden" name="type" value="rappel"><input class="hp" name="site_web" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button type="submit" class="btn btn--main btn--lg sheet__go">Être rappelé</button>
      <p class="sheet__alt">Vous préférez appeler ? <a href="tel:""" + D["telHref"] + """"><b>""" + D["tel"] + """</b></a>, du lundi au vendredi.</p>
      <p class="sheet__rgpd">Votre numéro sert uniquement à vous rappeler. <a href="politique-confidentialite.html">Vos données</a></p>
    </div>
    <div class="sheet__ok" data-ok hidden>
      <img src="img/assiette.svg" alt="" width="88" height="88">
      <h2>C'est noté.</h2>
      <p data-ok-msg>Nous vous rappelons très vite, du lundi au vendredi.</p>
      <button type="button" class="btn btn--ghost" data-close>Fermer</button>
    </div>
  </form>
</dialog>"""

_NB = "\u202f"
def frtypo(html):
    out, i = [], 0
    for m in re.finditer(r"<(script|style|textarea|pre)\b.*?</\1>|<[^>]+>", html, re.S | re.I):
        out.append(_frtext(html[i:m.start()])); out.append(m.group(0)); i = m.end()
    out.append(_frtext(html[i:]))
    return "".join(out)
def _frtext(t):
    if not t.strip(): return t
    t = re.sub(r"[ \u00a0]+([?!;])", _NB + r"\1", t)
    t = re.sub(r"(?<=[\w\)»%€]) +:(?=\s|$|<)", "\u00a0:", t)
    t = re.sub(r"« +", "«" + _NB, t); t = re.sub(r" +»", _NB + "»", t)
    return t

def footer(slug=""):
    L = D["legal"]
    zl = "".join(f'<li><a class="fz" href="{z["page"]}"><img src="img/jour-{z["jour"]}.svg" alt="" width="36" height="36"><span><b>{E(z["nom"])}</b>Livré le {z["jourNom"]}</span></a></li>' for z in D["zones"])
    days = "".join(f'<img src="img/jour-{i}.svg" alt="" width="44" height="44">' for i in range(1, 8))
    return f"""</main>
<footer class="foot">
  <div class="foot__days" aria-hidden="true">{days}</div>
  <div class="wrap">
    <div class="foot__hero"{' hidden' if slug in ("commander.html", "mon-compte.html", "equipe.html") else ''}>
      <div><p class="foot__big">À table, <span>chez vous.</span></p><p class="foot__sub">Tous vos repas de la semaine, livrés en une fois. Plat et dessert, {eur(P)} le repas.</p></div>
      <div class="foot__call">
        <p>Une personne vous répond, du lundi au vendredi</p>
        <a class="foot__tel" href="tel:{D['telHref']}">{icon("telephone")}{E(D['tel'])}</a>
        <button type="button" class="btn btn--line-on" data-rappel>Être rappelé</button>
        <a class="btn btn--on btn--lg" href="./#composer">Composer ma semaine</a>
      </div>
    </div>
    <div class="foot__grid">
      <div><img class="foot__logo" src="img/logo-blanc.svg" alt="Resto Pickup" width="170" height="106"><p>Livraison hebdomadaire de repas complets de qualité traiteur, à domicile, en Sarthe, en Mayenne et dans l'Orne. Pour vous, ou pour un parent.</p></div>
      <div><h2>Nous livrons</h2><ul class="foot__zones">{zl}</ul></div>
      <div><h2>Pratique</h2><ul><li><a href="./#menu">Le menu de la semaine</a></li><li><a href="./#carton">Comment ça marche</a></li><li><a href="repas-domicile-parent-age.html">Commander pour un parent</a></li><li><a href="offrir-des-repas.html">Offrir des repas</a></li><li><a href="professionnels-partenaires.html">Professionnels et partenaires</a></li><li><a href="communes-livrees.html">Toutes les communes livrées</a></li><li><a href="guides.html">Guides pratiques</a></li><li><a href="./#questions">Questions fréquentes</a></li></ul></div>
      <div><h2>Votre compte</h2><ul><li><a href="mon-compte.html">Mon espace client</a></li><li><a href="mon-compte.html">Signaler une absence</a></li><li><a href="mon-compte.html">Mes factures</a></li><li>E-mail : {E(D['email'])}</li></ul></div>
    </div>
    <div class="foot__base">
      <div class="foot__pay" aria-label="Paiement sécurisé">{icon("cadenas")}<span>Paiement sécurisé par Stripe</span><i>CB</i><i>Visa</i><i>Mastercard</i><i>Apple Pay</i><i>Google Pay</i><i>Prélèvement</i></div>
      <p class="legal">© 2026 {E(L['nomCommercial'])}, marque de {E(L['raison'])}, {E(L['forme'])} au capital de {E(L['capital'])}, {E(L['rcs'])}. <a href="mentions-legales.html">Mentions légales</a> · <a href="politique-confidentialite.html">Vos données</a> · <a href="conditions-generales.html">Conditions générales de vente</a></p>
    </div>
  </div>
</footer>""" + RAPPEL

ORG = {
    "@type": "LocalBusiness", "@id": D["site"] + "/#entreprise", "name": "Resto Pickup",
    "legalName": D["legal"]["raison"], "url": D["site"] + "/", "telephone": D["tel"], "email": D["email"],
    "vatID": D["legal"]["tva"], "priceRange": "€",
    "description": "Livraison hebdomadaire à domicile de repas de qualité traiteur (plat et dessert), pour les personnes âgées et leurs proches, en Sarthe, en Mayenne et dans l'Orne.",
    "address": {"@type": "PostalAddress", "streetAddress": "1 B rue Pierre et Marie Curie", "postalCode": "92140", "addressLocality": "Clamart", "addressCountry": "FR"},
    "areaServed": [{"@type": "City", "name": n} for n in sorted({c[0] for z in D["zones"] for c in z["communes"]})],
    "sameAs": ["https://www.facebook.com/restopickupfr/"],
}
SERVICE = {
    "@type": "Service", "@id": D["site"] + "/#service", "name": "Portage de repas à domicile en abonnement hebdomadaire",
    "serviceType": "Livraison de repas à domicile", "provider": {"@id": D["site"] + "/#entreprise"},
    "audience": {"@type": "PeopleAudience", "suggestedMinAge": 65},
    "areaServed": [{"@type": "City", "name": n} for n in ("Le Mans", "Laval", "Alençon", "Sablé-sur-Sarthe", "Loué", "Mayenne", "Évron", "Château-Gontier-sur-Mayenne")]
                  + [{"@type": "AdministrativeArea", "name": n} for n in ("Sarthe", "Mayenne", "Orne")],
    "offers": [
        {"@type": "Offer", "name": "Repas livré à domicile (plat et dessert), à l'unité dans un abonnement hebdomadaire", "price": f"{P:.2f}", "priceCurrency": "EUR",
         "priceSpecification": {"@type": "UnitPriceSpecification", "price": f"{P:.2f}", "priceCurrency": "EUR", "unitText": "repas livré"},
         "description": "Le client choisit le midi, le soir ou les deux, et de 2 à 7 jours par semaine, par exemple un jour sur deux."},
    ],
}

def crumbs_ld(items):
    return {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": D["site"] + "/" + u} for i, (n, u) in enumerate(items)]}

def crumbs_html(items):
    parts = [f'<a href="{u or "./"}">{E(n)}</a>' for n, u in items[:-1]] + [E(items[-1][0])]
    return '<nav class="crumbs wrap" aria-label="Fil d\'Ariane">' + " › ".join(parts) + "</nav>"

# ---------- Pages par commune (SEO local : l'aidant cherche la commune de son parent) ----------
import unicodedata
DEPT = {"72": "Sarthe", "53": "Mayenne", "61": "Orne"}
HUBS = {"Le Mans": "portage-repas-le-mans.html", "Loué": "portage-repas-loue.html", "Laval": "portage-repas-laval-alencon.html"}
BIG = {"Le Mans": "72181", "Laval": "53130", "Alençon": "61001", "Sablé-sur-Sarthe": "72264", "Mayenne": "53147", "Château-Gontier-sur-Mayenne": "53062", "Évron": "53097"}
CENT = {}
for _c in GEO["communes"]:
    _pts = [p for r in _c["r"][:1] for p in r]
    if _pts: CENT[_c.get("c")] = (sum(p[0] for p in _pts) / len(_pts), sum(p[1] for p in _pts) / len(_pts))
def km(a, b):
    k = math.cos(math.radians((a[1] + b[1]) / 2)); return math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * 111.2
def slugify(s):
    s = unicodedata.normalize("NFKD", s.replace("œ", "oe").replace("Œ", "oe")).encode("ascii", "ignore").decode().lower()
    return "-".join(w for w in "".join(ch if ch.isalnum() else " " for ch in s).split())
COMMUNES = {}
for z in D["zones"]:
    for n, cp, code in z["communes"]:
        c = COMMUNES.setdefault(code, {"nom": n, "cps": [], "zone": z, "code": code, "dept": code[:2]})
        if cp not in c["cps"]: c["cps"].append(cp)
_names = {}
for c in COMMUNES.values(): _names[c["nom"]] = _names.get(c["nom"], 0) + 1
for c in COMMUNES.values():
    c["page"] = HUBS.get(c["nom"]) if c["dept"] in ("72", "53") and c["nom"] in HUBS else "repas-domicile-" + slugify(c["nom"]) + ("-" + c["dept"] if _names[c["nom"]] > 1 else "") + ".html"
    c["xy"] = CENT.get(c["code"])
def neighbours(c, k=8):
    if not c["xy"]: return []
    o = [x for x in COMMUNES.values() if x is not c and x["xy"]]
    return sorted(o, key=lambda x: km(c["xy"], x["xy"]))[:k]
def nearest_big(c):
    if not c["xy"]: return None
    best = None
    for n, code in BIG.items():
        if n == c["nom"] or code not in CENT: continue
        d = km(c["xy"], CENT[code])
        if best is None or d < best[1]: best = (n, d)
    return best
def cmd_link(c):
    from urllib.parse import quote
    # lien unique vers commander.html : la commune passe par data-*, pas par l'URL (évite 400 URL non indexables à crawler)
    return f"commander.html\" data-cp=\"{c['cps'][0]}\" data-commune=\"{E(c['nom'])}"

def guides_block(titre="Nos guides pour les proches"):
    gs = load_guides()[:3]
    if not gs: return ""
    li = "".join(f'<li><a href="{g["slug"]}">{E(g["h1"])}</a></li>' for g in gs)
    return f'<h2>{titre}</h2><ul>{li}</ul><p><a href="guides.html">Tous les guides pratiques</a></p>'

def a_(n):
    "Préposition « à » contractée : au Mans, aux Mées, à Laval"
    if n.startswith("Le "): return "au " + n[3:]
    if n.startswith("Les "): return "aux " + n[4:]
    return "à " + n

def commune_page(c):
    z, n, dep = c["zone"], c["nom"], DEPT.get(c["dept"], "")
    cps = ", ".join(sorted(c["cps"]))
    nb = neighbours(c)
    big = nearest_big(c)
    loc = f"à {round(big[1])} km de {big[0]}" if big and big[1] >= 3 and n not in BIG else ""
    veille = ["", "vendredi", "samedi", "dimanche", "lundi", "mardi", "mercredi", "jeudi"][(z["jour"] - D["delaiCommandeJours"] - 1) % 7 + 1]
    faq = [
        (f"Livrez-vous des repas à domicile {a_(n)} ?", f"Oui. Resto Pickup livre {n} ({cps}, {dep}) chaque {z['jourNom']}, en camion réfrigéré. Tous les repas de la semaine sont remis en main propre en une seule fois."),
        (f"Combien coûte le portage de repas {a_(n)} ?", f"{eur(P)} le repas, plat et dessert. La livraison coûte {eur(LPR)} par repas, avec un minimum de {eur(LMIN)} et jamais plus de {eur(LMAX)} par semaine. Par exemple, 5 soirs par semaine reviennent à {eur(tot(5))}, livraison comprise."),
        (f"J'habite loin, puis-je commander pour mon parent {a_(n)} ?", f"Oui, c'est le cas de beaucoup de nos clients. Vous commandez et payez en ligne ou par téléphone depuis n'importe où en France, les repas sont livrés chez votre parent {a_(n)}, et les factures arrivent chez vous. Si personne n'ouvre, le livreur appelle votre parent, puis vous."),
        (f"Quand commander pour une livraison {a_(n)} ?", f"Au plus tard {D['delaiCommandeJours']} jours avant le {z['jourNom']}, soit le {veille} précédent. Ensuite, la livraison a lieu chaque {z['jourNom']} sans rien refaire."),
    ]
    near = "".join(f'<li><a href="{x["page"]}">{E(x["nom"])}</a> <small>{round(km(c["xy"], x["xy"]))} km</small></li>' for x in nb)
    day = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"][z["jour"]]
    body = f"""{crumbs_html([("Accueil", ""), (z["nom"], z["page"]), (n, c["page"])])}
<section class="section cm-hero" style="padding-top:1.5rem"><div class="wrap split">
  <div class="stack">
    <p class="eyebrow">{E(dep)} · {E(cps)}{(" · " + E(loc)) if loc else ""}</p>
    <h1>Portage de repas à domicile {E(a_(n))}</h1>
    <p class="lead">Chaque {day}, notre camion réfrigéré passe {E(a_(n))} et remet en main propre tous les repas de la semaine : un plat et son dessert, à réchauffer en quelques minutes au micro-ondes. Pour vous, ou pour votre père ou votre mère.</p>
    <div class="row"><a class="btn btn--main btn--lg" href="{cmd_link(c)}">Commander pour {E(n)}</a><button type="button" class="btn btn--ghost btn--lg" data-rappel="parent">On vous rappelle</button></div>
  </div>
  <ul class="cm-facts">
    <li><span>Jour de livraison</span><b>le {day}</b></li>
    <li><span>Prochaine livraison possible</span><b data-next-jour="{z['jour']}">le {day}</b></li>
    <li><span>Le repas, plat et dessert</span><b>{eur(P)}</b></li>
    <li><span>Livraison</span><b>{eur(LMAX)} max. par semaine</b></li>
  </ul>
</div></section>
<section class="section section--sunk"><div class="wrap cm-grid">
  <div class="prose">
    <h2>Votre parent vit {E(a_(n))}, vous non ?</h2>
    <p>Vous habitez à Paris, Nantes, Lyon, Marseille ou à l'étranger, et vous voulez que votre parent mange bien chez lui, {E(a_(n))}. Vous commandez en ligne ou au {E(D['tel'])}, vous payez à distance, et nous livrons. Les factures arrivent chez vous, le menu de la semaine aussi.</p>
    <p>Le livreur sonne et remet le carton en main propre, jamais devant la porte. Il range les repas au frigo si on le lui demande. Si personne n'ouvre, il appelle votre parent, puis vous.</p>
    <h2>Ce qui est livré {E(a_(n))}</h2>
    <ul><li><b>Vous choisissez</b> le midi, le soir ou les deux, de 2 à 7 jours par semaine, ou un jour sur deux.</li><li><b>Une barquette par repas</b>, avec le jour écrit dessus.</li><li><b>Sans engagement</b> : pause pendant une hospitalisation, arrêt d'un simple appel.</li></ul>
    <p>Exemple : 5 soirs par semaine, {eur(tot(5))} livraison comprise. <a href="./#menu">Voir le menu de la semaine</a>.</p>
    {guides_block()}
  </div>
  <aside class="cm-near"><h2>Communes voisines livrées</h2><ul>{near}</ul><p><a href="communes-livrees.html">Toutes les communes livrées</a></p></aside>
</div></section>
<section class="section"><div class="wrap prose">
  <h2>Questions sur la livraison {E(a_(n))}</h2>
  <div class="faq" style="margin-top:0">{faq_html(faq)}</div>
</div></section>
<section class="section"><div class="wrap"><div class="callout"><div><h2>Commander pour {E(n)}</h2><p>Une personne vous répond du lundi au vendredi.</p></div><a class="big-tel" href="tel:{D['telHref']}">{E(D['tel'])}</a></div></div></section>"""
    title = f"Portage de repas à domicile {a_(n)} ({c['cps'][0]}) | Resto Pickup"
    if len(title) > 62: title = f"Portage de repas {a_(n)} ({c['cps'][0]}) | Resto Pickup"
    desc = f"Repas livrés à domicile {a_(n)} ({dep}) chaque {day} : plat et dessert de qualité traiteur, {eur(P)} le repas, livraison {eur(LMAX)} max. par semaine. Idéal pour un parent âgé, commande possible à distance."
    svc = {"@type": "Service", "name": f"Portage de repas à domicile {a_(n)}", "serviceType": "Livraison de repas à domicile", "provider": {"@id": D["site"] + "/#entreprise"},
           "areaServed": {"@type": "City", "name": n, "address": {"@type": "PostalAddress", "postalCode": c["cps"][0], "addressRegion": dep, "addressCountry": "FR"}},
           "offers": {"@type": "Offer", "price": f"{P:.2f}", "priceCurrency": "EUR", "description": "Repas (plat et dessert), livraison en sus plafonnée à 15 € par semaine"}}
    ld = [ORG, svc, faq_ld(faq), crumbs_ld([("Accueil", ""), (z["nom"], z["page"]), (n, c["page"])])]
    return c["page"], title, desc, body, ld

def communes_index_page():
    parts = []
    for dcode in ("72", "53", "61"):
        cs = sorted([c for c in COMMUNES.values() if c["dept"] == dcode], key=lambda c: slugify(c["nom"]))
        if not cs: continue
        items = "".join(f'<li><a href="{c["page"]}">{E(c["nom"])}</a> <small>{c["zone"]["jourNom"]}</small></li>' for c in cs)
        parts.append(f'<h2>{DEPT[dcode]} <small>({len(cs)} communes)</small></h2><ul class="towns-grid towns-grid--links">{items}</ul>')
    body = f"""{crumbs_html([("Accueil", ""), ("Communes livrées", "communes-livrees.html")])}
<section class="section" style="padding-top:1.5rem"><div class="wrap prose" style="max-width:none">
  <p class="eyebrow">Sarthe, Mayenne, Orne</p>
  <h1>Toutes les communes où nous livrons des repas à domicile</h1>
  <p class="lead">{len(COMMUNES)} communes livrées chaque semaine : le mardi autour du Mans, le jeudi autour de Loué, Sablé, Laval, Évron et Alençon. Cliquez sur une commune pour voir son jour de livraison et commander.</p>
  {"".join(parts)}
</div></section>"""
    return "communes-livrees.html", "Communes livrées : portage de repas en Sarthe, Mayenne et Orne | Resto Pickup", f"Liste des {len(COMMUNES)} communes livrées par Resto Pickup en Sarthe, Mayenne et Orne, avec le jour de livraison de chacune.", body, [ORG, crumbs_ld([("Accueil", ""), ("Communes livrées", "communes-livrees.html")])]

def zone_page(z):
    first = [c[0] for c in z["communes"]][0]
    names = sorted({c[0] for c in z["communes"]})
    faq = [
        (f"Livrez-vous les repas à domicile {a_(first)} ?", f"Oui. Nous livrons {first} et {len(names)-1} communes autour chaque {z['jourNom']}, en camion réfrigéré, avec tous les repas de la semaine."),
        (f"Quel est le prix du portage de repas {a_(first)} ?", f"{eur(P)} le repas, plat et dessert, plus la livraison : {eur(LPR)} par repas, plafonnée à {eur(LMAX)} par semaine. Vous choisissez le nombre de repas par semaine, midi, soir ou les deux."),
        (f"Jusqu'à quand commander pour être livré ce {z['jourNom']} ?", f"Commandez au moins {D['delaiCommandeJours']} jours avant le {z['jourNom']}. Au-delà, la première livraison a lieu le {z['jourNom']} suivant."),
    ]
    bigs = [c for c in COMMUNES.values() if c["zone"] is z and c["nom"] in BIG and c["nom"] != first]
    if bigs:
        lst = ", ".join(c["nom"] for c in bigs[:-1]) + (" et " if len(bigs) > 1 else "") + bigs[-1]["nom"]
        faq.insert(1, (f"Livrez-vous aussi {lst} ?", f"Oui. {lst} {'sont livrées' if len(bigs) > 1 else 'est livrée'} chaque {z['jourNom']}, avec les communes autour. Chaque commune a sa page avec son jour de livraison et le lien pour commander."))
    biglinks = " · ".join(f'<a href="{c["page"]}">{E(c["nom"])}</a>' for c in bigs)
    body = f"""{crumbs_html([("Accueil", ""), (z["nom"], z["page"])])}
<section class="section" style="padding-top:1.5rem"><div class="wrap split">
  <div class="stack">
    <p class="eyebrow">Livraison chaque {z['jourNom']}</p>
    <h1>Portage de repas à domicile : {E(z['nom'])}</h1>
    <p class="lead">Chaque {z['jourNom']}, nous livrons {E(a_(first))} et dans les communes voisines tous les repas de la semaine : plat et dessert de qualité traiteur, prêts à réchauffer au micro-ondes, pour {eur(P)} le repas, et une livraison plafonnée à {eur(LMAX)} par semaine.</p>
    <div class="row"><a class="btn btn--main" href="commander.html#f-soir-1">Commander</a><button type="button" class="btn btn--ghost" data-rappel="parent">On vous rappelle</button></div>
  </div>
  <form class="zone" novalidate style="margin-top:0">
    <label for="zone-cp-{z['id']}">Vérifiez votre adresse</label>
    <div class="zone__row"><input id="zone-cp-{z['id']}" inputmode="numeric" maxlength="5" placeholder="Code postal" autocomplete="postal-code"><button class="btn btn--main" type="submit">Vérifier</button></div>
    <div class="zone__out" aria-live="polite"></div>
  </form>
</div></section>
<section class="section section--sunk"><div class="wrap prose" style="max-width:none">
  <h2>Les communes livrées le {z['jourNom']}</h2>
  {f'<p>Villes principales : {biglinks}.</p>' if bigs else ''}
  {towns(z)}
</div></section>
<section class="section"><div class="wrap prose">
  <h2>Comment se passe la livraison</h2>
  <p>Notre camion réfrigéré passe une fois par semaine, le {z['jourNom']}. Le livreur sonne, remet les repas en main propre et, si vous le souhaitez, les range au réfrigérateur. Chaque barquette porte le jour, le service (midi ou soir) et sa date limite.</p>
  <h2>Des repas à la carte</h2>
  <ul><li><b>Vous choisissez vos repas</b> : le midi, le soir ou les deux.</li><li><b>Vous choisissez vos jours</b> : de 2 à 7 jours par semaine, ou un jour sur deux.</li><li><b>Un seul prix</b> : {eur(P)} le repas, plat et dessert, plus la livraison ({eur(LPR)} par repas, jamais plus de {eur(LMAX)} par semaine). Par exemple, 5 soirs par semaine : {eur(tot(5))} livraison comprise.</li></ul>
  <p>Sans engagement : pause ou arrêt par téléphone avant le samedi pour la semaine suivante. Voir <a href="./#menu">le menu de la semaine</a>.</p>
  {guides_block("Guides pour bien choisir")}
  <h2>Questions sur {E(first)}</h2>
  <div class="faq" style="margin-top:0">{faq_html(faq)}</div>
</div></section>
<section class="section"><div class="wrap"><div class="callout"><div><h2>Commander par téléphone</h2><p>Du lundi au vendredi.</p></div><a class="big-tel" href="tel:{D['telHref']}">{E(D['tel'])}</a></div></div></section>"""
    title = f"Portage de repas à domicile : {z['nom']} | Resto Pickup"
    desc = f"Livraison de repas à domicile {a_(first)} et {len(names)-1} communes autour, chaque {z['jourNom']}. Plat et dessert de qualité traiteur, {eur(P)} le repas, livraison plafonnée à {eur(LMAX)} par semaine. Sans engagement."
    svc = {"@type": "Service", "name": f"Portage de repas à domicile : {z['nom']}", "serviceType": "Livraison de repas à domicile", "provider": {"@id": D["site"] + "/#entreprise"},
           "areaServed": [{"@type": "City", "name": n} for n in names],
           "offers": {"@type": "Offer", "price": f"{P:.2f}", "priceCurrency": "EUR", "description": "Repas (plat et dessert), livraison en sus plafonnée à 15 € par semaine"}}
    ld = [ORG, svc, faq_ld(faq), crumbs_ld([("Accueil", ""), (z["nom"], z["page"])])]
    return z["page"], title, desc, body, ld

PARENT_FAQ = [
    ("Comment faire livrer des repas à un parent âgé qui vit loin ?", "Commandez en choisissant « Pour un proche » : vous indiquez l'adresse de votre parent et vos propres coordonnées pour le paiement et les factures. Nous livrons chez lui une fois par semaine."),
    ("Mon parent doit-il savoir utiliser internet ?", "Non. Tout se règle par vous en ligne, ou par téléphone. Votre parent ouvre simplement la porte au livreur une fois par semaine."),
    ("Que se passe-t-il si mon parent n'ouvre pas ?", "Le livreur appelle votre parent, puis vous. Les repas ne sont jamais laissés devant la porte."),
    ("Mon parent peut-il manger à l'heure qu'il veut ?", "Oui. Les repas sont livrés pour la semaine et se réchauffent au micro-ondes quand il le souhaite, à la différence d'un portage quotidien à heure fixe."),
]

def parent_page():
    body = f"""{crumbs_html([("Accueil", ""), ("Pour un parent âgé", "repas-domicile-parent-age.html")])}
<section class="section" style="padding-top:1.5rem"><div class="wrap prose">
  <p class="eyebrow">Pour les enfants et les aidants</p>
  <h1>Faire livrer les repas de votre parent âgé, sans y aller vous-même</h1>
  <p class="lead">Vous habitez loin, vous travaillez, et vous voulez que votre père ou votre mère mange bien chez lui. Resto Pickup livre une fois par semaine tous ses repas, en main propre, en Sarthe, en Mayenne et dans l'Orne. Vous gérez tout à distance.</p>
  <div class="row"><a class="btn btn--main" href="commander.html#f-soir-1-proche">Commander pour un proche</a><a class="btn btn--ghost" href="tel:{D['telHref']}">Appeler le {E(D['tel'])}</a></div>
  <h2>Ce que vous gérez, ce que nous faisons</h2>
  <ul>
    <li><b>Vous</b> : vous choisissez la formule, vous payez chaque semaine par carte ou prélèvement, vous recevez les factures par e-mail, vous mettez en pause pendant une hospitalisation ou des vacances.</li>
    <li><b>Nous</b> : nous livrons chez votre parent en camion réfrigéré, nous remettons les repas en main propre, nous les rangeons au réfrigérateur s'il le souhaite, nous vous appelons si personne n'ouvre.</li>
    <li><b>Votre parent</b> : il réchauffe au micro-ondes le repas du jour, à l'heure qui lui convient. Chaque barquette indique le jour et le service.</li>
  </ul>
  <h2>Pourquoi une livraison par semaine plutôt que chaque jour</h2>
  <p>Le portage quotidien impose une heure de passage. Avec une livraison par semaine, votre parent garde son rythme, voit un livreur qui prend le temps, et choisit le nombre de repas dont il a besoin. Chaque repas comprend un plat et son dessert, pour {eur(P)} livraison comprise.</p>
  <h2>Questions des proches</h2>
  <div class="faq" style="margin-top:0">{faq_html(PARENT_FAQ)}</div>
</div></section>
<section class="section section--sunk"><div class="wrap prose">
  <h2>Vous habitez loin de votre parent ?</h2>
  <p>C'est la situation de la plupart des familles qui nous appellent : un fils à Paris, une fille à Marseille ou à Lyon, et un parent qui vit seul à Brûlon, à Évron ou à Sillé-le-Guillaume. Vous gérez tout à distance : la commande, le paiement, les absences et les changements, en ligne ou par téléphone. Votre parent n'a qu'à ouvrir la porte une fois par semaine.</p>
  <ul><li><b>Vous recevez</b> les factures, le menu de la semaine et un appel si personne n'ouvre.</li><li><b>Votre parent reçoit</b> ses repas en main propre, rangés au frigo s'il le souhaite.</li><li><b>Vous gardez la main</b> : pause pendant une hospitalisation, arrêt d'un appel.</li></ul>
  <p>Des aides peuvent exister pour le portage de repas, selon la situation de votre parent. Le CCAS de sa commune ou le service autonomie du Département vous diront à quoi il a droit. Voir aussi <a href="https://www.pour-les-personnes-agees.gouv.fr" rel="noopener">pour-les-personnes-agees.gouv.fr</a>.</p>
  <p><a href="communes-livrees.html">Vérifiez que la commune de votre parent est livrée</a>. Pour aller plus loin : <a href="guide-organiser-repas-parent-age-a-distance.html">organiser les repas d'un parent âgé à distance</a> et <a href="guide-prix-portage-repas-domicile.html">le vrai prix du portage de repas</a>.</p>
</div></section>
<section class="section"><div class="wrap"><div class="callout"><div><h2>On en parle de vive voix ?</h2><p>Nous répondons aux familles du lundi au vendredi. Vous pouvez aussi <button type="button" class="linkbtn linkbtn--on" data-rappel="parent">demander à être rappelé</button>.</p></div><a class="big-tel" href="tel:{D['telHref']}">{E(D['tel'])}</a></div></div></section>"""
    title = "Repas à domicile pour un parent âgé, commandés à distance | Resto Pickup"
    desc = f"Faites livrer chaque semaine les repas de votre parent âgé en Sarthe, en Mayenne et dans l'Orne. Vous payez et gérez à distance, il reçoit en main propre. {eur(P)} le repas."
    return "repas-domicile-parent-age.html", title, desc, body, [ORG, faq_ld(PARENT_FAQ), crumbs_ld([("Accueil", ""), ("Pour un parent âgé", "repas-domicile-parent-age.html")])]

def commander_page():
    body = open(os.path.join(ROOT, "pages", "commander.html"), encoding="utf-8").read()
    return "commander.html", "Commander vos repas à domicile | Resto Pickup", "Commandez en 3 étapes vos repas livrés à domicile en Sarthe, en Mayenne et dans l'Orne.", body, [ORG]

def compte_page():
    body = open(os.path.join(ROOT, "pages", "mon-compte.html"), encoding="utf-8").read()
    return "mon-compte.html", "Mon espace | Resto Pickup", "Espace client Resto Pickup : prochaine livraison, absence, formule, factures.", body, [ORG]

def legal_page():
    L = D["legal"]
    body = f"""{crumbs_html([("Accueil", ""), ("Mentions légales", "mentions-legales.html")])}
<section class="section" style="padding-top:1.5rem"><div class="wrap prose">
  <h1>Mentions légales</h1>
  <h2>Éditeur du site</h2>
  <p>{E(L['raison'])}, nom commercial {E(L['nomCommercial'])}<br>{E(L['forme'])} au capital de {E(L['capital'])}<br>Siège social : {E(L['siege'])}<br>{E(L['rcs'])}, SIRET {E(L['siret'])}<br>TVA intracommunautaire : {E(L['tva'])}<br>Téléphone : {E(D['tel'])}, e-mail : {E(D['email'])}</p>
  <p>Directeur de la publication : {E(L['directeur'])}</p>
  <h2>Hébergement</h2>
  <p>{E(L['hebergeur'])}</p>
  <h2>Données personnelles</h2>
  <p>Le traitement de vos données est décrit dans notre <a href="politique-confidentialite.html">politique de confidentialité</a> : ce que nous collectons, pourquoi, combien de temps, et comment exercer vos droits.</p>
  <h2>Cookies</h2>
  <p>Ce site ne dépose aucun cookie publicitaire ni de mesure d'audience. Seul est utilisé le stockage technique nécessaire à son fonctionnement (session de votre espace client, taille du texte choisie), qui ne nécessite pas de consentement.</p>
  <h2>Propriété intellectuelle</h2>
  <p>Les textes, illustrations, logos et la charte graphique du site sont la propriété de {E(L['raison'])}. Toute reproduction sans autorisation est interdite.</p>
</div></section>"""
    return "mentions-legales.html", "Mentions légales | Resto Pickup", "Mentions légales du site Resto Pickup, édité par R L C RL CONCEPT.", body, [ORG]

def cgv_page():
    L = D["legal"]
    body = f"""{crumbs_html([("Accueil", ""), ("Conditions générales de vente", "conditions-generales.html")])}
<section class="section" style="padding-top:1.5rem"><div class="wrap prose">
  <h1>Conditions générales de vente</h1>
  <p>En vigueur au {datetime.date.today().strftime("%d/%m/%Y")}.</p>
  <h2>1. Qui sommes-nous</h2><p>Resto Pickup est une marque de {E(L['raison'])}, {E(L['forme'])} au capital de {E(L['capital'])}, siège social {E(L['siege'])}, {E(L['rcs'])}, TVA {E(L['tva'])}. Contact : {E(D['tel'])}, {E(D['email'])}.</p>
  <h2>2. Le service</h2><p>Resto Pickup livre à domicile, une fois par semaine, des repas complets (plat et dessert) à conserver au réfrigérateur et à réchauffer, selon un menu unique publié chaque semaine sur le site. Le service est réservé aux communes desservies, listées sur le site, et à des clients majeurs. Les repas ne sont pas adaptés aux régimes médicaux (sans sel, diabétique, texture modifiée).</p>
  <h2>3. La commande</h2><p>Le client choisit le service (midi, soir ou les deux), les jours de la semaine et le nombre de personnes (une ou deux), avec un minimum de {RMIN} repas par semaine. Il peut commander pour lui-même ou pour un proche : la personne qui paie est alors le client, la personne livrée est le destinataire. La commande peut être passée en ligne ou par téléphone ; dans ce cas, un lien de paiement est envoyé par SMS ou par e-mail. Le contrat est conclu à la validation du paiement, confirmée par e-mail.</p>
  <h2>4. Abonnement et semaine d'essai</h2><p>L'abonnement est hebdomadaire, sans durée minimale et sans frais de résiliation. La semaine d'essai est une commande unique, sans abonnement ni reconduction.</p>
  <h2>5. Prix et paiement</h2><p>Le prix est de {eur(P)} TTC par repas complet. La livraison est facturée {eur(LPR)} TTC par repas, avec un minimum de {eur(LMIN)} et un maximum de {eur(LMAX)} par semaine. Le prix applicable est celui affiché au moment de la commande ; toute évolution est annoncée au moins quinze jours à l'avance par e-mail, le client restant libre d'arrêter. Le montant de la semaine est prélevé chaque semaine par carte bancaire ou prélèvement SEPA, par l'intermédiaire de Stripe. Resto Pickup n'a jamais accès aux coordonnées bancaires complètes. Une facture est disponible chaque semaine dans l'espace client.</p>
  <h2>6. Impayés</h2><p>En cas de paiement refusé, le client est prévenu par e-mail et peut régler en ligne ou par téléphone. Les livraisons peuvent être suspendues jusqu'à régularisation.</p>
  <h2>7. Livraison</h2><p>Les repas sont livrés le jour de tournée de la commune, en camion réfrigéré, et remis en main propre au destinataire ou à une personne présente à son domicile. Ils ne sont jamais laissés devant la porte. Si personne n'ouvre, le livreur appelle le destinataire puis le contact indiqué. Si la livraison reste impossible du fait du client (absence non signalée, adresse erronée), les repas ne peuvent être ni conservés ni livrés à nouveau, et la semaine reste due. Le transfert des risques a lieu à la remise des repas.</p>
  <h2>8. Pause, modification et arrêt</h2><p>Le client met en pause, modifie ou arrête son abonnement sans frais, depuis son espace client ou par téléphone, au plus tard le samedi précédant la semaine de livraison concernée. Une pause suspend livraisons et prélèvements. Un arrêt prend effet à la fin de la semaine déjà payée.</p>
  <h2>9. Conservation, allergènes et sécurité alimentaire</h2><p>Les repas se conservent au réfrigérateur, entre 0 et 4 °C, jusqu'à la date limite indiquée sur chaque barquette, et se réchauffent selon les indications de l'étiquette. La liste des ingrédients et des allergènes figure sur chaque barquette ; le client vérifie qu'elle convient au destinataire. Un repas dont la chaîne du froid a été rompue après la livraison ne doit pas être consommé.</p>
  <h2>10. Droit de rétractation</h2><p>Les repas sont des denrées périssables. Conformément à l'article L221-28, 4° du Code de la consommation, le droit de rétractation ne s'applique pas aux biens susceptibles de se détériorer ou de se périmer rapidement. Le client peut en revanche arrêter son abonnement à tout moment, sans frais, dans les conditions de l'article 8.</p>
  <h2>11. Réclamations</h2><p>Un repas manquant, abîmé ou non conforme est signalé dans les 24 heures suivant la livraison, au {E(D['tel'])} ou par message depuis l'espace client, si possible avec une photo. Après vérification, le repas est remplacé ou remboursé.</p>
  <h2>12. Cartes cadeaux</h2><p>La carte cadeau correspond à un nombre de repas, livraison comprise, payé d'avance. Elle est valable un an à compter de l'achat, s'utilise en une ou plusieurs fois dans les communes desservies, en ligne ou par téléphone, et son montant est déduit des commandes de son bénéficiaire. Elle n'est pas remboursable en espèces. Un code perdu peut être retrouvé sur simple demande de l'acheteur.</p>
  <h2>13. Données personnelles</h2><p>Les données nécessaires à la commande sont traitées conformément à notre <a href="politique-confidentialite.html">politique de confidentialité</a>.</p>
  <h2>14. Litiges</h2><p>Toute réclamation est d'abord adressée à Resto Pickup, au {E(D['tel'])} ou à {E(D['email'])}, qui répond sous quinze jours. Les présentes conditions sont soumises au droit français.</p>
</div></section>"""
    return "conditions-generales.html", "Conditions générales de vente | Resto Pickup", "Conditions générales de vente de l'abonnement de repas à domicile Resto Pickup : prix, livraison, pause, arrêt, cartes cadeaux.", body, [ORG]

def privacy_page():
    L = D["legal"]
    body = f"""{crumbs_html([("Accueil", ""), ("Vos données", "politique-confidentialite.html")])}
<section class="section" style="padding-top:1.5rem"><div class="wrap prose">
  <h1>Vos données personnelles</h1>
  <p class="lead">En bref : nous ne gardons que ce qui sert à livrer vos repas, à vous facturer et à vous répondre. Rien n'est vendu, rien n'est utilisé pour de la publicité.</p>
  <h2>Qui est responsable</h2><p>{E(L['raison'])}, {E(L['forme'])}, {E(L['siege'])}, {E(L['rcs'])}, qui exploite la marque Resto Pickup. Pour toute question sur vos données : {E(D['email'])} ou {E(D['tel'])}.</p>
  <h2>Ce que nous collectons, et pourquoi</h2>
  <table class="dtable"><thead><tr><th>Usage</th><th>Données</th><th>Fondement</th><th>Durée de conservation</th></tr></thead><tbody>
  <tr><td>Livrer les repas et gérer l'abonnement</td><td>Nom, adresse, téléphone, e-mail, consignes de livraison, formule, jour de livraison ; si vous commandez pour un proche, ses coordonnées et les vôtres</td><td>Exécution du contrat</td><td>Pendant l'abonnement, puis 3 ans après la dernière commande</td></tr>
  <tr><td>Paiement et facturation</td><td>Montants, factures, moyen de paiement (géré par Stripe : nous ne voyons ni le numéro de carte ni l'IBAN complet)</td><td>Exécution du contrat et obligation légale</td><td>Factures : 10 ans, durée légale de conservation des pièces comptables</td></tr>
  <tr><td>Connexion à l'espace client</td><td>E-mail, code à usage unique</td><td>Exécution du contrat</td><td>Code : 15 minutes ; session : 30 jours sur votre appareil</td></tr>
  <tr><td>Vous répondre</td><td>Messages échangés depuis l'espace client</td><td>Exécution du contrat</td><td>3 ans après le dernier échange</td></tr>
  <tr><td>Vous rappeler, répondre à un professionnel</td><td>Nom, téléphone, commune, créneau ; pour une personne orientée par un professionnel, les coordonnées données avec son accord</td><td>Intérêt légitime à répondre à la demande</td><td>1 an sans commande, puis suppression</td></tr>
  <tr><td>Cartes cadeaux</td><td>Prénoms de l'acheteur et du bénéficiaire, message, e-mail de l'acheteur, code</td><td>Exécution du contrat</td><td>Validité de la carte, puis 3 ans</td></tr>
  <tr><td>Sécurité et bon fonctionnement du site</td><td>Messages d'erreur techniques, type de navigateur</td><td>Intérêt légitime</td><td>30 jours</td></tr>
  </tbody></table>
  <p>Merci de ne pas indiquer d'informations médicales dans les consignes de livraison : seules les indications utiles au livreur sont nécessaires (digicode, étage, sonner longtemps).</p>
  <h2>Qui y a accès</h2><p>L'équipe Resto Pickup et le livreur, pour les seules informations utiles à la livraison. Nos prestataires techniques, qui agissent sur nos instructions : Stripe (paiement), Brevo (envoi des e-mails), Netlify (hébergement du site et des données de l'espace client). Certains sont établis ou ont des serveurs hors de l'Union européenne ; ces transferts sont encadrés par les garanties prévues par le RGPD. Vos données ne sont jamais vendues ni louées.</p>
  <h2>Pas de publicité, pas de pistage</h2><p>Le site n'utilise aucun cookie publicitaire, aucun outil de mesure d'audience et aucun réseau social intégré. Seul un stockage technique est utilisé sur votre appareil (session de l'espace client, taille du texte), ce qui ne demande pas de consentement.</p>
  <h2>Vos droits</h2><p>Vous pouvez à tout moment accéder à vos données, les faire corriger ou supprimer, en limiter l'usage, vous opposer à leur traitement ou en demander une copie. Écrivez à {E(D['email'])} ou appelez le {E(D['tel'])} ; nous répondons sous un mois. Vos factures restent conservées le temps imposé par la loi. Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (cnil.fr).</p>
  <h2>Sécurité</h2><p>Le site est servi en HTTPS, l'espace client fonctionne par code à usage unique, sans mot de passe à retenir, et les paiements sont traités par Stripe, certifié PCI DSS. L'accès à l'espace équipe est réservé à des personnes nommément autorisées.</p>
</div></section>"""
    return "politique-confidentialite.html", "Vos données personnelles | Resto Pickup", "Politique de confidentialité de Resto Pickup : données collectées, finalités, durées de conservation, vos droits.", body, [ORG]

GIFT_FAQ = [
    ("Comment mon proche utilise-t-il la carte ?",
     "Il commande sur le site et saisit son code au moment de payer, ou il nous appelle et nous faisons tout avec lui. Le montant de la carte est déduit de ses repas, semaine après semaine."),
    ("Que se passe-t-il quand la carte est épuisée ?",
     "S'il a choisi une semaine d'essai, rien : la commande s'arrête. S'il a choisi un abonnement, il continue au prix normal, sans engagement, et peut arrêter d'un simple appel. Vous pouvez aussi lui offrir une nouvelle carte."),
    ("Combien de temps la carte est-elle valable ?",
     "Un an à partir de l'achat. La date est écrite sur la carte."),
    ("Mon proche doit-il choisir le même nombre de repas ?",
     "Non. La carte est un montant en repas : il choisit librement le midi, le soir ou les deux, et ses jours. Avec 10 repas, il peut prendre deux semaines de dîners du lundi au vendredi, ou une semaine plus complète."),
    ("Et s'il n'habite pas dans une commune livrée ?",
     "Vérifiez avant d'acheter : nous livrons Le Mans et 30 km autour le mardi ; Loué, Sablé, Laval, Évron, Mayenne et Alençon et leurs alentours le jeudi. En cas d'erreur, appelez-nous, nous trouvons une solution."),
    ("Peut-on commander la carte par téléphone ?",
     "Oui. Demandez à être rappelé, nous préparons la carte avec vous et nous vous envoyons le lien de paiement par SMS ou par e-mail."),
]
PRO_FAQ = [
    ("Est-ce payant pour notre structure ?",
     "Non. Orienter une personne vers nous ne coûte rien et ne vous engage à rien. Seule la personne, ou sa famille, paie ses repas."),
    ("Que se passe-t-il après avoir transmis un contact ?",
     "Nous appelons la personne, nous lui expliquons le service et nous répondons à ses questions. Elle décide seule, ou avec sa famille. Si vous nous avez laissé votre contact, nous vous disons si c'est fait."),
    ("La personne peut-elle commander sans Internet ?",
     "Oui. Tout se fait au téléphone. Le paiement se fait par un lien envoyé par SMS, à elle ou à un enfant qui gère ses papiers. Un proche peut aussi payer à sa place."),
    ("Quelles communes livrez-vous ?",
     "Le Mans et les communes autour, le mardi. Loué, Sablé, Laval, Évron, Mayenne, Château-Gontier et Alençon, avec leurs alentours, le jeudi. La liste complète est sur notre carte."),
    ("Pouvez-vous livrer pour une sortie d'hospitalisation ?",
     "Oui, si la commande arrive au moins 3 jours avant le jour de livraison de la commune. Appelez-nous pour les cas urgents, nous regardons ce qui est possible."),
    ("Nos données et celles de la personne sont-elles protégées ?",
     "Les informations transmises servent uniquement à appeler la personne. Elles ne sont ni vendues, ni réutilisées pour de la publicité. Nous ne transmettons rien sans son accord."),
]

def page_tpl(name):
    return open(os.path.join(ROOT, "pages", name), encoding="utf-8").read()

def gift_page():
    body = crumbs_html([("Accueil", ""), ("Offrir des repas", "offrir-des-repas.html")]) + page_tpl("offrir.html").replace("{{giftfaq}}", faq_html(GIFT_FAQ))
    title = "Carte cadeau repas pour une personne âgée, Le Mans et Loué | Resto Pickup"
    desc = f"Offrez des repas livrés à domicile à vos parents ou grands-parents : carte cadeau Resto Pickup de 3 à 60 repas, plat et dessert, valable un an. {eur(P)} le repas."
    offer = {"@type": "Offer", "priceCurrency": "EUR", "price": f"{P:.2f}", "url": D["site"] + "/offrir-des-repas.html",
             "priceSpecification": {"@type": "UnitPriceSpecification", "price": f"{P:.2f}", "priceCurrency": "EUR", "unitText": "repas offert"}}
    prod = {"@type": "Product", "name": "Carte cadeau repas à domicile Resto Pickup", "brand": {"@type": "Brand", "name": "Resto Pickup"},
            "description": "Carte cadeau en nombre de repas (plat et dessert) livrés à domicile en Sarthe, en Mayenne et dans l'Orne, valable un an.", "offers": offer}
    return "offrir-des-repas.html", title, desc, body, [ORG, prod, faq_ld(GIFT_FAQ), crumbs_ld([("Accueil", ""), ("Offrir des repas", "offrir-des-repas.html")])]

def pro_page():
    body = crumbs_html([("Accueil", ""), ("Professionnels et partenaires", "professionnels-partenaires.html")]) + page_tpl("partenaires.html").replace("{{profaq}}", faq_html(PRO_FAQ))
    title = "Portage de repas : CCAS, soignants, orientez une personne âgée | Resto Pickup"
    desc = "CCAS, infirmiers, pharmacies, assistantes sociales, résidences : orientez une personne âgée vers Resto Pickup en une minute. Repas livrés chaque semaine en Sarthe, en Mayenne et dans l'Orne. Flyer à télécharger."
    return "professionnels-partenaires.html", title, desc, body, [ORG, SERVICE, faq_ld(PRO_FAQ), crumbs_ld([("Accueil", ""), ("Professionnels et partenaires", "professionnels-partenaires.html")])]

def admin_page():
    body = page_tpl("admin.html").replace("{{menuJson}}", json.dumps(D["menu"], ensure_ascii=False).replace("</", "<\\/"))
    return "admin.html", "Espace équipe | Resto Pickup", "Pilotage interne.", body, [ORG]

def equipe_page():
    return "equipe.html", "Équipe : commande par téléphone | Resto Pickup", "Outil interne.", page_tpl("equipe.html"), [ORG]

def index_page():
    body = open(os.path.join(ROOT, "pages", "index.html"), encoding="utf-8").read()
    title = "Portage de repas à domicile : Le Mans, Laval, Alençon | Resto Pickup"
    desc = f"Repas de qualité traiteur livrés une fois par semaine en camion réfrigéré : plat et dessert à {eur(P)}. Le Mans, Sablé, Laval, Alençon et {len(COMMUNES)} communes en Sarthe, Mayenne et Orne. Sans engagement."
    return "index.html", title, desc, body, [ORG, SERVICE, faq_ld(FAQ)]

FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Atkinson+Hyperlegible+Next:wght@400;700&display=swap"><link rel="icon" href="favicon.ico" sizes="any"><link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="apple-touch-icon.png">'


# ---------- Guides (blog) : un fichier src/guides/<slug>.html par article ----------
# 1re ligne : <!--{json}--> avec title, desc, h1, chapo, date, maj, faq [[q,a]], sources [[libellé,url]]
GUIDES_DIR = os.path.join(ROOT, "guides")
def load_guides():
    out = []
    if not os.path.isdir(GUIDES_DIR): return out
    for f in sorted(os.listdir(GUIDES_DIR)):
        if not f.endswith(".html"): continue
        raw = open(os.path.join(GUIDES_DIR, f), encoding="utf-8").read()
        m = re.match(r"\s*<!--(.*?)-->\s*", raw, re.S)
        meta = json.loads(m.group(1)); meta["slug"] = "guide-" + f; meta["body"] = raw[m.end():]
        if meta.get("brouillon"): continue
        out.append(meta)
    return sorted(out, key=lambda g: g["date"], reverse=True)

def fdate(iso):
    y, mo, d = iso.split("-"); M = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"]
    return f"{int(d)} {M[int(mo)-1]} {y}"

def guide_page(g, allg):
    cr = [("Accueil", ""), ("Guides", "guides.html"), (g["h1"], g["slug"])]
    autres = [x for x in allg if x["slug"] != g["slug"]][:3]
    src = "".join(f'<li><a href="{E(u)}" rel="noopener" target="_blank">{E(l)}</a></li>' for l, u in g.get("sources", []))
    faq = [(q, a) for q, a in g.get("faq", [])]
    body = f"""{crumbs_html(cr)}
<article class="section guide" style="padding-top:1.5rem"><div class="wrap prose">
  <p class="eyebrow">Guide · mis à jour le <time datetime="{g.get('maj', g['date'])}">{fdate(g.get('maj', g['date']))}</time></p>
  <h1>{E(g['h1'])}</h1>
  <p class="lead">{g['chapo']}</p>
  {g['body']}
  {('<h2>Questions fréquentes</h2><div class="faq" style="margin-top:0">' + faq_html(faq) + '</div>') if faq else ''}
  {('<h2>Sources</h2><ul class="sources">' + src + '</ul>') if src else ''}
  <p class="guide__by">Rédigé par l'équipe Resto Pickup, livraison de repas à domicile en Sarthe, en Mayenne et dans l'Orne. Une question : <a href="tel:{D['telHref']}">{E(D['tel'])}</a>.</p>
</div></article>
<section class="section section--sunk"><div class="wrap">
  <div class="callout"><div><h2>Des repas de qualité traiteur, livrés une fois par semaine</h2><p>Plat et dessert à {eur(P)}, sans engagement, en Sarthe, en Mayenne et dans l'Orne.</p></div><a class="btn btn--main btn--lg" href="./#composer">Composer la semaine</a></div>
  {('<h2 style="margin-top:2rem">À lire aussi</h2><ul class="guides">' + "".join(guide_card(x) for x in autres) + '</ul>') if autres else ''}
</div></section>"""
    art = {"@type": "Article", "headline": g["h1"], "description": g["desc"], "datePublished": g["date"], "dateModified": g.get("maj", g["date"]),
           "inLanguage": "fr-FR", "mainEntityOfPage": D["site"] + "/" + g["slug"], "author": {"@type": "Organization", "name": "Resto Pickup", "url": D["site"]},
           "publisher": {"@id": D["site"] + "/#entreprise"}}
    if g.get("sources"): art["citation"] = [u for _, u in g["sources"]]
    ld = [ORG, art, crumbs_ld(cr)] + ([faq_ld(faq)] if faq else [])
    return g["slug"], g["title"], g["desc"], body, ld

def guide_card(g):
    return f'<li class="gcard"><a href="{g["slug"]}"><span class="gcard__d">{fdate(g.get("maj", g["date"]))}</span><b>{E(g["h1"])}</b><span>{E(g["desc"])}</span></a></li>'

def guides_index(allg):
    cr = [("Accueil", ""), ("Guides", "guides.html")]
    body = f"""{crumbs_html(cr)}
<section class="section" style="padding-top:1.5rem"><div class="wrap">
  <div class="prose"><p class="eyebrow">Guides pratiques</p><h1>Bien manger chez soi après 70 ans : nos guides</h1>
  <p class="lead">Prix du portage de repas, aides, organisation à distance quand on est aidant : des réponses claires, sourcées, écrites par l'équipe qui livre chaque semaine.</p></div>
  <ul class="guides">{"".join(guide_card(g) for g in allg)}</ul>
</div></section>"""
    items = {"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": D["site"] + "/" + g["slug"], "name": g["h1"]} for i, g in enumerate(allg)]}
    return "guides.html", "Guides : portage de repas, aides et conseils pour les aidants | Resto Pickup", "Prix du portage de repas à domicile, aides possibles, organiser les repas d'un parent à distance : les guides pratiques de Resto Pickup.", body, [ORG, items, crumbs_ld(cr)]

def head_bits(slug, title, desc, ld):
    url = D["site"] + "/" + ("" if slug == "index.html" else slug)
    ldj = json.dumps({"@context": "https://schema.org", "@graph": ld}, ensure_ascii=False)
    return (f'<title>{E(title)}</title>\n<meta name="description" content="{E(desc)}">\n<link rel="canonical" href="{url}">\n'
            f'<meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:site_name" content="Resto Pickup">'
            f'<meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}"><meta property="og:url" content="{url}">\n'
            + ('<meta name="robots" content="noindex, follow">' if slug in ("commander.html", "mon-compte.html", "equipe.html", "admin.html") else '') +
            f'<meta name="theme-color" content="#1B2A4E">\n{FONTS}\n<link rel="stylesheet" href="style.css">\n'
            f'<script type="application/ld+json">{ldj}</script>')

SCRIPTS = '<script src="config.js"></script>\n<script src="contact.js"></script>\n<script src="app.js"></script>\n<script src="week.js"></script>\n<script src="addr.js"></script>\n<script src="menu.js"></script>\n<script src="account.js"></script>\n<script src="zones.js"></script>\n<script src="offrir.js"></script>\n<script src="equipe.js"></script>'

def main():
    os.makedirs(SITE, exist_ok=True); os.makedirs(ART, exist_ok=True)
    GU = load_guides()
    pages = [index_page(), commander_page(), compte_page()] + [zone_page(z) for z in D["zones"]] + [parent_page(), gift_page(), pro_page(), equipe_page(), admin_page(), legal_page(), cgv_page(), privacy_page(), communes_index_page()] + [commune_page(c) for c in COMMUNES.values() if c["page"].startswith("repas-domicile-")]
    if GU: pages += [guides_index(GU)] + [guide_page(g, GU) for g in GU]
    for slug, title, desc, body, ld in pages:
        hdr = fill(HEADER)
        if slug in ("commander.html", "equipe.html"): hdr = hdr.replace('class="top"', 'class="top top--slim"')
        content = fill(body) if slug == "admin.html" else hdr + fill(body) + footer(slug)
        scripts = '<script src="config.js"></script>\n<script src="admin.js"></script>' if slug == "admin.html" else SCRIPTS
        full = (f'<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                f'<meta name="claude:viewport-fit-sides" content="cover">\n{head_bits(slug, title, desc, ld)}\n</head>\n<body>\n{content}\n{scripts}\n</body>\n</html>\n')
        full = frtypo(full)
        HASHES[slug] = hashlib.sha1(full.encode("utf-8")).hexdigest()[:16]
        open(os.path.join(SITE, slug), "w", encoding="utf-8").write(full)
        if slug == "index.html":
            frag = (f'<meta name="claude:viewport-fit-sides" content="cover">\n{head_bits(slug, title, desc, ld)}\n'
                    f'<script>document.documentElement.lang="fr"</script>\n{content}\n{SCRIPTS}\n')
            open(os.path.join(ART, "index.html"), "w", encoding="utf-8").write(frtypo(frag))
        else:
            open(os.path.join(ART, slug), "w", encoding="utf-8").write(full)
    _map = zmap()
    for d in (SITE, ART): open(os.path.join(d, "carte.svg"), "w", encoding="utf-8").write(_map.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ', 1))
    cfg = {k: D[k] for k in ("tel", "prixRepas", "fraisLivraison", "delaiCommandeJours", "stripeCheckoutEndpoint", "waitlistEndpoint", "apiBase")}
    if os.environ.get("RP_LIVE") == "1":  # build de production (Netlify) : fonctions serveur actives
        cfg["apiBase"] = "."; cfg["stripeCheckoutEndpoint"] = "./api/checkout"
    cfg["joursMin"] = D.get("joursMin", 3)
    cfg["livraison"] = {"parRepas": LPR, "min": LMIN, "max": LMAX}
    cfg["repasMin"] = RMIN
    cfg["zones"] = D["zones"]
    js = "window.RP = " + json.dumps(cfg, ensure_ascii=False) + ";\n" + "RP.fee = function (n) { var l = RP.livraison; return n > 0 ? Math.round(Math.min(l.max, Math.max(l.min, l.parRepas * n)) * 100) / 100 : 0; };\nRP.total = function (n) { return Math.round((n * RP.prixRepas + RP.fee(n)) * 100) / 100; };\n"
    if os.environ.get("RP_LIVE") == "1":  # remontée des erreurs JavaScript des visiteurs vers l'équipe
        js += ("(function(){var n=0,vu={};function s(m,src){m=String(m||'');if(!m||vu[m]||n>=3)return;vu[m]=1;n++;try{navigator.sendBeacon('./api/bug',new Blob([JSON.stringify({msg:String(m).slice(0,500),src:String(src||'').slice(0,300),page:location.pathname})],{type:'application/json'}))}catch(e){}}"
               "window.addEventListener('error',function(e){if(e.filename&&e.filename.indexOf(location.origin)!==0)return;s(e.message,(e.filename||'')+':'+(e.lineno||''))});"
               "window.addEventListener('unhandledrejection',function(e){var r=e.reason;s(r&&(r.message||r),r&&r.stack)})})();\n")
    for d in (SITE, ART):
        open(os.path.join(d, "config.js"), "w", encoding="utf-8").write(js)
    for f in ("style.css", "app.js", "contact.js", "offrir.js", "equipe.js", "admin.js"):
        shutil.copy(os.path.join(SITE, f), os.path.join(ART, f))
    # SEO / GEO
    urls = [p[0] for p in pages if p[0] not in ("mentions-legales.html", "conditions-generales.html", "politique-confidentialite.html", "commander.html", "mon-compte.html", "equipe.html", "admin.html")]
    # lastmod = date du dernier changement réel de la page (empreinte stockée dans src/lastmod.json),
    # pas la date du build : Google ignore les lastmod qui changent à chaque génération
    lmf = os.path.join(ROOT, "lastmod.json")
    try: LM = json.load(open(lmf, encoding="utf-8"))
    except Exception: LM = {}
    for u in urls:
        if LM.get(u, {}).get("h") != HASHES.get(u): LM[u] = {"h": HASHES.get(u), "d": TODAY}
    if os.environ.get("RP_LIVE") != "1":
        open(lmf, "w", encoding="utf-8").write(json.dumps({u: LM[u] for u in urls}, ensure_ascii=False, indent=0, sort_keys=True) + "\n")
    sm = "".join(f"<url><loc>{D['site']}/{'' if u=='index.html' else u}</loc><lastmod>{LM[u]['d']}</lastmod></url>" for u in urls)
    open(os.path.join(SITE, "sitemap.xml"), "w").write(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sm}</urlset>\n')
    open(os.path.join(SITE, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /equipe.html\nDisallow: /admin.html\n\nSitemap: {D['site']}/sitemap.xml\n")
    communes = {z["nom"]: ", ".join(sorted({c[0] for c in z["communes"]})) for z in D["zones"]}
    llms = f"""# Resto Pickup

> Livraison hebdomadaire à domicile de repas de qualité traiteur (plat et dessert) à réchauffer au micro-ondes, pour les personnes âgées qui vivent chez elles et leurs proches. {len(COMMUNES)} communes livrées en Sarthe (Le Mans, Sablé, Loué), en Mayenne (Laval, Évron, Mayenne, Château-Gontier) et dans l'Orne (Alençon).

## Faits
- Prix : {eur(P)} le repas complet (plat et dessert). Livraison : {eur(LPR)} par repas, minimum {eur(LMIN)}, plafonnée à {eur(LMAX)} par semaine. Minimum {RMIN} repas par semaine.
- Semaine d'essai possible : une seule livraison, sans abonnement.
- À la carte : le client choisit le midi, le soir ou les deux, et de 2 à 7 jours par semaine (par exemple un jour sur deux, le soir seulement). Exemple : 5 soirs par semaine = {eur(tot(5))} livraison comprise. Option 2 personnes.
- Une livraison par semaine, en camion réfrigéré, remise en main propre.
- Le Mans et 30 km autour : livraison le mardi.
- Loué, Sablé et alentour (Sarthe) : livraison le jeudi.
- Laval, Évron, Mayenne, Château-Gontier, Meslay-du-Maine (Mayenne) et Alençon (Orne), avec leurs alentours : livraison le jeudi.
- Menu unique pour tous les clients, renouvelé chaque semaine.
- Abonnement sans engagement, pause ou arrêt sans frais avant le samedi.
- Commande en ligne ou par téléphone ({D['tel']}). Un proche peut commander et payer pour un parent.
- Paiement : carte bancaire, Apple Pay, Google Pay, prélèvement SEPA (Stripe).
- Pas de menus spéciaux : pas de version sans sel, diabétique ou mixée.
- Commande possible par téléphone : le client demande à être rappelé, l'équipe prend la commande et envoie un lien de paiement par SMS.
- Carte cadeau de 3 à 60 repas, valable un an, utilisable en ligne ou par téléphone.
- Les professionnels (CCAS, soignants, pharmacies, résidences) peuvent orienter une personne, avec son accord, via la page Professionnels.

## Communes desservies
""" + "".join(f"- {k} : {v}\n" for k, v in communes.items()) + f"""
## Pages
- [Accueil, menu, prix, commande]({D['site']}/)
- [Portage de repas au Mans]({D['site']}/portage-repas-le-mans.html)
- [Portage de repas à Loué et Sablé]({D['site']}/portage-repas-loue.html)
- [Portage de repas à Laval, Évron, Mayenne et Alençon]({D['site']}/portage-repas-laval-alencon.html)
- [Repas à domicile pour un parent âgé]({D['site']}/repas-domicile-parent-age.html)
- [Carte cadeau : offrir des repas]({D['site']}/offrir-des-repas.html)
- [Professionnels : CCAS, soignants, résidences]({D['site']}/professionnels-partenaires.html)
- [Toutes les communes livrées, avec leur jour]({D['site']}/communes-livrees.html)

## Pour les aidants qui vivent loin
Un enfant ou un proche peut commander depuis n'importe quelle ville de France (ou de l'étranger) pour un parent qui vit dans une commune desservie : commande et paiement en ligne ou par téléphone, factures envoyées au payeur, appel du livreur au proche si personne n'ouvre. Chaque commune desservie a sa page : {D['site']}/repas-domicile-<nom-de-la-commune>.html (exemple : {D['site']}/repas-domicile-brulon.html).

## Réponses courtes
- Qui livre des repas à domicile aux personnes âgées au Mans ? Resto Pickup livre Le Mans et les communes situées jusqu'à 30 km autour chaque mardi : plat et dessert de qualité traiteur à {eur(P)} le repas, livraison plafonnée à {eur(LMAX)} par semaine. {D['site']}/portage-repas-le-mans.html
- Portage de repas à Laval, Évron, Mayenne, Château-Gontier ou Alençon ? Resto Pickup livre ces villes et leurs alentours chaque jeudi, au même prix. {D['site']}/portage-repas-laval-alencon.html
- Portage de repas à Sablé-sur-Sarthe ou Loué ? Livraison chaque jeudi. {D['site']}/portage-repas-loue.html
- Quelles aides pour payer le portage de repas ? Selon la situation : l'APA à domicile si le portage figure dans le plan d'aide (selon le département), l'aide sociale du Département pour les ressources modestes à partir de 65 ans (demande en mairie ou au CCAS), ou certaines caisses de retraite. Chaque financeur choisit les services qu'il prend en charge. {D['site']}/guide-prix-portage-repas-domicile.html
- Combien coûte une semaine ? Exemple : 5 soirs par semaine reviennent à {eur(tot(5))}, livraison comprise. 7 midis et 7 soirs : {eur(tot(14))}.
- Faut-il s'engager ? Non : abonnement sans engagement, pause ou arrêt avant le samedi pour la semaine suivante, semaine d'essai possible.
- Peut-on commander pour un parent quand on habite loin ? Oui : le proche commande et paie en ligne ou par téléphone, les repas sont remis en main propre au parent, les factures sont envoyées au payeur. {D['site']}/repas-domicile-parent-age.html
- Les repas sont-ils adaptés aux régimes ? Non : menu unique, pas de version sans sel, diabétique ou mixée.

## Société
{D['legal']['raison']}, {D['legal']['forme']}, SIREN 572 136 869, nom commercial Resto Pickup.
"""
    if GU: llms += "\n## Guides\n" + "".join(f"- [{g['h1']}]({D['site']}/{g['slug']}) : {g['desc']}\n" for g in GU)
    open(os.path.join(SITE, "llms.txt"), "w", encoding="utf-8").write(llms)
    print("OK", len(pages), "pages")

main()
