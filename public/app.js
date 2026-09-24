async function updateStatus() {
  const response = await fetch("/api/me", { credentials: "same-origin" });
  const user = response.ok ? await response.json() : null;
  const status = document.getElementById("status");
  status.textContent = user
    ? `Sessão de ${user.email ?? user.displayName}.`
    : "Nenhuma sessão neste navegador.";
}

updateStatus();

document
  .querySelector("form[action='/oauth/logout']")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    await fetch("/oauth/logout", { method: "POST", credentials: "same-origin" });
    updateStatus();
  });