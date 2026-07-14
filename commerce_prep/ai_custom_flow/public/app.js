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
  const mail = $("[data-mail-link]");
  if (starter) starter.href = cfg.starterCheckoutUrl;
  if (mail) mail.href = `mailto:${cfg.contactEmail}`;

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

  const meshyForm = $("[data-meshy-form]");
  const meshyStatus = $("[data-meshy-status]");
  if (meshyForm) {
    meshyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(meshyForm).entries());
      meshyStatus.textContent = "Starting Meshy preview...";
      const payload = await fetch("/api/meshy/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then((res) => res.json());
      meshyStatus.textContent = payload.ok
        ? `Meshy task ${payload.id} saved with status ${payload.status}.`
        : payload.error || "Could not start Meshy task.";
      if (payload.ok) meshyForm.reset();
    });
  }
}

setupSearch();
setupCustom();
