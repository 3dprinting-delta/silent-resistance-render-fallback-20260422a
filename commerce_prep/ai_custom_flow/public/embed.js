(function () {
  const script = document.currentScript;
  const base = script?.dataset.baseUrl || "http://localhost:8795";
  const target = document.querySelector(script?.dataset.target || "#augnach-ai-search");
  if (!target) return;

  target.innerHTML = `
    <style>
      #augnach-ai-search{display:block;width:92vw;max-width:1120px}
      .aa-search{box-sizing:border-box;width:100%;border:1px solid #ded2c2;border-radius:8px;padding:18px;background:#fffaf4;color:#1c1917;font-family:Inter,system-ui,sans-serif;box-shadow:0 10px 28px rgba(28,25,23,.08)}
      .aa-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
      .aa-search input,.aa-search button{box-sizing:border-box;border:1px solid #ded2c2;border-radius:8px;min-height:52px;padding:12px 14px;font:inherit}
      .aa-search input{font-size:16px;width:100%}
      .aa-search button{background:#177c72;color:white;font-weight:800;cursor:pointer}
      .aa-results{display:grid;gap:10px;margin-top:12px}
      .aa-card{border-top:1px solid #ded2c2;padding-top:10px}
      .aa-card a{color:#0f5f58;font-weight:800}
      @media(max-width:640px){#augnach-ai-search{width:calc(100vw - 32px)}.aa-row{grid-template-columns:1fr}}
    </style>
    <div class="aa-search">
      <form class="aa-row">
        <input type="search" placeholder="Search 3D prints or describe your idea">
        <button>Search</button>
      </form>
      <div class="aa-results"></div>
    </div>
  `;

  const form = target.querySelector("form");
  const input = target.querySelector("input");
  const results = target.querySelector(".aa-results");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    results.textContent = "Searching...";
    const payload = await fetch(`${base}/api/catalog/search?q=${encodeURIComponent(q)}`).then((res) => res.json());
    if (payload.shouldRedirectToCustom) {
      window.location.href = `/custom?q=${encodeURIComponent(q)}`;
      return;
    }
    results.innerHTML = payload.results
      .map((item) => `<div class="aa-card"><a href="${item.url}">${item.title}</a><br><span>${item.categories || "3D printed item"}</span></div>`)
      .join("") || '<div class="aa-card">No match yet. <a href="/custom">Start a custom request</a>.</div>';
  });
})();
