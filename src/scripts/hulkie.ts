export {};

type ProviderModel = { id: string; name: string };
type ProviderStatus = { provider: string; configured: boolean; ok: boolean; modelCount: number; models?: ProviderModel[] };
type ChatMessage = { id?: string; role: "user" | "assistant"; content: string; created_at?: string };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const launcher = $("hulkie-launcher") as HTMLButtonElement;
const panel = $("hulkie-panel");
const closeButton = $("hulkie-close") as HTMLButtonElement;
const form = $("hulkie-form") as HTMLFormElement;
const input = $("hulkie-input") as HTMLTextAreaElement;
const sendButton = $("hulkie-send") as HTMLButtonElement;
const messages = $("hulkie-messages");
const providerSelect = $("hulkie-provider") as HTMLSelectElement;
const modelSelect = $("hulkie-model") as HTMLSelectElement;
const suggestions = $("hulkie-suggestions");
let historyLoaded = false;
let sending = false;

function addBubble(role: "user" | "assistant" | "error", content: string): void {
  const bubble = document.createElement("div");
  bubble.className = "hulkie-message " + role;
  bubble.textContent = content;
  messages.append(bubble);
  messages.scrollTop = messages.scrollHeight;
}

function clearWelcome(): void {
  messages.querySelector(".hulkie-welcome")?.remove();
}

async function loadHistory(): Promise<void> {
  if (historyLoaded) return;
  try {
    const response = await fetch("/api/assistant", { credentials: "same-origin", cache: "no-store" });
    const payload = await response.json() as { messages?: ChatMessage[]; error?: string };
    if (!response.ok) throw new Error(payload.error || "Could not load your chat history.");
    if (payload.messages?.length) {
      clearWelcome();
      for (const message of payload.messages) addBubble(message.role, message.content);
    }
    historyLoaded = true;
  } catch (error) {
    clearWelcome();
    addBubble("error", error instanceof Error ? error.message : "Could not load Hulkie's history.");
  }
}

async function loadModels(): Promise<void> {
  const provider = providerSelect.value;
  modelSelect.replaceChildren();
  if (provider === "auto") {
    modelSelect.add(new Option("Automatic fallback", ""));
    modelSelect.disabled = true;
    return;
  }
  modelSelect.disabled = true;
  modelSelect.add(new Option("Loading models…", ""));
  try {
    const response = await fetch("/api/provider-status", { cache: "no-store" });
    const payload = await response.json() as { providers?: ProviderStatus[] };
    const selected = payload.providers?.find((item) => item.provider === provider);
    modelSelect.replaceChildren();
    if (!selected?.configured || !selected.ok || !selected.models?.length) {
      modelSelect.add(new Option("No models available", ""));
      return;
    }
    modelSelect.add(new Option("Use provider default", ""));
    for (const model of selected.models) modelSelect.add(new Option(model.name === model.id ? model.id : model.name + " · " + model.id, model.id));
    modelSelect.disabled = false;
  } catch {
    modelSelect.replaceChildren(new Option("Could not load models", ""));
  }
}

async function sendMessage(message: string): Promise<void> {
  if (sending || !message.trim()) return;
  sending = true;
  sendButton.disabled = true;
  input.disabled = true;
  suggestions.hidden = true;
  clearWelcome();
  addBubble("user", message);
  const typing = document.createElement("div");
  typing.className = "hulkie-typing";
  typing.textContent = "Hulkie is checking your diary…";
  messages.append(typing);
  messages.scrollTop = messages.scrollHeight;
  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        provider: providerSelect.value || "auto",
        model: modelSelect.value || undefined,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    });
    const payload = await response.json() as { answer?: string; error?: string; provider?: string; model?: string };
    if (!response.ok) throw new Error(payload.error || "Hulkie could not answer.");
    addBubble("assistant", payload.answer || "I couldn't find an answer in your diary.");
    const attribution = document.createElement("div");
    attribution.className = "hulkie-typing";
    attribution.textContent = "Answered with " + payload.provider + " · " + payload.model;
    messages.append(attribution);
  } catch (error) {
    addBubble("error", error instanceof Error ? error.message : "Something went wrong. Please try again.");
  } finally {
    typing.remove();
    sending = false;
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
    messages.scrollTop = messages.scrollHeight;
  }
}

const setHulkieOpen = (open: boolean): void => {
  panel.hidden = !open;
  document.body.classList.toggle("hulkie-open", open);
  launcher.setAttribute("aria-expanded", String(open));
  if (open) void loadHistory();
};

launcher.setAttribute("aria-expanded", "false");
launcher.addEventListener("click", () => {
  const opening = panel.hidden;
  setHulkieOpen(opening);
  // Do not summon the mobile keyboard merely by opening the assistant.
  if (opening && !window.matchMedia("(pointer: coarse)").matches) input.focus();
});
closeButton.addEventListener("click", () => setHulkieOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !panel.hidden) setHulkieOpen(false);
});
providerSelect.addEventListener("change", () => void loadModels());
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  void sendMessage(message);
});
suggestions.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const button = target.closest<HTMLButtonElement>("[data-prompt]");
  const prompt = button?.dataset.prompt;
  if (prompt) void sendMessage(prompt);
});
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
void loadModels();
