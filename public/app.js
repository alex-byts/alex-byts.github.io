async function checkSession() {
  const response = await fetch("/api/me", { credentials: "same-origin" });
  return response.ok ? response.json() : null;
}

async function updateStatus() {
  const user = await checkSession();
  const status = document.getElementById("status");
  const loginLinks = document.getElementById("login-links");
  const logoutForm = document.getElementById("logout-form");

  if (user) {
    status.textContent = `Sessão de ${user.email ?? user.displayName}.`;
    loginLinks.classList.add("hidden");
    logoutForm.classList.remove("hidden");
  } else {
    status.textContent = "Nenhuma sessão neste navegador.";
    loginLinks.classList.remove("hidden");
    logoutForm.classList.add("hidden");
  }
}

updateStatus();

document
  .getElementById("logout-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    await fetch("/oauth/logout", { method: "POST", credentials: "same-origin" });
    updateStatus();
  });