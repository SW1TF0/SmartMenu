// ============================================================================
// contact.html — quote/contact form wiring.
// ============================================================================
import { getLang, t } from "./i18n.js?v=20261112d";
import { toast } from "./site.js?v=20261112d";

const form = document.getElementById("quoteForm");
const note = document.getElementById("quoteNote");
const serviceSelect = document.getElementById("serviceSelect");

const params = new URLSearchParams(window.location.search);
const presetService = params.get("service");
if (presetService && serviceSelect && serviceSelect.querySelector(`option[value="${CSS.escape(presetService)}"]`)) {
  serviceSelect.value = presetService;
}

// Unsent drafts survive a reload or a closed tab (this browser only).
const DRAFT_KEY = "smkj_quote_draft";
const DRAFT_FIELDS = ["name", "email", "company", "phone", "message"];
function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
  } catch (e) {
    return null;
  }
}
if (form) {
  const draft = readDraft();
  if (draft) {
    DRAFT_FIELDS.forEach((k) => {
      const el = form.elements[k];
      if (el && !el.value && typeof draft[k] === "string") el.value = draft[k];
    });
    if (!presetService && draft.service && serviceSelect && serviceSelect.querySelector(`option[value="${CSS.escape(draft.service)}"]`)) {
      serviceSelect.value = draft.service;
    }
  }
  let saveTimer = 0;
  form.addEventListener("input", () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const data = {};
      [...DRAFT_FIELDS, "service"].forEach((k) => {
        if (form.elements[k]) data[k] = form.elements[k].value;
      });
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      } catch (e) {}
    }, 300);
  });
}
const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {}
};

// Copy the phone number or email with one tap.
document.querySelectorAll("[data-copy]").forEach((btn) =>
  btn.addEventListener("click", async () => {
    const text = btn.getAttribute("data-copy");
    try {
      await navigator.clipboard.writeText(text);
      toast(`${t("copy.done")}: ${text}`);
    } catch (e) {
      window.prompt(t("copy.label"), text);
    }
  })
);

// Firebase is loaded only for sending, so the rest of the page (drafts,
// copy buttons) keeps working even if it is slow or blocked.
import("./contact.js?v=20261112d").then(({ wireContactForm }) => wireContactForm(form, {
  onSuccess: () => {
    clearDraft();
    note.textContent = {
      en: "Thanks! We'll get back to you shortly.",
      bg: "Благодарим ви! Ще се свържем с вас скоро.",
      tr: "Teşekkürler! En kısa sürede size dönüş yapacağız.",
    }[getLang()];
    note.className = "form-note show ok";
  },
  onError: (err) => {
    console.error("Lead submission failed:", err);
    note.textContent = {
      en: "Your request didn't go through. Please try again, or call us on +359 88 534 8666.",
      bg: "Запитването не беше изпратено. Опитайте отново или ни се обадете на +359 88 534 8666.",
      tr: "Talebiniz gönderilemedi. Lütfen tekrar deneyin veya bizi +359 88 534 8666 numarasından arayın.",
    }[getLang()];
    note.className = "form-note show err";
  },
})).catch((err) => {
  // Sending is unavailable: say so instead of reloading the page.
  console.error("Could not load the form sender:", err);
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    note.textContent = {
      en: "Your request didn't go through. Please try again, or call us on +359 88 534 8666.",
      bg: "Запитването не беше изпратено. Опитайте отново или ни се обадете на +359 88 534 8666.",
      tr: "Talebiniz gönderilemedi. Lütfen tekrar deneyin veya bizi +359 88 534 8666 numarasından arayın.",
    }[getLang()];
    note.className = "form-note show err";
  });
});
