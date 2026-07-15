const $ = (selector, root = document) => root.querySelector(selector);

async function config() {
  const res = await fetch("/api/config");
  return res.json();
}

function renderResults(target, payload) {
  if (!target) return;
  if (payload.shouldRedirectToCustom) {
    target.innerHTML = '<div class="empty">No close match yet. Opening the custom design page...</div>';
    window.setTimeout(() => {
      window.location.href = `/custom?q=${encodeURIComponent(payload.query)}`;
    }, 850);
    return;
  }
  if (!payload.results.length) {
    target.innerHTML = '<div class="empty">Search for a product idea to see matches.</div>';
    return;
  }
  target.innerHTML = payload.results
    .map(
      (item) => `
        <article class="result-card">
          ${item.image ? `<img src="${item.image}" alt="${item.title}">` : ""}
          <div>
            <h3>${item.title}</h3>
            <p>${item.categories || "Made-to-order 3D print"}${item.price ? ` · $${item.price}` : ""}</p>
            <a class="button" href="${item.url}">View product</a>
          </div>
        </article>
      `,
    )
    .join("");
}

async function setupSearch() {
  const form = $("[data-search-form]");
  const input = $("[data-search-input]");
  const results = $("[data-results]");
  if (!form || !input || !results) return;
  const initial = new URLSearchParams(window.location.search).get("q") || "";
  if (initial) {
    input.value = initial;
    const payload = await fetch(`/api/catalog/search?q=${encodeURIComponent(initial)}`).then((res) => res.json());
    renderResults(results, payload);
  } else {
    renderResults(results, { results: [] });
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    results.innerHTML = '<div class="empty">Searching the shop...</div>';
    const payload = await fetch(`/api/catalog/search?q=${encodeURIComponent(q)}`).then((res) => res.json());
    renderResults(results, payload);
  });
}

async function setupCustom() {
  const cfg = await config();
  const starter = $("[data-starter-link]");
  const starterNote = $("[data-starter-note]");
  const mailLinks = document.querySelectorAll("[data-mail-link]");
  if (starter && cfg.starterCheckoutConfigured && cfg.starterCheckoutUrl) {
    starter.href = cfg.starterCheckoutUrl;
    starter.hidden = false;
  } else if (starter) {
    starter.hidden = true;
    if (starterNote) starterNote.hidden = false;
  }
  mailLinks.forEach((mail) => {
    mail.href = `mailto:${cfg.contactEmail}`;
  });

  const requestForm = $("[data-custom-form]");
  const requestStatus = $("[data-form-status]");
  if (requestForm) {
    requestForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(requestForm).entries());
      requestStatus.textContent = "Sending request...";
      const payload = await fetch("/api/custom-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then((res) => res.json());
      requestStatus.textContent = payload.ok
        ? `Request received. We will reply from ${payload.contactEmail}.`
        : payload.error || "Could not send request.";
      if (payload.ok) requestForm.reset();
    });
  }

  const paymentForm = $("[data-payment-form]");
  const paymentStatus = $("[data-payment-status]");
  const designPanel = $("[data-design-panel]");
  const lockMessage = $("[data-lock-message]");
  const meshyForm = $("[data-meshy-form]");
  const meshyStatus = $("[data-meshy-status]");
  const imageInput = meshyForm?.querySelector('input[name="referenceImage"]');
  const imagePreview = $("[data-image-preview]");
  const finishBox = $("[data-finish-box]");
  let verifiedPayment = null;

  function unlockDesign(verification) {
    verifiedPayment = verification;
    if (designPanel) designPanel.classList.remove("locked");
    if (lockMessage) {
      lockMessage.textContent = `Payment verified for order ${verification.orderNumber}. Add your prompt and optional image reference.`;
    }
    if (meshyForm) {
      meshyForm.hidden = false;
      const emailField = paymentForm?.elements.email;
      if (emailField && !meshyForm.dataset.email) meshyForm.dataset.email = emailField.value;
    }
  }

  if (paymentForm) {
    paymentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(paymentForm).entries());
      paymentStatus.textContent = "Checking your Squarespace order...";
      const response = await fetch("/api/custom-payment/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!payload.ok) {
        paymentStatus.textContent = payload.error || `Could not verify payment. Contact ${payload.contactEmail || cfg.contactEmail}.`;
        return;
      }
      paymentStatus.textContent = "Payment verified. Your AI preview is unlocked.";
      unlockDesign(payload);
    });
  }

  if (imageInput && imagePreview) {
    imageInput.addEventListener("change", () => {
      const file = imageInput.files?.[0];
      if (!file) {
        imagePreview.hidden = true;
        imagePreview.textContent = "";
        return;
      }
      imagePreview.hidden = false;
      imagePreview.textContent = `Reference image selected: ${file.name}`;
    });
  }

  if (meshyForm) {
    meshyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!verifiedPayment?.verificationToken) {
        meshyStatus.textContent = "Please verify your payment before starting the preview.";
        return;
      }
      const formData = new FormData(meshyForm);
      const image = formData.get("referenceImage");
      const body = {
        prompt: String(formData.get("prompt") || ""),
        email: verifiedPayment.email,
        paymentConfirmation: verifiedPayment.orderNumber,
        paymentVerificationToken: verifiedPayment.verificationToken,
        referenceImageName: image?.name || "",
      };
      meshyStatus.textContent = "Starting Meshy preview...";
      const payload = await fetch("/api/meshy/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then((res) => res.json());
      meshyStatus.textContent = payload.ok
        ? `Meshy task ${payload.id} saved with status ${payload.status}.`
        : payload.error || "Could not start Meshy task.";
      if (payload.ok) {
        meshyForm.reset();
        if (imagePreview) imagePreview.hidden = true;
        if (finishBox) finishBox.hidden = false;
        for (let attempts = 0; attempts < 8; attempts += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 2500));
          const statusPayload = await fetch(`/api/meshy/status/${encodeURIComponent(payload.id)}`).then((res) => res.json());
          const status = statusPayload.status || statusPayload.task?.status || statusPayload.task?.result?.status || "submitted";
          meshyStatus.textContent = `Meshy task ${payload.id}: ${status}. Continue by contacting us to finish.`;
          if (/succeed|complete|failed|error/i.test(status)) break;
        }
      }
    });
  }
}

setupSearch();
setupCustom();
