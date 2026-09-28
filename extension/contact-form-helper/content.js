(() => {
  if (globalThis.__contactFormHelperInstalled) return;
  globalThis.__contactFormHelperInstalled = true;

  const visible = element => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return !element.disabled && style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
  };

  const textFor = element => {
    const label = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`) : null;
    const wrapping = element.closest("label");
    return [
      element.name, element.id, element.placeholder, element.getAttribute("aria-label"),
      element.autocomplete, label?.textContent, wrapping?.textContent
    ].filter(Boolean).join(" ").toLowerCase();
  };

  const setValue = (element, value) => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    setter ? setter.call(element, value) : element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const candidates = () => [...document.querySelectorAll("input, textarea")].filter(element => {
    const type = (element.type || "text").toLowerCase();
    return visible(element) && !["hidden", "submit", "button", "checkbox", "radio", "file", "password", "search"].includes(type);
  });

  const best = (elements, tests) => {
    for (const test of tests) {
      const match = elements.find(element => test(element, textFor(element)));
      if (match) return match;
    }
    return null;
  };

  const fill = settings => {
    const elements = candidates();
    const used = new Set();
    const filled = [];
    const choose = tests => best(elements.filter(element => !used.has(element)), tests);
    const fillOne = (kind, value, tests) => {
      const element = choose(tests);
      if (!element || !value) return;
      setValue(element, value); used.add(element); filled.push(kind);
    };

    fillOne("name", settings.senderName, [
      (e, t) => /\b(full[ _-]?name|your[ _-]?name|contact[ _-]?name)\b/.test(t),
      (e, t) => e.autocomplete === "name",
      (e, t) => /\bname\b/.test(t) && !/company|business|product/.test(t)
    ]);
    fillOne("email", settings.contactEmail, [
      e => e.type === "email",
      (e, t) => /\be-?mail\b/.test(t)
    ]);
    fillOne("message", settings.message, [
      (e, t) => e instanceof HTMLTextAreaElement && /message|comment|inquir|enquir|question|how can we help|nachricht|mensaje|messaggio/.test(t),
      e => e instanceof HTMLTextAreaElement
    ]);

    if (filled.length) {
      globalThis.__contactFormHelperFilled = true;
      [...used][0].scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return { filled };
  };

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type !== "fill") return;
    sendResponse(fill(request.settings));
  });

  chrome.storage.local.get(["senderName", "contactEmail", "message", "autoFill"]).then(settings => {
    if (!settings.autoFill || !settings.senderName || !settings.contactEmail || !settings.message) return;
    setTimeout(() => fill(settings), 700);
  });

  document.addEventListener("submit", event => {
    if (!globalThis.__contactFormHelperFilled) return;
    chrome.storage.local.get(["autoAdvance"]).then(settings => {
      if (!settings.autoAdvance) return;
      chrome.runtime.sendMessage({ type: "contact-form-submitted", url: location.href });
    });
  }, true);
})();
