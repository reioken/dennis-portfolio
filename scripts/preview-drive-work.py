import fitz
import shutil
from pathlib import Path

out = Path(r"C:\Users\denni\Projects\dennis-portfolio\.preview-drive")
out.mkdir(exist_ok=True)
for f in out.glob("*"):
    f.unlink()

base = Path(r"G:\My Drive\Work\Portfolio")
candidates = [
    base / "Websiten" / "Gecam" / "gecam-de-mobile.pdf",
    base / "Websiten" / "Baufinanzierungs Service" / "baufinanzierung-de-landingpage-mobile.pdf",
    base / "Websiten" / "Bouche und Partner" / "boucheundpartner-de-mobile.pdf",
    base / "Websiten" / "Recruiting" / "freudeamjob-de-mobile.pdf",
    base / "Websiten" / "Recruiting" / "jobs-zahn-mannheim-de-mobile.pdf",
    base / "Websiten" / "medicops" / "medicops-net-mobile.pdf",
    base / "Websiten" / "AAK" / "aak-autoglas-mobile.pdf",
    base / "Websiten" / "Stiegler Immobilien" / "immobilien-stiegler-de-mobile.pdf",
    base / "Websiten" / "Edeka Stiegler" / "edeka-stiegler-de-azubi-mobile.pdf",
    base / "Websiten" / "IG Seidel" / "ig-seidel-mobile.pdf",
    base / "Websiten" / "Leonardo Venture" / "leonardo.pdf",
    base / "Websiten" / "Willi Alt" / "willi-alt.pdf",
    base / "Websiten" / "recruitingbooster-de-mobile.pdf",
]

for pdf in candidates:
    if not pdf.exists():
        print("MISSING", pdf)
        continue
    doc = fitz.open(pdf)
    page = doc[0]
    mat = fitz.Matrix(1.5, 1.5)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    name = pdf.stem[:48] + ".jpg"
    dest = out / name
    pix.save(str(dest), jpg_quality=85)
    print(f"OK {name} {dest.stat().st_size // 1024}KB pages={doc.page_count}")
    doc.close()

ads = [
    base / "Ads" / "Zahn+" / "Zahnfee.png",
    base / "Ads" / "Zahn+" / "Spass.png",
    base / "Ads" / "Transcura" / "Einzelad_7.png",
    base / "Ads" / "Der Sport Müller" / "Ski" / "Coverbild.png",
    base / "Ads" / "Der Sport Müller" / "Radhelme" / "01 - Cover.png",
    base / "Sonstiges" / "BarberShopMockup.png",
    base / "Sonstiges" / "ShopMockup.png",
    base / "Sonstiges" / "Landing_Page_2.jpg",
]
for a in ads:
    if a.exists():
        dest = out / ("ad_" + a.name.replace(" ", "_"))
        shutil.copy2(a, dest)
        print("COPY", dest.name, dest.stat().st_size // 1024, "KB")
    else:
        print("MISSING AD", a)

print("DONE", out)
