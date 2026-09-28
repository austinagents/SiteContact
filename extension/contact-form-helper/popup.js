const DEFAULT_EMAIL = "joinugcnetwork@gmail.com";
const DEFAULT_MESSAGE = `Hi,

I'm building a marketplace for TikTok Shop Affiliates, where products are tiered by creators last 30-day sales.

We currently manage over 40 Shops on TikTok, with thousands of creator deals landed monthly. My teams background is largely Meta as well so we cover most social platforms.

If you want to check it out and see if it's something you'd be interested in, I'd love to show you around.

Join here: https://discord.gg/Q7nn5UpHux`;

const senderName = document.getElementById("senderName");
const contactEmail = document.getElementById("contactEmail");
const message = document.getElementById("message");
const result = document.getElementById("result");
const autoFill = document.getElementById("autoFill");
const autoAdvance = document.getElementById("autoAdvance");
const queueBaseUrl = document.getElementById("queueBaseUrl");
const extensionApiToken = document.getElementById("extensionApiToken");

async function load() {
  const saved = await chrome.storage.local.get(["senderName", "contactEmail", "message", "autoFill", "autoAdvance", "queueBaseUrl", "extensionApiToken"]);
  senderName.value = saved.senderName || "";
  contactEmail.value = saved.contactEmail || DEFAULT_EMAIL;
  message.value = saved.message || DEFAULT_MESSAGE;
  autoFill.checked = Boolean(saved.autoFill);
  autoAdvance.checked = Boolean(saved.autoAdvance);
  queueBaseUrl.value = saved.queueBaseUrl || "http://127.0.0.1:8765";
  extensionApiToken.value = saved.extensionApiToken || "";
}

async function settings() {
  const value = {
    senderName: senderName.value.trim(),
    contactEmail: contactEmail.value.trim(),
    message: message.value.trim(),
    autoFill: autoFill.checked,
    autoAdvance: autoAdvance.checked,
    queueBaseUrl: queueBaseUrl.value.trim().replace(/\/$/, ""),
    extensionApiToken: extensionApiToken.value.trim()
  };
  await chrome.storage.local.set(value);
  return value;
}

async function fill() {
  result.textContent = "";
  const value = await settings();
  if (!value.senderName) {
    result.textContent = "Enter your sender name first.";
    senderName.focus();
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url || "")) {
    result.textContent = "Open a merchant contact page first.";
    return;
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const response = await chrome.tabs.sendMessage(tab.id, { type: "fill", settings: value });
    result.textContent = response?.filled?.length
      ? `Filled: ${response.filled.join(", ")}. Review before submitting.`
      : "No matching visible fields were found.";
  } catch (error) {
    result.textContent = "This page could not be filled.";
  }
}

async function openNext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  result.textContent = "Opening next queue site…";
  const saved = await settings();
  try {
    const response = await fetch(`${saved.queueBaseUrl}/api/next`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Extension-Token": saved.extensionApiToken },
      body: JSON.stringify({ url: tab.url || "" })
    });
    const value = await response.json();
    if (!response.ok || !value.next_url) throw new Error();
    await chrome.tabs.update(tab.id, { url: value.next_url });
    window.close();
  } catch (_) {
    result.textContent = "Could not load the next queue record.";
  }
}

document.getElementById("fill").addEventListener("click", fill);
document.getElementById("next").addEventListener("click", openNext);
[senderName, contactEmail, message, autoFill, autoAdvance, queueBaseUrl, extensionApiToken].forEach(element => element.addEventListener("change", settings));
load();
