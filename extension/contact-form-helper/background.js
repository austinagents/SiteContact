async function fillActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url || "")) return;
  const settings = await chrome.storage.local.get(["senderName", "contactEmail", "message"]);
  if (!settings.senderName || !settings.contactEmail || !settings.message) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  await chrome.tabs.sendMessage(tab.id, { type: "fill", settings });
}

async function openNextQueueRecord() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const settings = await chrome.storage.local.get(["queueBaseUrl"]);
  const baseUrl = (settings.queueBaseUrl || "http://127.0.0.1:8765").replace(/\/$/, "");
  try {
    const response = await fetch(`${baseUrl}/api/next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: tab.url || "" })
    });
    if (!response.ok) return;
    const result = await response.json();
    if (result.next_url) await chrome.tabs.update(tab.id, { url: result.next_url });
  } catch (_) {
    // The local queue may be closed; leave the current page untouched.
  }
}

chrome.commands.onCommand.addListener(command => {
  if (command === "fill-current-form") fillActiveTab();
  if (command === "open-next-queue-record") openNextQueueRecord();
});

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.type !== "contact-form-submitted" || !sender.tab?.id) return;
  const tabId = sender.tab.id;
  setTimeout(async () => {
    const settings = await chrome.storage.local.get(["queueBaseUrl"]);
    const baseUrl = (settings.queueBaseUrl || "http://127.0.0.1:8765").replace(/\/$/, "");
    try {
      const response = await fetch(`${baseUrl}/api/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: request.url })
      });
      if (!response.ok) return;
      const result = await response.json();
      if (result.next_url) await chrome.tabs.update(tabId, { url: result.next_url });
    } catch (_) {
      // The local queue may be closed; leave the current page untouched.
    }
  }, 3500);
});
