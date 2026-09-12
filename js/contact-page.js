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
if (presetService && serviceSelect) serviceSelect.value = presetService;

wireContactForm(form, {
  onSuccess: () => {
    note.textContent = getLang() === "bg" ? "Благодарим ви! Ще се свържем с вас скоро." : "Thanks! We'll get back to you shortly.";
    note.className = "form-note show ok";
  },
  onError: (err) => {
    note.textContent = err.message || (getLang() === "bg" ? "Възникна грешка." : "Something went wrong.");
    note.className = "form-note show err";
  },
});
