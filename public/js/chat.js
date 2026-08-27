(() => {
  const thread = document.getElementById("thread");
  const emptyState = document.getElementById("emptyState");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");
  const authBadge = document.getElementById("authBadge");
  const resetBtn = document.getElementById("resetBtn");

  const authModal = document.getElementById("authModal");
  const modalClose = document.getElementById("modalClose");
  const modalLoggedIn = document.getElementById("modalLoggedIn");
  const modalLoggedOut = document.getElementById("modalLoggedOut");
  const modalEmail = document.getElementById("modalEmail");
  const logoutBtn = document.getElementById("logoutBtn");
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

  let sessionId = null;
  let busy = false;
  let loginEventSource = null;
  let loginLogText = "";
  let loginCancelling = false;

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // Minimal, safe formatter: escape everything first, then re-introduce
  // ```code blocks``` and `inline code`.
  function formatText(raw) {
    const escaped = escapeHtml(raw);
    const withBlocks = escaped.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code}</code></pre>`);
    return withBlocks.replace(/`([^`\n]+)`/g, (_, code) => `<code>${code}</code>`);
  }

  function addMessage(role, text, meta) {
    emptyState.remove();
    const el = document.createElement("div");
    el.className = "msg " + role;
    el.innerHTML = `
      <div class="avatar">${role === "user" ? "U" : role === "error" ? "!" : "C"}</div>
      <div>
        <div class="bubble">${formatText(text)}</div>
        ${meta ? `<div class="meta">${meta}</div>` : ""}
      </div>
    `;
    thread.appendChild(el);
    el.scrollIntoView({ behavior: "smooth", block: "end" });
    return el;
  }

  function addTyping() {
    const el = document.createElement("div");
    el.className = "msg assistant";
    el.innerHTML = `
      <div class="avatar">C</div>
      <div class="bubble"><span class="typing"><span></span><span></span><span></span></span></div>
    `;
    thread.appendChild(el);
    el.scrollIntoView({ behavior: "smooth", block: "end" });
    return el;
  }

  async function fetchAuthStatus() {
    const r = await fetch("/auth/status");
    return r.json();
  }

  async function refreshAuth() {
    try {
      const data = await fetchAuthStatus();
      if (data.loggedIn) {
        authBadge.textContent = data.email ? `login: ${data.email}` : "login OK";
        authBadge.className = "badge ok";
      } else {
        authBadge.textContent = "belum login";
        authBadge.className = "badge bad";
      }
      return data;
    } catch {
      authBadge.textContent = "server tidak terhubung";
      authBadge.className = "badge bad";
      return { loggedIn: false };
    }
  }

  // --- login/logout modal ---

  function resetLoginPanel() {
    loginActive.classList.add("hidden");
    startLoginBtn.classList.remove("hidden");
    urlBox.classList.add("hidden");
    codeBox.classList.add("hidden");
    loginResult.className = "hidden";
    retryLoginBtn.classList.add("hidden");
    cancelLoginBtn.classList.remove("hidden");
    loginLogText = "";
    loginLogBox.textContent = "";
    loginCancelling = false;
    if (loginEventSource) {
      loginEventSource.close();
      loginEventSource = null;
    }
  }

  async function openAuthModal() {
    authModal.classList.remove("hidden");
    const status = await fetchAuthStatus().catch(() => ({ loggedIn: false }));
    if (status.loggedIn) {
      modalLoggedIn.classList.remove("hidden");
      modalLoggedOut.classList.add("hidden");
      modalEmail.textContent = status.email || "(tanpa email)";
    } else {
      modalLoggedIn.classList.add("hidden");
      modalLoggedOut.classList.remove("hidden");
      resetLoginPanel();
      try {
        const state = await (await fetch("/auth/login/state")).json();
        if (state.active) {
          startLoginBtn.classList.add("hidden");
          loginActive.classList.remove("hidden");
          connectLoginStream(state.log);
        }
      } catch { /* ignore, user can still click "Mulai Login" */ }
    }
  }

  function closeAuthModal() {
    authModal.classList.add("hidden");
  }

  function renderLoginLog() {
    loginLogBox.textContent = loginLogText;
    loginLogBox.scrollTop = loginLogBox.scrollHeight;

    const urls = loginLogText.match(/https?:\/\/\S+/g);
    if (urls && urls.length) {
      urlBox.classList.remove("hidden");
      urlLink.href = urls[urls.length - 1];
    }
    if (/paste code/i.test(loginLogText)) {
      codeBox.classList.remove("hidden");
    }
  }

  function connectLoginStream(initialLog) {
    loginLogText = initialLog || "";
    renderLoginLog();
    if (loginEventSource) loginEventSource.close();
    loginEventSource = new EventSource("/auth/login/stream");
    loginEventSource.onmessage = (e) => {
      const evt = JSON.parse(e.data);
      if (evt.type === "output") {
        loginLogText += evt.text;
        renderLoginLog();
      } else if (evt.type === "exit") {
        onLoginExit(evt.code);
      }
    };
    loginEventSource.onerror = () => {
      // connection dropped; the log we already have stays visible
    };
  }

  async function onLoginExit(code) {
    if (loginEventSource) {
      loginEventSource.close();
      loginEventSource = null;
    }
    cancelLoginBtn.classList.add("hidden");
    retryLoginBtn.classList.remove("hidden");

    if (loginCancelling) {
      loginResult.textContent = "Login dibatalkan.";
      loginResult.className = "";
      return;
    }
    if (code === 0) {
      loginResult.textContent = "Login berhasil!";
      loginResult.className = "ok";
      await refreshAuth();
      setTimeout(async () => {
        closeAuthModal();
      }, 1200);
    } else {
      loginResult.textContent = "Login gagal atau ditutup sebelum selesai. Lihat log di atas, lalu coba lagi.";
      loginResult.className = "bad";
    }
  }

  startLoginBtn.addEventListener("click", async () => {
    resetLoginPanel();
    startLoginBtn.classList.add("hidden");
    loginActive.classList.remove("hidden");
    connectLoginStream("");
    try {
      const r = await fetch("/auth/login/start", { method: "POST" });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        loginResult.textContent = data.error || "Gagal memulai login.";
        loginResult.className = "bad";
      }
    } catch (err) {
      loginResult.textContent = "Gagal memulai login: " + err.message;
      loginResult.className = "bad";
    }
  });

  retryLoginBtn.addEventListener("click", () => {
    startLoginBtn.click();
  });

  cancelLoginBtn.addEventListener("click", async () => {
    loginCancelling = true;
    await fetch("/auth/login/cancel", { method: "POST" }).catch(() => {});
  });

  codeSubmit.addEventListener("click", async () => {
    const text = codeInput.value.trim();
    if (!text) return;
    codeInput.value = "";
    await fetch("/auth/login/input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => {});
  });
  codeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      codeSubmit.click();
    }
  });

  logoutBtn.addEventListener("click", async () => {
    logoutBtn.disabled = true;
    await fetch("/auth/logout", { method: "POST" }).catch(() => {});
    logoutBtn.disabled = false;
    await refreshAuth();
    closeAuthModal();
  });

  authBadge.addEventListener("click", openAuthModal);
  modalClose.addEventListener("click", closeAuthModal);
  authModal.addEventListener("click", (e) => {
    if (e.target === authModal) closeAuthModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !authModal.classList.contains("hidden")) closeAuthModal();
  });

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
  }

  async function send() {
    const text = input.value.trim();
    if (!text || busy) return;

    busy = true;
    sendBtn.disabled = true;
    input.value = "";
    autosize();
    addMessage("user", text);
    const typingEl = addTyping();

    try {
      const r = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, sessionId: sessionId || undefined }),
      });
      const data = await r.json();
      typingEl.remove();

      if (!r.ok) {
        addMessage("error", data.error || "Terjadi kesalahan.");
      } else {
        if (data.session_id) sessionId = data.session_id;
        const meta = typeof data.total_cost_usd === "number"
          ? `$${data.total_cost_usd.toFixed(4)}`
          : "";
        addMessage("assistant", data.result ?? JSON.stringify(data), meta);
      }
    } catch (err) {
      typingEl.remove();
      addMessage("error", "Gagal menghubungi server: " + err.message);
    } finally {
      busy = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  resetBtn.addEventListener("click", () => {
    sessionId = null;
    thread.innerHTML = "";
    thread.appendChild(emptyState);
  });

  input.addEventListener("input", autosize);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  sendBtn.addEventListener("click", send);

  // Sequenced on purpose: the very first request from a fresh browser is
  // what mints its session cookie. Firing this and refreshAuth() at the
  // same time would race two cookie-less requests against each other and
  // could mint two different sessions for the same tab.
  (async () => {
    try {
      const d = await (await fetch("/whoami")).json();
      document.getElementById("uidBadge").textContent = "sesi " + d.uid.slice(0, 8);
    } catch { /* ignore */ }
    refreshAuth();
    setInterval(refreshAuth, 15000);
    input.focus();
  })();
})();
