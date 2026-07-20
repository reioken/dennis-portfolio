document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("err");
  err.hidden = true;
  const res = await fetch("/studio/api/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: document.getElementById("pw").value }),
  });
  if (!res.ok) {
    err.hidden = false;
    return;
  }
  location.href = "/";
});
