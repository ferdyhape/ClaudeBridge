(() => {
  const origin = window.location.origin;

  // Replace the {{ORIGIN}} placeholder in every code block with wherever
  // this page is actually being viewed from, so the examples always show
  // a real, working address instead of a guessed one.
  document.querySelectorAll(".code-block pre").forEach((pre) => {
    pre.textContent = pre.textContent.replaceAll("{{ORIGIN}}", origin);
  });
  const originExample = document.getElementById("originExample");
  if (originExample) originExample.textContent = origin;

  document.querySelectorAll(".code-block-copy").forEach((btn) => {
    const label = btn.querySelector("span");
    btn.addEventListener("click", async () => {
      const pre = btn.closest(".code-block").querySelector("pre");
      const ok = await copyText(pre.textContent);
      if (!label) return;
      label.textContent = ok ? "Copied" : "Select & copy manually";
      setTimeout(() => {
        label.textContent = "Copy";
      }, 1500);
    });
  });

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Shows the logged-in viewer's own live model list, if any — falls back
  // to the static "log in to see this" placeholder already in the markup
  // for a logged-out viewer or a transient fetch failure.
  const modelsList = document.getElementById("modelsList");
  if (modelsList) {
    fetch("/auth/models")
      .then((r) => r.json())
      .then((data) => {
        if (!data.models || !data.models.length) return;
        modelsList.innerHTML = data.models
          .map(
            (m) => `
              <div class="key-row">
                <span class="key-meta">
                  <span class="key-prefix">${escapeHtml(m.id)}</span>
                  <span class="key-name">${escapeHtml(m.displayName)}</span>
                </span>
              </div>`
          )
          .join("");
      })
      .catch(() => {
        /* leave the "log in to see this" placeholder as-is */
      });
  }
})();
