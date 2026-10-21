(() => {
  "use strict";

  const STORE_PROFILE = "quote.profile";
  const STORE_QUOTES = "quote.saved";
  const STORE_DRAFT = "quote.draft";
  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

  const DEFAULT_PROFILE = {
    studioName: "", designer: "", phone: "", email: "",
    bankCode: "", bankAccount: "",
    terms: DEFAULT_TERMS,
    footer: "感謝支持 !! 如有問題請隨時提出",
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const storage = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    },
  };

  let profile = { ...DEFAULT_PROFILE, ...storage.get(STORE_PROFILE, {}) };
  let quote = null;

  // ---------- helpers ----------

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function newQuote(templateKey = "blank") {
    const t = TEMPLATES[templateKey] || TEMPLATES.blank;
    return { id: null, date: today(), validDays: 30, ...clone(t.data) };
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function toNumber(v) {
    if (typeof v === "number") return v;
    const s = String(v ?? "").replace(/,/g, "").trim();
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
  }

  function money(n) {
    return Math.round(n).toLocaleString("en-US");
  }

  function priceText(v) {
    const n = toNumber(v);
    return n === null ? String(v ?? "") : money(n);
  }

  // "79" → 0.79, "85" → 0.85, "9" → 0.9
  function discountRate(v) {
    const n = toNumber(v);
    if (!n || n <= 0) return null;
    const rate = n < 10 ? n / 10 : n / 100;
    return rate < 1 ? rate : null;
  }

  function parseDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  function fmtDate(s) {
    const d = parseDate(s);
    return d ? `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}` : "";
  }

  // 6/03 (三) or 6/04-08 (四~一)
  function fmtStep(start, end) {
    const a = parseDate(start);
    if (!a) return "";
    const md = (d) => `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, "0")}`;
    const b = parseDate(end);
    if (!b || b <= a) return `${md(a)} (${WEEKDAYS[a.getDay()]})`;
    const tail = a.getMonth() === b.getMonth() ? String(b.getDate()).padStart(2, "0") : md(b);
    return `${md(a)}-${tail} (${WEEKDAYS[a.getDay()]}~${WEEKDAYS[b.getDay()]})`;
  }

  function totals(q) {
    let subtotal = 0;
    let undiscounted = 0;
    let hasText = false;
    for (const g of q.groups) {
      for (const it of g.items) {
        const p = toNumber(it.price);
        if (it.optional) continue;
        if (p === null) { if (String(it.price ?? "").trim()) hasText = true; continue; }
        const amount = p * (toNumber(it.qty) ?? 1);
        subtotal += amount;
        if (it.noDiscount) undiscounted += amount;
      }
    }
    const rate = discountRate(q.discountRate);
    const total = rate ? Math.round((subtotal - undiscounted) * rate) + undiscounted : subtotal;
    const deposit = Math.round(total * (toNumber(q.depositPct) ?? 0) / 100);
    return { subtotal, rate, total, deposit, hasText };
  }

  function itemTotal(it) {
    if (it.optional) return "";
    const p = toNumber(it.price);
    return p === null ? "" : money(p * (toNumber(it.qty) ?? 1));
  }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  // ---------- preview ----------

  function renderPreview() {
    const q = quote, p = profile, t = totals(q);
    const studio = p.studioName || p.designer || "";
    const addDays = (s, n) => {
      const d = parseDate(s);
      if (!d || !n) return "";
      d.setDate(d.getDate() + Number(n));
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    };
    const kv = (rows) => rows.filter(([, v]) => v !== "" && v != null)
      .map(([k, v]) => `<div class="kv-row"><span>${k}</span><span>${v}</span></div>`).join("");

    const groups = q.groups.map((g) => `
      <div class="q-group">
        <div class="q-group-name">${esc(g.name)}</div>
        <div class="q-items">
          ${g.items.map((it) => `
            <div class="q-item${it.optional ? " is-optional" : ""}">
              <div class="q-item-main">
                <div class="q-item-title">${esc(it.content)}${it.optional ? `<span class="tag">另計</span>` : ""}${it.noDiscount ? `<span class="tag">不打折</span>` : ""}</div>
                ${it.detail ? `<div class="q-item-detail">${esc(it.detail)}</div>` : ""}
              </div>
              <div class="q-num qty">${it.content || it.price ? `${esc(it.qty)} ${esc(it.unit)}` : ""}</div>
              <div class="q-num">${esc(priceText(it.price))}</div>
              <div class="q-num">${itemTotal(it)}</div>
            </div>`).join("")}
        </div>
      </div>`).join("");

    const rate = toNumber(q.discountRate);
    const [discountTitle, ...discountNote] = (q.discountLabel || "折扣").split("\n");
    const sums = [
      `<div class="kv-row"><span>${esc(q.subtotalLabel || "小計")}</span><span>${money(t.subtotal)}</span></div>`,
      t.rate ? `<div class="kv-row"><span>${esc(discountTitle)}　${esc(String(rate))}折${discountNote.length ? `<small>${esc(discountNote.join("\n"))}</small>` : ""}</span><span>−${money(t.subtotal - t.total)}</span></div>` : "",
      `<div class="kv-row grand"><span>總計 TOTAL (NT$)</span><span>${money(t.total)}</span></div>`,
      t.deposit ? `<div class="kv-row"><span>訂金 ${esc(q.depositPct)}%</span><span>${money(t.deposit)}</span></div>` : "",
    ].join("");

    const steps = (q.schedule || []).filter((s) => s.start || s.title || s.desc);
    const terms = (p.terms || "").replaceAll("{訂金}", esc(q.depositPct ?? ""));
    const section = (label, body, sub = "") => `
      <section class="q-section">
        <h3>${label}${sub ? `<small>${sub}</small>` : ""}</h3>
        <div>${body}</div>
      </section>`;

    $("#paper").innerHTML = `
      ${studio ? `<header class="q-brand">[${esc(studio)}]</header>` : ""}

      <div class="q-title-row">
        <div>[${fmtDate(q.date)}]<br>[${esc(q.client || "客戶名稱")}]</div>
        <div>[${esc(q.project || "專案名稱")}]</div>
        <div class="q-title">報價單</div>
      </div>

      <div class="q-meta">
        <div class="q-meta-note">QUOTATION<br>此報價有效時間為${esc(q.validDays || 30)}日</div>
        <div class="kv">${kv([
          ["客戶", esc(q.client)],
          ["聯絡人", esc(q.contact)],
          ["聯絡方式", esc(q.contactInfo)],
          ["報價日期", fmtDate(q.date)],
          ["有效期限", addDays(q.date, q.validDays)],
          ["設計師", esc(p.designer)],
        ])}</div>
      </div>

      <div class="q-items-head"><span>項目</span><span>內容 / 服務細項</span><span class="q-num">數量</span><span class="q-num">單價</span><span class="q-num">總價</span></div>
      ${groups}

      <div class="q-totals">
        ${t.hasText ? `<p class="q-small">＊區間報價項目依實際內容另計，未列入小計</p>` : "<div></div>"}
        <div class="kv">${sums}</div>
      </div>

      ${q.notes ? section("備註", `<div class="pre">${esc(q.notes)}</div>`) : ""}

      ${steps.length ? section("時程安排", `<div class="q-steps">${steps.map((s) => `
          <div class="q-step">
            <span class="when">${esc(fmtStep(s.start, s.end)) || "—"}</span>
            <span><b>${esc(s.title)}</b>${s.desc ? `<span class="pre q-muted">${esc(s.desc)}</span>` : ""}</span>
          </div>`).join("")}</div>`, "時程大致安排，依實際情況再做討論調整") : ""}

      <section class="q-bottom">
        <div>
          <div class="q-pay-title">付款資訊</div>
          <div class="q-pay">
            <div>[銀行轉帳]</div>
            <div>${esc(p.bankCode) || "銀行代碼"}</div>
            <div>帳號 ${esc(p.bankAccount)}</div>
          </div>
          <div class="q-sign">
            <div>若確認無誤且接受此報價，請簽名並回傳，感謝！</div>
            <div class="q-sign-line"><span>客戶簽名</span><span></span></div>
          </div>
        </div>
        <div class="q-terms">
          <b>合作條款</b>
          <div class="pre">${terms}</div>
        </div>
      </section>

      <footer class="q-footer">
        <div>[${esc(studio)}]${p.studioName && p.designer && p.studioName !== p.designer ? `<br>${esc(p.designer)}` : ""}</div>
        <div>[電話]<br>${esc(p.phone)}</div>
        <div>[EMAIL]<br>${esc(p.email)}</div>
        <div>${esc(p.footer)}</div>
      </footer>
    `;

    const ymd = (q.date || today()).replaceAll("-", "");
    document.title = [ymd, q.project, "報價"].filter(Boolean).join("_");
  }

  // ---------- editor ----------

  function fillFields() {
    document.querySelectorAll("[data-field]").forEach((el) => { el.value = quote[el.dataset.field] ?? ""; });
    document.querySelectorAll("[data-profile]").forEach((el) => { el.value = profile[el.dataset.profile] ?? ""; });
    renderGroups();
    renderSchedule();
  }

  function libraryOptions() {
    const cats = {};
    SERVICE_LIBRARY.forEach((s, i) => { (cats[s.category] ||= []).push(`<option value="${i}">${esc(s.content)}（${esc(priceText(s.price))}）</option>`); });
    return `<option value="">從常用項目加入…</option>` +
      Object.entries(cats).map(([c, opts]) => `<optgroup label="${esc(c)}">${opts.join("")}</optgroup>`).join("");
  }

  function renderGroups() {
    const lib = libraryOptions();
    $("#groups").innerHTML = quote.groups.map((g, gi) => `
      <div class="group-card" data-gi="${gi}">
        <div class="group-head">
          <label>項目分類<textarea rows="1" data-g="name">${esc(g.name)}</textarea></label>
          <button type="button" class="icon" data-act="moveGroup" data-dir="-1" title="上移">↑</button>
          <button type="button" class="icon" data-act="moveGroup" data-dir="1" title="下移">↓</button>
          <button type="button" class="icon" data-act="delGroup" title="刪除分類">✕</button>
        </div>
        ${g.items.map((it, ii) => `
          <div class="item-card" data-ii="${ii}">
            <label class="full">內容<textarea rows="1" data-i="content">${esc(it.content)}</textarea></label>
            <label class="full">服務細項<textarea rows="3" data-i="detail">${esc(it.detail)}</textarea></label>
            <label>數量<input data-i="qty" value="${esc(it.qty)}"></label>
            <label>單位<input data-i="unit" value="${esc(it.unit)}"></label>
            <label>單價<input data-i="price" value="${esc(it.price)}" placeholder="數字或區間"></label>
            <div class="row-actions">
              <label class="check"><input type="checkbox" data-i="optional" ${it.optional ? "checked" : ""}>不計入小計（追加/修改費用）</label>
              <label class="check"><input type="checkbox" data-i="noDiscount" ${it.noDiscount ? "checked" : ""}>不打折</label>
              <button type="button" class="icon" data-act="delItem" title="刪除">✕</button>
            </div>
          </div>`).join("")}
        <div class="group-foot">
          <button type="button" class="ghost" data-act="addItem">＋ 空白項目</button>
          <select data-act="addLib">${lib}</select>
        </div>
      </div>`).join("");
  }

  function renderSchedule() {
    $("#schedule").innerHTML = (quote.schedule || []).map((s, si) => `
      <div class="step-card" data-si="${si}">
        <label>日期<input type="date" data-s="start" value="${esc(s.start)}"></label>
        <label>結束日期<input type="date" data-s="end" value="${esc(s.end)}"></label>
        <button type="button" class="icon" data-act="delStep" title="刪除" style="align-self:end">✕</button>
        <label class="full">階段<input data-s="title" value="${esc(s.title)}"></label>
        <label class="full">說明<textarea rows="1" data-s="desc">${esc(s.desc)}</textarea></label>
      </div>`).join("");
  }

  function onInput(e) {
    const el = e.target;
    if (el.dataset.field) {
      quote[el.dataset.field] = el.type === "number" ? (el.value === "" ? "" : Number(el.value)) : el.value;
    } else if (el.dataset.profile) {
      profile[el.dataset.profile] = el.value;
      storage.set(STORE_PROFILE, profile);
    } else if (el.dataset.g) {
      quote.groups[+el.closest("[data-gi]").dataset.gi][el.dataset.g] = el.value;
    } else if (el.dataset.i) {
      const it = quote.groups[+el.closest("[data-gi]").dataset.gi].items[+el.closest("[data-ii]").dataset.ii];
      it[el.dataset.i] = el.type === "checkbox" ? el.checked : el.value;
    } else if (el.dataset.s) {
      quote.schedule[+el.closest("[data-si]").dataset.si][el.dataset.s] = el.value;
    } else {
      return;
    }
    storage.set(STORE_DRAFT, quote);
    renderPreview();
  }

  function onAction(e) {
    const el = e.target.closest("[data-act]");
    if (!el || (el.tagName === "SELECT" && e.type === "click")) return;
    const gEl = el.closest("[data-gi]");
    const gi = gEl ? +gEl.dataset.gi : -1;
    switch (el.dataset.act) {
      case "addItem":
        quote.groups[gi].items.push({ content: "", detail: "", qty: 1, unit: "式", price: "", optional: false });
        break;
      case "addLib": {
        if (el.value === "") return;
        const s = SERVICE_LIBRARY[+el.value];
        const g = quote.groups[gi];
        if (!g.name && !g.items.some((it) => it.content)) { g.name = s.category; g.items = []; }
        g.items.push({ content: s.content, detail: s.detail, qty: 1, unit: s.unit, price: s.price, optional: !!s.optional, noDiscount: !!s.noDiscount });
        break;
      }
      case "delItem":
        quote.groups[gi].items.splice(+el.closest("[data-ii]").dataset.ii, 1);
        break;
      case "delGroup":
        if (quote.groups.length > 1 && !confirm("確定刪除這個項目分類？")) return;
        quote.groups.splice(gi, 1);
        if (!quote.groups.length) quote.groups.push({ name: "", items: [] });
        break;
      case "moveGroup": {
        const to = gi + +el.dataset.dir;
        if (to < 0 || to >= quote.groups.length) return;
        [quote.groups[gi], quote.groups[to]] = [quote.groups[to], quote.groups[gi]];
        break;
      }
      case "delStep":
        quote.schedule.splice(+el.closest("[data-si]").dataset.si, 1);
        break;
      default:
        return;
    }
    storage.set(STORE_DRAFT, quote);
    renderGroups();
    renderSchedule();
    renderPreview();
  }

  // ---------- saved quotes ----------

  function savedList() { return storage.get(STORE_QUOTES, []); }

  function renderSaved() {
    const list = savedList();
    $("#savedSelect").innerHTML = `<option value="">（目前編輯中）</option>` +
      list.map((q) => `<option value="${esc(q.id)}" ${q.id === quote.id ? "selected" : ""}>${esc(fmtDate(q.date))} ${esc(q.project || "未命名")}${q.client ? "｜" + esc(q.client) : ""}</option>`).join("");
  }

  function saveQuote() {
    const list = savedList();
    if (!quote.id) quote.id = Date.now().toString(36);
    const i = list.findIndex((q) => q.id === quote.id);
    if (i >= 0) list[i] = clone(quote); else list.unshift(clone(quote));
    storage.set(STORE_QUOTES, list) ? toast("已儲存在這台瀏覽器") : toast("無法儲存（瀏覽器不允許）");
    storage.set(STORE_DRAFT, quote);
    renderSaved();
  }

  function deleteQuote() {
    if (!quote.id) { toast("這份還沒儲存"); return; }
    if (!confirm("確定刪除這份已存的報價單？")) return;
    storage.set(STORE_QUOTES, savedList().filter((q) => q.id !== quote.id));
    quote.id = null;
    renderSaved();
    toast("已刪除");
  }

  function load(q) {
    quote = q;
    storage.set(STORE_DRAFT, quote);
    fillFields();
    renderSaved();
    renderPreview();
  }

  // ---------- share link (data lives in the URL, nothing is uploaded) ----------

  async function pack(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let out = bytes;
    if ("CompressionStream" in window) {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      out = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    let bin = "";
    out.forEach((b) => { bin += String.fromCharCode(b); });
    return ("CompressionStream" in window ? "z" : "j") + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function unpack(str) {
    const kind = str[0];
    const b64 = str.slice(1).replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    let data = bytes;
    if (kind === "z") {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      data = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    return JSON.parse(new TextDecoder().decode(data));
  }

  async function share() {
    const { id, ...q } = quote;
    const url = `${location.origin}${location.pathname}#v=${await pack({ q, p: profile })}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("分享連結已複製，客戶打開會看到唯讀版本");
    } catch {
      prompt("複製這個連結：", url);
    }
  }

  // ---------- import / export ----------

  function exportFile() {
    const blob = new Blob([JSON.stringify({ q: quote, p: profile }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${document.title}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importFile(file) {
    try {
      const data = JSON.parse(await file.text());
      load({ ...newQuote(), ...(data.q || data), id: null });
      toast("已匯入");
    } catch {
      toast("檔案格式不正確");
    }
  }

  // ---------- init ----------

  async function init() {
    $("#templateSelect").innerHTML = `<option value="">選擇範本開新報價單…</option>` +
      Object.entries(TEMPLATES).map(([k, t]) => `<option value="${k}">${esc(t.label)}</option>`).join("");

    const m = /#v=(.+)$/.exec(location.hash);
    if (m) {
      try {
        const data = await unpack(m[1]);
        quote = { ...newQuote(), ...data.q, id: null };
        profile = { ...DEFAULT_PROFILE, ...data.p };
        document.body.classList.add("view");
        renderPreview();
        $("#editCopyBtn").addEventListener("click", () => {
          history.replaceState(null, "", location.pathname);
          document.body.classList.remove("view");
          profile = { ...DEFAULT_PROFILE, ...storage.get(STORE_PROFILE, {}) };
          load(quote);
        });
      } catch {
        alert("這個報價單連結無法讀取，可能不完整。");
        history.replaceState(null, "", location.pathname);
      }
    }

    if (!document.body.classList.contains("view")) {
      load(storage.get(STORE_DRAFT, null) || newQuote("blank"));
    }

    const editor = $("#editor");
    editor.addEventListener("input", onInput);
    editor.addEventListener("click", onAction);
    editor.addEventListener("change", (e) => { if (e.target.dataset.act === "addLib") onAction(e); });

    $("#addGroupBtn").addEventListener("click", () => {
      quote.groups.push({ name: "", items: [{ content: "", detail: "", qty: 1, unit: "式", price: "", optional: false }] });
      renderGroups(); renderPreview();
    });
    $("#addStepBtn").addEventListener("click", () => {
      (quote.schedule ||= []).push({ start: "", end: "", title: "", desc: "" });
      renderSchedule(); renderPreview();
    });
    $("#templateSelect").addEventListener("change", (e) => {
      const k = e.target.value;
      e.target.value = "";
      if (!k) return;
      if (!confirm(`用「${TEMPLATES[k].label}」範本開新報價單？目前未儲存的內容會被取代。`)) return;
      load(newQuote(k));
    });
    $("#savedSelect").addEventListener("change", (e) => {
      const q = savedList().find((x) => x.id === e.target.value);
      if (q) load(clone(q));
    });
    $("#saveBtn").addEventListener("click", saveQuote);
    $("#deleteBtn").addEventListener("click", deleteQuote);
    $("#shareBtn").addEventListener("click", share);
    $("#exportBtn").addEventListener("click", exportFile);
    $("#importInput").addEventListener("change", (e) => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ""; });
    $("#printBtn").addEventListener("click", () => window.print());
  }

  init();
})();
