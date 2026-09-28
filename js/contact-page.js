// ============================================================================
// contact.html — quote/contact form wiring.
// ============================================================================
import { wireContactForm } from "./contact.js";
import { getLang } from "./i18n.js";

const form = document.getElementById("quoteForm");
const note = document.getElementById("quoteNote");
const serviceSelect = document.getElementById("serviceSelect");

const params = new URLSearchParams(window.location.search);
const presetService = params.get("service");
if (presetService && serviceSelect && serviceSelect.querySelector(`option[value="${CSS.escape(presetService)}"]`)) {
  serviceSelect.value = presetService;
}

wireContactForm(form, {
  onSuccess: () => {
    note.textContent = getLang() === "bg" ? "Благодарим ви! Ще се свържем с вас скоро." : "Thanks! We'll get back to you shortly.";
    note.className = "form-note show ok";
  },
  onError: (err) => {
    console.error("Lead submission failed:", err);
    note.textContent =
      getLang() === "bg"
        ? "Запитването не беше изпратено. Опитайте отново или ни се обадете на +359 88 534 8666."
        : "Your request didn't go through. Please try again, or call us on +359 88 534 8666.";
    note.className = "form-note show err";
  },
});
