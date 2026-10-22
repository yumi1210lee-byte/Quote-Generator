(() => {
  "use strict";

  const STORE_PROFILE = "quote.profile";
  const STORE_QUOTES = "quote.saved";
  const STORE_DRAFT = "quote.draft";
  const STORE_LIBRARY = "quote.library";
  const STORE_TEMPLATES = "quote.templates";
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
    const mine = myTemplates().find((t) => "my:" + t.id === templateKey);
    const t = mine || TEMPLATES[templateKey] || TEMPLATES.blank;
    return { id: null, date: today(), validDays: 30, ...clone(t.data) };
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // The item library starts from SERVICE_LIBRARY and then belongs to the user.
  function library() {
    let lib = storage.get(STORE_LIBRARY, null);
    if (!lib) {
      lib = SERVICE_LIBRARY.map((s, i) => ({ id: "seed" + i, ...s }));
      saveLibrary(lib);
    }
    return lib;
  }
  function saveLibrary(lib) { storage.set(STORE_LIBRARY, lib); }
  function myTemplates() { return storage.get(STORE_TEMPLATES, []); }
  function saveTemplates(list) { storage.set(STORE_TEMPLATES, list); }

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

  // ---------- market reference (market.js) ----------

  function marketRule(category, content) {
    const text = `${category || ""} ${content || ""}`;
    const r = MARKET_RATES.rules.find((x) => x.match.test(text));
    return r && !r.none ? r : null;
  }

  // [min, max] of a price that is a number or a range like "22,000 – 38,000"
  function priceSpan(v) {
    const n = toNumber(v);
    if (n !== null) return [n, n];
    const nums = (String(v ?? "").match(/\d[\d,]*/g) || []).map((x) => Number(x.replace(/,/g, "")));
    return nums.length ? [Math.min(...nums), Math.max(...nums)] : null;
  }

  // Editor-only note: market range, a flag when the price falls outside it, and the source
  function marketNote(category, it) {
    const r = marketRule(category, it.content);
    if (!r) return "";
    const unitOk = !it.unit || r.units.includes(it.unit);
    const span = priceSpan(it.price);
    let flag = "";
    if (unitOk && span && span[1] > 0) {
      if (span[1] < r.low) flag = "低於行情";
      else if (span[0] > r.high) flag = "高於行情";
    }
    const src = r.sources.map((k) => MARKET_SOURCES[k]);
    const title = `${r.label}｜${src.map((x) => `${x.name}（${x.updated}）`).join("、")}｜查詢於 ${MARKET_RATES.checked}`;
    return `<span title="${esc(title)}">市場參考 ${money(r.low)}–${money(r.high)} / ${esc(unitOk && it.unit ? it.unit : r.units[0])}${unitOk ? "" : "（單位不同，僅供參考）"}</span>` +
      (flag ? `<b class="mkt-flag">${flag}</b>` : "") +
      `<a href="${esc(src[0].url)}" target="_blank" rel="noopener" title="${esc(title)}">來源</a>`;
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

  // Amounts are [low, high] pairs so price ranges (e.g. "12,000 – 18,000") add up
  // into ranged subtotals; a fixed price is just low === high.
  function itemSpan(it) {
    if (it.optional) return null;
    const span = priceSpan(it.price);
    const qty = toNumber(it.qty) ?? 1;
    return span ? [span[0] * qty, span[1] * qty] : null;
  }

  function sumSpans(items) {
    return items.reduce((acc, it) => {
      const s = itemSpan(it);
      return s ? [acc[0] + s[0], acc[1] + s[1]] : acc;
    }, [0, 0]);
  }

  function moneySpan([lo, hi], sep = " – ") {
    return lo === hi ? money(lo) : `${money(lo)}${sep}${money(hi)}`;
  }

  function totals(q) {
    const all = q.groups.flatMap((g) => g.items);
    const subtotal = sumSpans(all);
    const undiscounted = sumSpans(all.filter((it) => it.noDiscount));
    const isRange = subtotal[0] !== subtotal[1];
    const rate = discountRate(q.discountRate);
    const apply = (i) => (rate ? Math.round((subtotal[i] - undiscounted[i]) * rate) + undiscounted[i] : subtotal[i]);
    const total = [apply(0), apply(1)];
    const pct = (toNumber(q.depositPct) ?? 0) / 100;
    const deposit = [Math.round(total[0] * pct), Math.round(total[1] * pct)];
    return { subtotal, rate, total, deposit, isRange };
  }

  function itemTotal(it) {
    const s = itemSpan(it);
    return s ? moneySpan(s, "&nbsp;–<br>") : "";
  }

  // Multi-line text with list markers. A line starting with * ＊ • - becomes a
  // bullet, "1." / "1、" / "①" keep their number; the text after the marker and
  // any following unmarked lines line up on one hanging indent.
  const LIST_MARK = /^\s*([*＊•・\-–]|\d{1,2}[.、)）]|[①-⑳])\s*/;
  function richText(text) {
    let inList = false;
    return String(text ?? "").split("\n").map((line) => {
      const m = LIST_MARK.exec(line);
      if (m) {
        inList = true;
        const mark = /^[*＊•・\-–]$/.test(m[1]) ? "•" : m[1];
        return `<div class="li"><span class="mk">${esc(mark)}</span><span>${esc(line.slice(m[0].length))}</span></div>`;
      }
      if (!line.trim()) { inList = false; return `<div class="gap"></div>`; }
      return inList
        ? `<div class="li"><span class="mk"></span><span>${esc(line)}</span></div>`
        : `<div>${esc(line)}</div>`;
    }).join("");
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
    const ymd = (q.date || today()).replaceAll("-", "");
    const addDays = (s, n) => {
      const d = parseDate(s);
      if (!d || !n) return "";
      d.setDate(d.getDate() + Number(n));
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    };
    // Bilingual label: primary in black, English in grey underneath
    const lbl = (zh, en) => `<span class="lbl">${zh}<i>${en}</i></span>`;
    const kv = (rows) => rows.filter(([, , v]) => v !== "" && v != null)
      .map(([zh, en, v]) => `<div class="kv-row">${lbl(zh, en)}<span>${v}</span></div>`).join("");

    // The quote is built as a list of blocks, then poured into A4 pages.
    // A section is split into one block per row so a long list can continue
    // on the next page; continuation blocks ("cont") repeat the title there.
    const blocks = [];
    let n = 0;
    const head = (no, title, en, meta) => `
      <div class="q-sec-head">
        <div class="q-sec-meta"><span>${no}</span><span>${meta}</span></div>
        <h2>${title}<small>${en}</small></h2>
      </div>`;
    const addSection = (title, en, meta, rows) => {
      const no = String(++n).padStart(2, "0");
      rows.forEach((row, i) => blocks.push({
        html: `<section class="q-sec${i ? " cont" : ""}">${i ? `<div class="q-sec-head"></div>` : head(no, title, en, meta)}<div class="q-sec-body">${row}</div></section>`,
        contHead: i ? head(no, title, `${en} (CONT.)`, "續") : null,
      }));
    };

    blocks.push({ html: `
      <div class="q-cards">
        <div class="card">
          <div class="dot">${esc(studio) || "STUDIO"}</div>
          <div class="card-foot">
            <div>${esc(p.designer)}</div>
            <div class="sub">${esc(p.phone)}</div>
            <div class="sub">${esc(p.email)}</div>
          </div>
        </div>
        <div class="card">
          <div class="dot">QUOTATION</div>
          <div class="card-foot">
            <div class="big">報價單</div>
            <div>${esc(q.project)}</div>
            <div class="sub">NO. ${ymd}</div>
          </div>
        </div>
        <div class="card">
          <div class="mono sub">此報價有效時間為${esc(q.validDays || 30)}日</div>
          <div class="card-foot kv">${kv([
            ["客戶", "CLIENT", esc(q.client)],
            ["聯絡人", "CONTACT", esc(q.contact)],
            ["聯絡方式", "TEL / MAIL", esc(q.contactInfo)],
            ["報價日期", "DATE", fmtDate(q.date)],
            ["有效期限", "VALID UNTIL", addDays(q.date, q.validDays)],
          ])}</div>
        </div>
      </div>` });

    const itemRows = [];
    // Category header (letter, name, category subtotal) above its numbered items
    const groupHead = (g, code) => {
      const sum = sumSpans(g.items);
      return `<div class="q-group">
        <div class="q-group-title"><span class="code">${code}</span>${esc(g.name || "未分類")}</div>
        <div class="q-group-sum">${sum[1] ? moneySpan(sum, "–") : ""}</div>
      </div>`;
    };
    q.groups.forEach((g, gi) => g.items.forEach((it, i) => itemRows.push(`
      ${i === 0 ? groupHead(g, String.fromCharCode(65 + gi)) : ""}
      <div class="q-item${it.optional ? " is-optional" : ""}">
        <div class="q-item-main">
          <span class="q-item-no">${String.fromCharCode(65 + gi)}${i + 1}</span>
          <div>
          <div class="q-item-title">${esc(it.content)}${it.optional ? `<span class="tag tag-extra">另計</span>` : ""}${it.noDiscount ? `<span class="tag tag-nodisc">不打折</span>` : ""}</div>
          ${it.detail ? `<div class="q-item-detail rich">${richText(it.detail)}</div>` : ""}
          </div>
        </div>
        <div class="q-num">${it.content || it.price ? `${esc(it.qty)} ${esc(it.unit)}` : ""}</div>
        <div class="q-num">${esc(priceText(it.price)).replace(/\s*[–~-]\s*/, "&nbsp;–<br>")}</div>
        <div class="q-num strong">${itemTotal(it) ? `→ ${itemTotal(it)}` : ""}</div>
      </div>`)));
    if (!itemRows.length) itemRows.push("");
    itemRows[0] = `<div class="q-item q-items-head"><span>內容 / 服務細項</span><span class="q-num">數量</span><span class="q-num">單價</span><span class="q-num">總價</span></div>` + itemRows[0];
    addSection("報價項目", "ITEMS", `${itemRows.length} 項`, itemRows);

    const rate = toNumber(q.discountRate);
    const [discountTitle, ...discountNote] = (q.discountLabel || "折扣").split("\n");
    addSection("金額", "AMOUNT", "NT$", [`<div class="kv sums">
      <div class="kv-row">${lbl(esc(q.subtotalLabel || "小計"), "SUBTOTAL")}<span>${moneySpan(t.subtotal)}</span></div>
      ${t.rate ? `<div class="kv-row">${lbl(`${esc(discountTitle)}　${esc(String(rate))}折`, discountNote.length ? esc(discountNote.join(" ")) : "DISCOUNT")}<span>${((d) => (d[0] === d[1] ? `−${money(d[0])}` : `−(${moneySpan(d)})`))([t.subtotal[0] - t.total[0], t.subtotal[1] - t.total[1]])}</span></div>` : ""}
      <div class="kv-row grand${t.isRange ? " is-range" : ""}">${lbl("總計", "TOTAL NT$")}<span>${moneySpan(t.total, "–")}</span></div>
      ${t.deposit[1] ? `<div class="kv-row">${lbl(`訂金 ${esc(q.depositPct)}%`, "DEPOSIT")}<span>${moneySpan(t.deposit)}</span></div>` : ""}
      ${t.isRange ? `<p class="q-note">＊含區間報價，金額以範圍表示，實際依確認的內容與規格為準</p>` : ""}
    </div>`]);

    if (q.notes) addSection("備註", "NOTES", "", [`<div class="rich">${richText(q.notes)}</div>`]);

    const steps = (q.schedule || []).filter((s) => s.start || s.title || s.desc);
    if (steps.length) {
      const rows = steps.map((s) => `
        <div class="q-step">
          <span class="mono">${esc(fmtStep(s.start, s.end)) || "—"}</span>
          <span><b>${esc(s.title)}</b>${s.desc ? `<span class="rich sub block">${richText(s.desc)}</span>` : ""}</span>
        </div>`);
      rows[0] = `<p class="q-note top">時程大致安排，依實際情況再做討論調整</p>` + rows[0];
      addSection("時程安排", "SCHEDULE", `${steps.length} 階段`, rows);
    }

    const terms = richText((p.terms || "").replaceAll("{訂金}", q.depositPct ?? ""));
    const no = () => String(++n).padStart(2, "0");
    blocks.push({ html: `
      <div class="q-cards bottom">
        <div class="card">
          <div class="mono">${no()}</div>
          <div class="card-head">付款資訊<i>PAYMENT</i></div>
          <div class="card-foot">
            <div class="sub">銀行轉帳 BANK TRANSFER</div>
            <div>${esc(p.bankCode)}</div>
            <div>${esc(p.bankAccount)}</div>
          </div>
        </div>
        <div class="card">
          <div class="mono">${no()}</div>
          <div class="card-head">確認簽名<i>SIGNATURE</i></div>
          <div class="card-foot">
            <div class="sub">若確認無誤且接受此報價，請簽名並回傳，感謝！</div>
            <div class="sign-line"></div>
            <div class="sub">客戶簽名 / 日期</div>
          </div>
        </div>
        <div class="card">
          <div class="mono">${no()}</div>
          <div class="card-head">合作條款<i>TERMS</i></div>
          <div class="card-foot terms rich">${terms}</div>
        </div>
      </div>` });

    // A client opening the share link on a phone gets one continuous, reflowed page
    // instead of shrunken A4 sheets; printing always uses the A4 layout.
    document.body.classList.toggle("reflow",
      document.body.classList.contains("view") && !document.body.classList.contains("printing") && innerWidth < 700);

    paginate(blocks, (i, total) => `
      <span>${esc(studio)}</span>
      <span>${esc(p.footer)}</span>
      <span class="page-no">PAGE ${i} / ${total}</span>`);

    document.title = [ymd, q.project, "報價"].filter(Boolean).join("_");
  }

  // Shrink the A4 sheets to fit narrow screens (phones) without changing the layout
  function fitPaper() {
    const paper = $("#paper");
    const room = paper.parentElement.clientWidth;
    const page = paper.querySelector(".page");
    paper.style.zoom = "";
    if (!page || document.body.classList.contains("reflow")) return;
    const scale = Math.min(1, room / page.offsetWidth);
    if (scale < 1) paper.style.zoom = scale.toFixed(3);
  }

  function paginate(blocks, footer) {
    const paper = $("#paper");
    paper.style.zoom = "";   // measure at full size
    paper.innerHTML = "";
    const pages = [];
    const newPage = () => {
      const page = document.createElement("div");
      page.className = "page";
      page.innerHTML = `<div class="page-body"></div><footer class="q-footer mono"></footer>`;
      paper.appendChild(page);
      pages.push(page);
      return page.firstElementChild;
    };
    const tpl = document.createElement("template");
    let body = newPage();
    for (const b of blocks) {
      tpl.innerHTML = b.html.trim();
      const el = tpl.content.firstElementChild;
      body.appendChild(el);
      if (body.scrollHeight > body.clientHeight + 1 && body.children.length > 1) {
        el.remove();
        body = newPage();
        body.appendChild(el);
      }
      // A continued section that opens a page gets its title back
      if (b.contHead && body.firstElementChild === el) {
        el.classList.remove("cont");
        el.querySelector(".q-sec-head").outerHTML = b.contHead;
      }
    }
    pages.forEach((page, i) => { page.lastElementChild.innerHTML = footer(i + 1, pages.length); });
    fitPaper();
  }

  // ---------- editor ----------

  function fillFields() {
    document.querySelectorAll("[data-field]").forEach((el) => { el.value = quote[el.dataset.field] ?? ""; });
    document.querySelectorAll("[data-profile]").forEach((el) => { el.value = profile[el.dataset.profile] ?? ""; });
    renderGroups();
    renderSchedule();
  }

  function renderGroups() {
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
            <div class="mkt full" data-mkt>${marketNote(g.name, it)}</div>
            <div class="row-actions">
              <label class="check"><input type="checkbox" data-i="optional" ${it.optional ? "checked" : ""}>不計入小計（追加/修改費用）</label>
              <label class="check"><input type="checkbox" data-i="noDiscount" ${it.noDiscount ? "checked" : ""}>不打折</label>
              <button type="button" class="icon" data-act="saveToLib" title="存成常用項目">存入品項庫</button>
              <button type="button" class="icon" data-act="delItem" title="刪除">✕</button>
            </div>
          </div>`).join("")}
        <div class="group-foot">
          <button type="button" class="ghost" data-act="addItem">＋ 空白項目</button>
          <button type="button" data-act="pickLib">＋ 從品項庫加入</button>
        </div>
      </div>`).join("");
  }

  function refreshMarket(gi) {
    const g = quote.groups[gi];
    $("#groups").querySelectorAll(`[data-gi="${gi}"] [data-ii]`).forEach((row) => {
      row.querySelector("[data-mkt]").innerHTML = marketNote(g.name, g.items[+row.dataset.ii]);
    });
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
      refreshMarket(+el.closest("[data-gi]").dataset.gi);
    } else if (el.dataset.i) {
      const it = quote.groups[+el.closest("[data-gi]").dataset.gi].items[+el.closest("[data-ii]").dataset.ii];
      it[el.dataset.i] = el.type === "checkbox" ? el.checked : el.value;
      refreshMarket(+el.closest("[data-gi]").dataset.gi);
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
    if (!el) return;
    const gEl = el.closest("[data-gi]");
    const gi = gEl ? +gEl.dataset.gi : -1;
    switch (el.dataset.act) {
      case "addItem":
        quote.groups[gi].items.push({ content: "", detail: "", qty: 1, unit: "式", price: "", optional: false });
        break;
      case "pickLib":
        openLibrary(gi);
        return;
      case "saveToLib":
        saveItemToLibrary(quote.groups[gi], quote.groups[gi].items[+el.closest("[data-ii]").dataset.ii]);
        return;
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

  // Leave out empty fields and default profile text so share links stay shorter;
  // the reader fills them back in from the same defaults.
  function compact(v) {
    if (Array.isArray(v)) return v.map(compact);
    if (v && typeof v === "object") {
      const out = {};
      for (const [k, x] of Object.entries(v)) if (x !== "" && x !== false && x != null) out[k] = compact(x);
      return out;
    }
    return v;
  }

  async function share() {
    const { id, ...q } = quote;
    const p = Object.fromEntries(Object.entries(profile).filter(([k, v]) => v !== DEFAULT_PROFILE[k]));
    const url = `${location.origin}${location.pathname}#v=${await pack({ q: compact(q), p: compact(p) })}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("分享連結已複製，客戶打開會看到唯讀版本");
    } catch {
      prompt("複製這個連結：", url);
    }
  }

  // ---------- import / export ----------

  function exportFile() {
    const data = { q: quote, p: profile, library: library(), templates: myTemplates() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${document.title}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importFile(file) {
    try {
      const data = JSON.parse(await file.text());
      if ((data.library || data.templates) && confirm("這個檔案也有品項庫和範本，要一起匯入嗎？（會合併到現有的，不會刪除）")) {
        const merge = (mine, theirs) => [...mine.filter((x) => !theirs.some((y) => y.id === x.id)), ...theirs];
        if (data.library) saveLibrary(merge(library(), data.library));
        if (data.templates) saveTemplates(merge(myTemplates(), data.templates));
        renderTemplateSelect();
      }
      load({ ...newQuote(), ...(data.q || data), id: null });
      toast("已匯入");
    } catch {
      toast("檔案格式不正確");
    }
  }

  // ---------- item library & my templates ----------

  let pickTarget = -1;    // group index items are added to; -1 = just managing
  let libTab = "items";
  let libCategory = "";
  let editingId = null;

  function renderTemplateSelect() {
    const mine = myTemplates();
    $("#templateSelect").innerHTML = `<option value="">選擇範本開新報價單…</option>
      <optgroup label="內建範本">${Object.entries(TEMPLATES).map(([k, t]) => `<option value="${k}">${esc(t.label)}</option>`).join("")}</optgroup>
      ${mine.length ? `<optgroup label="我的範本">${mine.map((t) => `<option value="my:${esc(t.id)}">${esc(t.label)}</option>`).join("")}</optgroup>` : ""}`;
  }

  function openLibrary(gi) {
    pickTarget = gi;
    libTab = "items";
    libCategory = "";
    editingId = null;
    $("#libSearch").value = "";
    renderLibrary();
    $("#libDialog").showModal();
    if (gi >= 0) $("#libSearch").focus();
  }

  function itemForm(it) {
    const cats = [...new Set(library().map((x) => x.category).filter(Boolean))];
    return `
      <form class="lib-form" data-id="${esc(it.id || "")}" onsubmit="return false">
        <label>分類<input name="category" list="libCats" value="${esc(it.category)}" required></label>
        <label>內容<input name="content" value="${esc(it.content)}" required></label>
        <label class="full">服務細項<textarea name="detail" rows="4">${esc(it.detail)}</textarea></label>
        <label>單位<input name="unit" value="${esc(it.unit || "式")}"></label>
        <label>單價<input name="price" value="${esc(it.price)}" placeholder="數字或區間"></label>
        <label class="check full"><input type="checkbox" name="optional" ${it.optional ? "checked" : ""}>不計入小計</label>
        <label class="check full"><input type="checkbox" name="noDiscount" ${it.noDiscount ? "checked" : ""}>不打折</label>
        <div class="full lib-form-actions">
          <button type="button" class="ghost" data-lib="cancel">取消</button>
          <button type="button" data-lib="saveItem">儲存品項</button>
        </div>
        <datalist id="libCats">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
      </form>`;
  }

  function renderLibrary() {
    const dlg = $("#libDialog");
    dlg.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === libTab));
    $("#libTitle").textContent = pickTarget >= 0 ? `加入到「${quote.groups[pickTarget]?.name || "這個分類"}」` : "品項庫與範本";
    dlg.classList.toggle("tab-templates", libTab === "templates");

    if (libTab === "templates") {
      const list = myTemplates();
      $("#libList").innerHTML = list.length ? list.map((t) => `
        <div class="lib-row" data-id="${esc(t.id)}">
          <div class="lib-main"><b>${esc(t.label)}</b>
            <span class="lib-sub">${t.data.groups.reduce((n, g) => n + g.items.length, 0)} 個品項</span></div>
          <div class="lib-actions">
            <button type="button" data-lib="useTpl">套用</button>
            <button type="button" class="ghost" data-lib="renameTpl">改名</button>
            <button type="button" class="ghost" data-lib="delTpl">刪除</button>
          </div>
        </div>`).join("") : `<p class="lib-empty">還沒有自己的範本。編輯好一份報價單後，按上方工具列的「另存為範本」就會出現在這裡。</p>`;
      $("#libCatsBar").innerHTML = "";
      return;
    }

    const lib = library();
    const kw = $("#libSearch").value.trim().toLowerCase();
    const cats = [...new Set(lib.map((x) => x.category || "其他"))];
    if (libCategory && !cats.includes(libCategory)) libCategory = "";
    $("#libCatsBar").innerHTML = ["", ...cats].map((c) =>
      `<button type="button" class="chip${c === libCategory ? " on" : ""}" data-lib="cat" data-cat="${esc(c)}">${c ? esc(c) : "全部"}</button>`).join("");

    const shown = lib.filter((x) => (!libCategory || (x.category || "其他") === libCategory) &&
      (!kw || [x.category, x.content, x.detail].join(" ").toLowerCase().includes(kw)));

    $("#libList").innerHTML = (editingId === "new" ? itemForm({ category: libCategory }) : "") +
      (shown.length ? shown.map((x) => editingId === x.id ? itemForm(x) : `
        <div class="lib-row" data-id="${esc(x.id)}">
          <div class="lib-main">
            <span class="lib-sub">${esc(x.category)}</span>
            <b>${esc(x.content)}</b>
            ${x.detail ? `<span class="lib-detail">${esc(x.detail)}</span>` : ""}
            <span class="mkt">${marketNote(x.category, x)}</span>
          </div>
          <div class="lib-price">${esc(priceText(x.price))}${x.unit ? ` / ${esc(x.unit)}` : ""}</div>
          <div class="lib-actions">
            ${pickTarget >= 0 ? `<button type="button" data-lib="add">加入</button>` : ""}
            <button type="button" class="ghost" data-lib="edit">編輯</button>
            <button type="button" class="ghost" data-lib="del">刪除</button>
          </div>
        </div>`).join("") : `<p class="lib-empty">找不到符合的品項。可以按「＋ 新增品項」加進品項庫。</p>`);
  }

  function readItemForm(form) {
    const f = form.elements;
    const price = f.price.value.trim();
    return {
      category: f.category.value.trim() || "其他",
      content: f.content.value.trim(),
      detail: f.detail.value,
      unit: f.unit.value.trim(),
      price: toNumber(price) ?? price,
      optional: f.optional.checked,
      noDiscount: f.noDiscount.checked,
    };
  }

  function addToQuote(x) {
    const g = quote.groups[pickTarget];
    if (!g) return;
    if (!g.name && !g.items.some((it) => it.content)) { g.name = x.category; g.items = []; }
    g.items.push({ content: x.content, detail: x.detail, qty: 1, unit: x.unit, price: x.price, optional: !!x.optional, noDiscount: !!x.noDiscount });
    storage.set(STORE_DRAFT, quote);
    renderGroups();
    renderPreview();
    toast(`已加入「${x.content}」`);
  }

  function onLibraryClick(e) {
    const btn = e.target.closest("[data-lib]");
    if (!btn) return;
    const row = btn.closest("[data-id]");
    const id = row?.dataset.id;
    let lib = library();
    const x = lib.find((i) => i.id === id);
    switch (btn.dataset.lib) {
      case "tab": libTab = btn.dataset.tab; editingId = null; break;
      case "cat": libCategory = btn.dataset.cat; break;
      case "new": libTab = "items"; editingId = "new"; break;
      case "cancel": editingId = null; break;
      case "add": addToQuote(x); return;
      case "edit": editingId = id; break;
      case "del":
        if (!confirm(`從品項庫刪除「${x.content}」？已做好的報價單不受影響。`)) return;
        saveLibrary(lib.filter((i) => i.id !== id));
        break;
      case "saveItem": {
        const form = btn.closest("form");
        const item = readItemForm(form);
        if (!item.content) { toast("請填寫內容"); return; }
        if (form.dataset.id) lib = lib.map((i) => (i.id === form.dataset.id ? { ...i, ...item } : i));
        else lib.push({ id: uid(), ...item });
        saveLibrary(lib);
        editingId = null;
        toast("品項庫已更新");
        break;
      }
      case "useTpl": {
        if (!confirm("用這個範本開新報價單？目前未儲存的內容會被取代。")) return;
        load(newQuote("my:" + id));
        $("#libDialog").close();
        return;
      }
      case "renameTpl": {
        const list = myTemplates();
        const t = list.find((i) => i.id === id);
        const name = prompt("範本名稱", t.label);
        if (!name) return;
        t.label = name.trim();
        saveTemplates(list);
        renderTemplateSelect();
        break;
      }
      case "delTpl":
        if (!confirm("刪除這個範本？")) return;
        saveTemplates(myTemplates().filter((i) => i.id !== id));
        renderTemplateSelect();
        break;
      case "close": $("#libDialog").close(); return;
      default: return;
    }
    renderLibrary();
  }

  function saveItemToLibrary(g, it) {
    if (!String(it.content).trim()) { toast("請先填寫內容"); return; }
    const category = prompt("要放在品項庫的哪個分類？", g.name.split("\n")[0] || "其他");
    if (category === null) return;
    const lib = library();
    const item = {
      category: category.trim() || "其他", content: it.content.trim(), detail: it.detail, unit: it.unit,
      price: toNumber(it.price) ?? it.price, optional: !!it.optional, noDiscount: !!it.noDiscount,
    };
    const same = lib.find((x) => x.category === item.category && x.content === item.content);
    if (same) {
      if (!confirm(`品項庫已經有「${item.content}」，要用這次的內容和價格更新它嗎？`)) return;
      Object.assign(same, item);
    } else {
      lib.push({ id: uid(), ...item });
    }
    saveLibrary(lib);
    toast(`已存入品項庫：${item.category}／${item.content}`);
  }

  function saveAsTemplate() {
    const name = prompt("範本名稱（客戶資料和日期不會存進範本）", quote.project || "");
    if (!name) return;
    const { id, date, client, contact, contactInfo, ...data } = clone(quote);
    const list = myTemplates();
    const same = list.find((t) => t.label === name.trim());
    if (same && !confirm(`已經有「${same.label}」範本，要覆蓋嗎？`)) return;
    if (same) same.data = data;
    else list.push({ id: uid(), label: name.trim(), data });
    saveTemplates(list);
    renderTemplateSelect();
    toast(`已存成範本「${name.trim()}」`);
  }

  function initLibraryDialog() {
    const dlg = $("#libDialog");
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) dlg.close();   // click on backdrop
      else onLibraryClick(e);
    });
    $("#libSearch").addEventListener("input", () => { libTab = "items"; libCategory = ""; renderLibrary(); });
  }

  // ---------- init ----------

  async function init() {
    renderTemplateSelect();

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
      const label = e.target.querySelector(`option[value="${CSS.escape(k)}"]`).textContent;
      if (!confirm(`用「${label}」範本開新報價單？目前未儲存的內容會被取代。`)) return;
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
    $("#libraryBtn").addEventListener("click", () => openLibrary(-1));
    $("#saveTplBtn").addEventListener("click", saveAsTemplate);
    initLibraryDialog();
  }

  init();
  let resizeTimer, lastWidth = innerWidth;
  window.addEventListener("resize", () => {
    if (innerWidth === lastWidth) return;   // e.g. a phone's address bar showing/hiding
    lastWidth = innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (quote) renderPreview(); }, 150);
  });
  window.addEventListener("beforeprint", () => { document.body.classList.add("printing"); if (quote) renderPreview(); });
  window.addEventListener("afterprint", () => { document.body.classList.remove("printing"); if (quote) renderPreview(); });
  if (document.fonts) document.fonts.ready.then(() => { if (quote) renderPreview(); });
})();
