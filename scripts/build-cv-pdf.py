"""Render scripts/cv-2026.html to public/cv Lebenslauf 2026 PDF."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "scripts" / "cv-2026.html"
OUT = ROOT / "public" / "cv" / "Dennis-Bierreth-Fernandez-Lebenslauf-2026.pdf"
PORTRAIT = ROOT / "public" / "media" / "me" / "portrait-full.jpg"


def main() -> None:
    html = HTML.read_text(encoding="utf-8")
    # Absolute file URL for portrait (reliable under Playwright)
    portrait_url = PORTRAIT.resolve().as_uri()
    html = html.replace("../public/media/me/portrait-full.jpg", portrait_url)
    # Prefer single-line name in PDF
    html = html.replace("Dennis<br />Bierreth-Fernandez", "Dennis Bierreth-Fernandez")

    tmp = ROOT / "scripts" / "_cv-2026-render.html"
    tmp.write_text(html, encoding="utf-8")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(tmp.as_uri(), wait_until="networkidle")
        page.pdf(
            path=str(OUT),
            format="A4",
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
        )
        browser.close()

    tmp.unlink(missing_ok=True)
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
