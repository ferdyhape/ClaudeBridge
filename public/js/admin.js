(() => {
  const rowsEl = document.getElementById("rows");
  const emptyEl = document.getElementById("empty");
  const sublineEl = document.getElementById("subline");

  function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  }

  async function load() {
    const r = await fetch("/admin/api/sessions");
    const data = await r.json();
    if (!r.ok) {
      sublineEl.textContent = "Gagal memuat: " + (data.error || r.status);
      return;
    }
    sublineEl.textContent = `${data.rows.length} sesi terdaftar · auto-hapus setelah ${data.maxIdleDays} hari tidak aktif.`;
    rowsEl.innerHTML = "";
    emptyEl.classList.toggle("hidden", data.rows.length > 0);

    for (const row of data.rows) {
      const tr = document.createElement("tr");
      if (row.id === data.currentUid) tr.className = "me";
      tr.innerHTML = `
        <td class="id">${row.id.slice(0, 8)}${row.id === data.currentUid ? " (kamu)" : ""}</td>
        <td><span class="badge ${row.logged_in ? "ok" : "bad"}">${row.logged_in ? "login" : "belum login"}</span></td>
        <td>${row.email || "—"}</td>
        <td>${row.org_name || "—"}</td>
        <td>${fmtDate(row.created_at)}</td>
        <td>${fmtDate(row.last_active_at)}</td>
        <td><button class="del" data-id="${row.id}" type="button">Hapus</button></td>
      `;
      rowsEl.appendChild(tr);
    }

    rowsEl.querySelectorAll("button.del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Hapus sesi ini? Login/kredensialnya akan di-revoke dan foldernya dihapus permanen.")) return;
        btn.disabled = true;
        await fetch("/admin/api/sessions/" + btn.dataset.id, { method: "DELETE" });
        load();
      });
    });
  }

  load();
  setInterval(load, 10000);
})();
