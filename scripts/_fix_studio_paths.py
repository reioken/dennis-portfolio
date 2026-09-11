from pathlib import Path

p = Path(__file__).resolve().parents[1] / "public" / "studio" / "app.js"
c = p.read_text(encoding="utf-8")
c = c.replace("/assets/logos/", "/studio/assets/logos/")
c = c.replace('location.href = "/login.html"', 'location.href = "/studio/login.html"')
c = c.replace("location.href = '/login.html'", "location.href = '/studio/login.html'")
c = c.replace('fetch("/api/logout")', 'fetch("/studio/api/logout")')
c = c.replace("fetch('/api/logout')", "fetch('/studio/api/logout')")
p.write_text(c, encoding="utf-8")
print("patched", p)
