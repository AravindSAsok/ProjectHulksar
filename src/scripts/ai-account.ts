type ProviderModel = { id: string; name: string };
type ProviderStatus = {
  provider: string;
  configured: boolean;
  ok: boolean;
  modelCount: number;
  models?: ProviderModel[];
  message?: string;
};
type StatusResponse = { providers?: ProviderStatus[] };

const providerSelect = document.getElementById("quick-provider") as HTMLSelectElement | null;
const modelSelect = document.getElementById("quick-model") as HTMLSelectElement | null;
const modelStatus = document.getElementById("quick-model-status");
const estimateUrl = "/api/estimate";

async function loadModels(): Promise<void> {
  if (!providerSelect || !modelSelect) return;
  const selectedProvider = providerSelect.value;
  modelSelect.replaceChildren();
  if (selectedProvider === "auto") {
    modelSelect.add(new Option("Automatic fallback", ""));
    modelSelect.disabled = true;
    if (modelStatus) modelStatus.textContent = "Automatic fallback is enabled.";
    return;
  }

  modelSelect.disabled = true;
  modelSelect.add(new Option("Loading available models…", ""));
  if (modelStatus) modelStatus.textContent = "Checking models available to your API key…";

  try {
    const response = await fetch("/api/provider-status", { cache: "no-store" });
    const payload = await response.json() as StatusResponse;
    const provider = payload.providers?.find((item) => item.provider === selectedProvider);
    modelSelect.replaceChildren();

    if (!provider?.configured) {
      modelSelect.add(new Option("API key not configured", ""));
      if (modelStatus) modelStatus.textContent = "Add this provider's API key in Vercel.";
      return;
    }
    if (!provider.ok || !provider.models?.length) {
      modelSelect.add(new Option("Model list unavailable", ""));
      if (modelStatus) modelStatus.textContent = provider.message || "Could not retrieve this provider's models.";
      return;
    }

    modelSelect.add(new Option("Use configured default", ""));
    for (const model of provider.models) {
      const label = model.name && model.name !== model.id ? model.name + " · " + model.id : model.id;
      modelSelect.add(new Option(label, model.id));
    }
    modelSelect.disabled = false;
    if (modelStatus) modelStatus.textContent = provider.modelCount.toLocaleString() + " models returned by " + selectedProvider + ".";
  } catch {
    modelSelect.replaceChildren(new Option("Model list unavailable", ""));
    if (modelStatus) modelStatus.textContent = "Could not reach the model-list endpoint.";
  }
}

if (providerSelect && modelSelect) {
  providerSelect.addEventListener("change", () => void loadModels());
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.endsWith(estimateUrl) && typeof init?.body === "string") {
      try {
        const body = JSON.parse(init.body) as Record<string, unknown>;
        if (providerSelect.value !== "auto" && modelSelect.value) body.model = modelSelect.value;
        else delete body.model;
        init = { ...init, body: JSON.stringify(body) };
      } catch {
        // Leave malformed requests unchanged; the API route returns its normal validation error.
      }
    }
    const response = await nativeFetch(input, init);
    if (url.endsWith(estimateUrl)) {
      try {
        const result = await response.clone().json() as { provider?: string; model?: string };
        const attribution = document.getElementById("estimate-attribution");
        if (attribution) {
          attribution.textContent = response.ok && result.provider && result.model
            ? "Estimated with " + result.provider + " · " + result.model
            : "";
        }
      } catch {
        // Ignore non-JSON responses; the existing estimate flow handles the error.
      }
    }
    return response;
  }) as typeof window.fetch;
  void loadModels();
}

const accountTrigger = document.getElementById("account-trigger") as HTMLButtonElement | null;
const accountDialog = document.getElementById("account-dialog") as HTMLDialogElement | null;
const accountForm = document.getElementById("account-form") as HTMLFormElement | null;
const accountFields = document.getElementById("account-fields");
const accountStatus = document.getElementById("account-status");
const accountModeToggle = document.getElementById("account-mode-toggle") as HTMLButtonElement | null;
const accountSubmit = document.getElementById("account-submit") as HTMLButtonElement | null;
const accountSignout = document.getElementById("account-signout") as HTMLButtonElement | null;
const accountSessionActions = document.getElementById("account-session-actions");
const accountName = document.getElementById("account-name") as HTMLInputElement | null;
const accountEmail = document.getElementById("account-email") as HTMLInputElement | null;
const accountPassword = document.getElementById("account-password") as HTMLInputElement | null;
const accountNameLabel = accountName?.closest("label") as HTMLLabelElement | null;
const accountPasswordLabel = accountPassword?.closest("label") as HTMLLabelElement | null;
const accountEmailLabel = accountEmail?.closest("label") as HTMLLabelElement | null;
const accountForgot = document.getElementById("account-forgot") as HTMLButtonElement | null;
const accountResend = document.getElementById("account-resend") as HTMLButtonElement | null;
const accountChangePassword = document.getElementById("account-change-password") as HTMLButtonElement | null;

type AccountUser = { id: string; name: string; email: string };
type AccountMode = "signup" | "signin";
let accountMode: AccountMode = "signup";
let activeUser: AccountUser | null = null;

const displayNameElement = document.getElementById("account-display-name");
const displayEmailElement = document.getElementById("account-display-email");
const profileSummary = document.getElementById("account-profile-summary");
const profileName = document.getElementById("account-profile-name");
const profileEmail = document.getElementById("account-profile-email");

function setAccountStatus(message: string, kind: "info" | "success" | "error" = "info") {
  if (!accountStatus) return;
  accountStatus.textContent = message;
  accountStatus.classList.toggle("is-error", kind === "error");
  accountStatus.classList.toggle("is-success", kind === "success");
  accountStatus.classList.toggle("is-info", kind === "info");
}

function setAccountMode(mode: AccountMode) {
  accountMode = mode;
  if (accountNameLabel) accountNameLabel.hidden = mode !== "signup";
  if (accountName) accountName.required = mode === "signup";
  if (accountEmailLabel) accountEmailLabel.hidden = false;
  if (accountEmail) accountEmail.required = true;
  if (accountPasswordLabel) accountPasswordLabel.hidden = false;
  if (accountPassword) {
    accountPassword.required = true;
    accountPassword.autocomplete = mode === "signup" ? "new-password" : "current-password";
    accountPassword.placeholder = mode === "signup" ? "At least 8 characters" : "Your password";
  }
  if (accountSubmit) accountSubmit.textContent = mode === "signup" ? "Create free account" : "Sign in";
  if (accountModeToggle) {
    accountModeToggle.hidden = Boolean(activeUser);
    accountModeToggle.textContent = mode === "signup" ? "Already have an account? Sign in" : "New to Hulksar? Create account";
  }
  if (accountForgot) accountForgot.hidden = true;
  if (accountResend) accountResend.hidden = true;
  if (accountChangePassword) accountChangePassword.hidden = true;
  setAccountStatus(mode === "signup"
    ? "Create your Hulksar account. Your account and sign-in are securely stored in MongoDB."
    : "Welcome back. Sign in to access your saved diary and tasks.");
}

async function refreshAccount(): Promise<void> {
  const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Could not check your account session.");
  const payload = await response.json() as { user?: AccountUser | null };
  activeUser = payload.user ?? null;
  const signedIn = Boolean(activeUser);
  if (displayNameElement) displayNameElement.textContent = activeUser?.name || "Guest account";
  if (displayEmailElement) displayEmailElement.textContent = activeUser?.email || "Local diary";
  if (profileName) profileName.textContent = activeUser?.name || "";
  if (profileEmail) profileEmail.textContent = activeUser?.email || "";
  if (profileSummary) profileSummary.hidden = !signedIn;
  if (accountFields) accountFields.hidden = signedIn;
  if (accountSessionActions) accountSessionActions.hidden = !signedIn;
  if (accountModeToggle) accountModeToggle.hidden = signedIn;
  if (signedIn) setAccountStatus("You're signed in. Your diary and tasks use your MongoDB account.", "success");
  else setAccountMode(accountMode);
}

if (accountTrigger && accountDialog && accountForm && accountFields && accountStatus && accountModeToggle && accountSubmit && accountSignout && accountSessionActions && accountName && accountEmail && accountPassword) {
  accountTrigger.addEventListener("click", () => {
    void refreshAccount().catch((error) => setAccountStatus(error instanceof Error ? error.message : "Could not load your account.", "error"))
      .finally(() => { if (!accountDialog.open) accountDialog.showModal(); });
  });

  accountModeToggle.addEventListener("click", () => setAccountMode(accountMode === "signup" ? "signin" : "signup"));

  accountForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = accountName.value.trim();
    const email = accountEmail.value.trim().toLowerCase();
    const password = accountPassword.value;
    if (accountMode === "signup" && name.length < 2) {
      setAccountStatus("Enter your name (at least 2 characters).", "error");
      accountName.focus();
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAccountStatus("Enter a valid email address.", "error");
      accountEmail.focus();
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setAccountStatus("Your password must be between 8 and 128 characters.", "error");
      accountPassword.focus();
      return;
    }

    accountSubmit.disabled = true;
    accountSubmit.textContent = accountMode === "signup" ? "Creating account…" : "Signing in…";
    try {
      const response = await fetch(accountMode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountMode === "signup" ? { name, email, password } : { email, password })
      });
      const payload = await response.json().catch(() => ({})) as { user?: AccountUser; error?: string };
      if (!response.ok || !payload.user) throw new Error(payload.error || "Account request failed. Please try again.");
      setAccountStatus(accountMode === "signup" ? "Your account is ready. Welcome to Hulksar!" : "Signed in successfully. Welcome back!", "success");
      window.location.reload();
    } catch (error) {
      setAccountStatus(error instanceof Error ? error.message : "Account request failed. Please try again.", "error");
      accountSubmit.disabled = false;
      accountSubmit.textContent = accountMode === "signup" ? "Create free account" : "Sign in";
    }
  });

  accountSignout.addEventListener("click", async () => {
    accountSignout.disabled = true;
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      window.location.reload();
    } catch (error) {
      setAccountStatus(error instanceof Error ? error.message : "Could not sign out.", "error");
      accountSignout.disabled = false;
    }
  });

  void refreshAccount().catch((error) => {
    console.warn("[hulksar-auth] Could not restore account session.", error);
    setAccountStatus("Account status is temporarily unavailable. Your local diary remains available.", "error");
  });
}
