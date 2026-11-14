#!/usr/bin/env python3
"""Génère site/docs/flyer-resto-pickup.pdf (A5 recto verso) et site/img/flyer-apercu.jpg.
Usage : python3 src/flyer/make_flyer.py  (après build.py, les prix viennent de data.json)."""
import json, os, re
from playwright.sync_api import sync_playwright

H = os.path.dirname(os.path.abspath(__file__))
R = os.path.join(H, "..", "..")
D = json.load(open(os.path.join(H, "..", "data.json"), encoding="utf-8"))
P = D["prixRepas"]
eur = lambda x: f"{x:.2f}".replace(".", ",") + " €"
qr = open(os.path.join(H, "qr.svg"), encoding="utf-8").read()
qr = re.sub(r"<\?xml[^>]*>", "", qr).replace('width="25mm" height="25mm"', "").replace("<path ", '<path fill="#1B2A4E" ')
JL = ["L", "M", "M", "J", "V", "S", "D"]
JN = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."]
import html as _h
def cell(r): return f"{_h.escape(r['plat'])}<small>{_h.escape(r['dessert'])}</small>"
menu = "".join(f'<tr><td class="d"><span class="dd"><i>{JL[i]}</i>{JN[i]}</span></td><td>{cell(j["midi"])}</td><td>{cell(j["soir"])}</td></tr>' for i, j in enumerate(D["menu"]["jours"]))
LPR, LMIN, LMAX = D["livraisonParRepas"], D["livraisonMin"], D["livraisonMax"]
tot = lambda n: n * P + round(min(LMAX, max(LMIN, LPR * n)), 2)
V = {"menu": menu, "prix": eur(P), "p5": eur(5 * P), "p1": eur(7 * P), "p2": eur(14 * P), "liv": eur(LPR), "livmax": eur(LMAX), "tel": D["tel"], "qr": qr}
src = open(os.path.join(H, "flyer.html"), encoding="utf-8").read()
out = os.path.join(H, "_flyer.html")
open(out, "w", encoding="utf-8").write(re.sub(r"\{\{(\w+)\}\}", lambda m: V[m.group(1)], src))

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1200, "height": 900}, device_scale_factor=2)
    pg.goto("file://" + out); pg.wait_for_timeout(600)
    os.makedirs(os.path.join(R, "site", "docs"), exist_ok=True)
    pg.pdf(path=os.path.join(R, "site", "docs", "flyer-resto-pickup.pdf"), width="148mm", height="210mm", print_background=True, prefer_css_page_size=True)
    # Aperçu : recto et verso côte à côte
    secs = pg.query_selector_all(".page")
    for i, s in enumerate(secs):
        s.screenshot(path=os.path.join(H, f"_p{i}.png"))
    pg.set_viewport_size({"width": 900, "height": 636})
    pg.set_content('<html><body style="margin:0;background:#EDE7DD;display:flex;gap:44px;justify-content:center;align-items:center;width:900px;height:636px">'
                   + "".join(f'<img src="file://{os.path.join(H, f"_p{i}.png")}" style="height:540px;box-shadow:0 18px 30px -14px rgba(27,42,78,.5);transform:rotate({r}deg)">' for i, r in ((0, -2), (1, 2)))
                   + "</body></html>")
    pg.wait_for_timeout(300)
    pg.screenshot(path=os.path.join(R, "site", "img", "flyer-apercu.jpg"), type="jpeg", quality=82)
    b.close()
print("flyer OK")
