from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

root = Path(__file__).parent
raw = root / "screenshots" / "mobile"
sel_m = root / "screenshots" / "selected" / "mobile-390x844"
sel_d = root / "screenshots" / "selected" / "desktop-1440x900"
sel_m.mkdir(parents=True, exist_ok=True)
sel_d.mkdir(parents=True, exist_ok=True)

mapping = {
    "01-onboarding-welcome.png": "01-onboarding-welcome",
    "02-onboarding-symptoms.png": "02-onboarding-symptoms",
    "flow-0.png": "03-onboarding-apple",
    "flow-1.png": "04-onboarding-exclusions",
    "flow-2.png": "05-onboarding-preferences",
    "11-home.png": "06-home-suggestions",
    "12-recipe-detail.png": "07-recipe-detail",
    "12b-recipe-ingredients.png": "08-recipe-ingredients",
    "30-track.png": "09-track-empty",
    "50-more.png": "10-more-hub",
    "51-travel.png": "11-travel-card-empty",
    "52-restaurant.png": "12-restaurant",
    "53-settings.png": "13-settings",
    "54-about.png": "14-about",
    "56-home-picturebook.png": "15-picturebook-recipe",
}


def fit_cover(im: Image.Image, tw: int, th: int) -> Image.Image:
    scale = max(tw / im.width, th / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im2 = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return im2.crop((left, top, left + tw, top + th))


def phone_on_desktop(im: Image.Image, tw: int = 1440, th: int = 900, phone_h: int = 820) -> Image.Image:
    bg = Image.new("RGBA", (tw, th), (242, 245, 240, 255))
    scale = phone_h / im.height
    pw = int(im.width * scale)
    ph = phone_h
    phone = im.resize((pw, ph), Image.Resampling.LANCZOS).convert("RGBA")
    x = (tw - pw) // 2
    y = (th - ph) // 2
    shadow = Image.new("RGBA", (pw + 40, ph + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow)
    d.rounded_rectangle((20, 20, pw + 20, ph + 20), radius=48, fill=(18, 34, 26, 45))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    bg.alpha_composite(shadow, (x - 20, y - 10))
    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, pw, ph), radius=40, fill=255)
    bg.paste(phone, (x, y), mask)
    return bg.convert("RGB")


for src, slug in mapping.items():
    p = raw / src
    if not p.exists():
        print("missing", src)
        continue
    im = Image.open(p).convert("RGB")
    fit_cover(im, 390, 844).save(sel_m / f"{slug}.png", optimize=True)
    phone_on_desktop(im).save(sel_d / f"{slug}.png", optimize=True)
    print("ok", slug, im.size)

print("mobile", len(list(sel_m.glob("*.png"))))
print("desktop", len(list(sel_d.glob("*.png"))))
