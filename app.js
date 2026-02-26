// app.js
const status = document.getElementById("status");
const btn = document.getElementById("btn");

btn.addEventListener("click", () => {
  const t = new Date().toLocaleString("de-AT");
  status.textContent = `JS läuft. Klick um: ${t}`;
});
