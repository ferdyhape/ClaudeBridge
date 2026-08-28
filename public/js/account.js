(() => {
  const statusArea = document.getElementById("statusArea");

  // --- tiny fetch helpers ---

  async function apiGet(path) {
    const r = await fetch(path);
    return r.json();
  }
  async function apiPost(path, body) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return r.json().catch(() => ({}));
  }
  async function apiDelete(path) {
    const r = await fetch(path, { method: "DELETE" });
    return r.json().catch(() => ({}));
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function formatDate(s) {
    if (!s) return "never used";
    return new Date(s).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  }

  function render(templateId) {
    const tpl = document.getElementById(templateId);
    statusArea.innerHTML = "";
    statusArea.appendChild(tpl.content.cloneNode(true));
  }

  // --- entry point ---

  async function refreshStatus() {
    let status;
    try {
      status = await apiGet("/auth/status");
    } catch {
      status = { loggedIn: false };
    }
    if (status.loggedIn) renderAccount(status);
    else renderLogin();
  }

  // === logged-out: login flow ============================================

  function renderLogin() {
    render("tpl-login");

    const startLoginBtn = document.getElementById("startLoginBtn");
    const loginActive = document.getElementById("loginActive");
    const loginLogBox = document.getElementById("loginLogBox");
    const urlBox = document.getElementById("urlBox");
    const urlLink = document.getElementById("urlLink");
    const codeBox = document.getElementById("codeBox");
    const codeInput = document.getElementById("codeInput");
    const codeSubmit = document.getElementById("codeSubmit");
    const cancelLoginBtn = document.getElementById("cancelLoginBtn");
    const retryLoginBtn = document.getElementById("retryLoginBtn");
    const loginResult = document.getElementById("loginResult");

    let eventSource = null;
    let logText = "";
    let cancelling = false;

    function renderLog() {
      loginLogBox.textContent = logText || "Waiting for output…";
      loginLogBox.scrollTop = loginLogBox.scrollHeight;

      const urls = logText.match(/https?:\/\/\S+/g);
      if (urls && urls.length) {
        urlBox.classList.remove("hidden");
        urlLink.href = urls[urls.length - 1];
      }
      if (/paste code/i.test(logText)) codeBox.classList.remove("hidden");
    }

    function connectStream(initialLog) {
      logText = initialLog || "";
      renderLog();
      if (eventSource) eventSource.close();
      eventSource = new EventSource("/auth/login/stream");
      eventSource.onmessage = (e) => {
        const evt = JSON.parse(e.data);
        if (evt.type === "output") {
          logText += evt.text;
          renderLog();
        } else if (evt.type === "exit") {
          onExit(evt.code);
        }
      };
    }

    function onExit(code) {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      cancelLoginBtn.classList.add("hidden");
      retryLoginBtn.classList.remove("hidden");

      if (cancelling) {
        loginResult.textContent = "Login cancelled.";
        loginResult.style.color = "var(--color-on-surface-variant)";
      } else if (code === 0) {
        loginResult.textContent = "Login successful!";
        loginResult.style.color = "var(--color-success)";
        refreshStatus();
        return;
      } else {
        loginResult.textContent = "Login failed or closed before finishing. Check the log above, then try again.";
        loginResult.style.color = "var(--color-error)";
      }
      loginResult.classList.remove("hidden");
    }

    startLoginBtn.addEventListener("click", async () => {
      startLoginBtn.classList.add("hidden");
      loginActive.classList.remove("hidden");
      loginResult.classList.add("hidden");
      cancelLoginBtn.classList.remove("hidden");
      retryLoginBtn.classList.add("hidden");
      cancelling = false;
      connectStream("");
      const res = await apiPost("/auth/login/start");
      if (res.error) {
        loginResult.textContent = res.error;
        loginResult.style.color = "var(--color-error)";
        loginResult.classList.remove("hidden");
      }
    });

    retryLoginBtn.addEventListener("click", () => startLoginBtn.click());

    cancelLoginBtn.addEventListener("click", async () => {
      cancelling = true;
      await apiPost("/auth/login/cancel").catch(() => {});
    });

    codeSubmit.addEventListener("click", async () => {
      const text = codeInput.value.trim();
      if (!text) return;
      codeInput.value = "";
      await apiPost("/auth/login/input", { text }).catch(() => {});
    });
    codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        codeSubmit.click();
      }
    });

    // Resume an in-flight login if one was already running (e.g. page reload).
    apiGet("/auth/login/state")
      .then((state) => {
        if (state.active) {
          startLoginBtn.classList.add("hidden");
          loginActive.classList.remove("hidden");
          connectStream(state.log);
        }
      })
      .catch(() => {});
  }

  // === logged-in: account info + API keys =================================

  function renderAccount(status) {
    render("tpl-account");

    document.getElementById("accountEmail").textContent = status.email || "(no email)";
    const orgEl = document.getElementById("accountOrg");
    orgEl.textContent = status.orgName ? ` · ${status.orgName}` : "";

    document.getElementById("logoutBtn").addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      await apiPost("/auth/logout").catch(() => {});
      refreshStatus();
    });

    loadApiKeys();

    document.getElementById("createApiKeyBtn").addEventListener("click", createApiKey);
    document.getElementById("apiKeyNameInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") createApiKey();
    });
  }

  async function loadApiKeys() {
    const list = document.getElementById("apiKeyList");
    if (!list) return;
    list.innerHTML = "";

    let rows = [];
    try {
      ({ rows } = await apiGet("/auth/api-keys"));
    } catch {
      list.innerHTML = `<div class="key-empty">Failed to load keys.</div>`;
      return;
    }

    if (!rows.length) {
      list.innerHTML = `<div class="key-empty">No API keys yet.</div>`;
      return;
    }

    for (const row of rows) {
      const el = document.createElement("div");
      el.className = "key-row";
      el.innerHTML = `
        <span class="key-meta">
          <span class="key-prefix">${escapeHtml(row.key_prefix)}…</span>
          <span class="key-name">${escapeHtml(row.name)}</span>
          <div class="key-used">Last used ${formatDate(row.last_used_at)}</div>
        </span>
        <button type="button" class="btn btn-ghost btn-sm" data-id="${row.id}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12"/></svg>
          Revoke
        </button>
      `;
      list.appendChild(el);
    }

    list.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Revoke this API key? Clients using it will immediately lose access.")) return;
        btn.disabled = true;
        await apiDelete(`/auth/api-keys/${btn.dataset.id}`).catch(() => {});
        loadApiKeys();
      });
    });
  }

  async function createApiKey() {
    const input = document.getElementById("apiKeyNameInput");
    const btn = document.getElementById("createApiKeyBtn");
    const box = document.getElementById("newApiKeyBox");

    btn.disabled = true;
    try {
      const created = await apiPost("/auth/api-keys", { name: input.value.trim() });
      input.value = "";
      box.classList.remove("hidden");
      box.innerHTML = `
        <div class="warn">Save this now — it won't be shown again.</div>
        <div class="key-value-row">
          <code>${escapeHtml(created.key)}</code>
          <button type="button" class="btn btn-ghost btn-sm" id="copyNewKeyBtn">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9h10v10H9V9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>
            <span>Copy</span>
          </button>
        </div>
      `;
      document.getElementById("copyNewKeyBtn").addEventListener("click", async (e) => {
        const ok = await copyText(created.key);
        e.currentTarget.querySelector("span").textContent = ok ? "Copied" : "Select & copy manually";
      });
      loadApiKeys();
    } finally {
      btn.disabled = false;
    }
  }

  refreshStatus();
})();
