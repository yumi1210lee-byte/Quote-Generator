// Market reference prices (TWD) for Taiwan design work, shown only in the editor.
// Rules are matched in order against "分類名稱 + 內容"; the first match wins.
// `units` lists the 單位 the range is quoted in; other units show the range without a hint.
// Re-check the sources and update `checked` about every six months.

const MARKET_SOURCES = {
  pro360Logo: { name: "PRO360 LOGO設計價格", url: "https://www.pro360.com.tw/price/logo_design", updated: "2025-07" },
  pro360Graphic: { name: "PRO360 平面設計價格", url: "https://www.pro360.com.tw/price/graphic_design", updated: "2024-07" },
  pro360Package: { name: "PRO360 包裝設計價格", url: "https://www.pro360.com.tw/price/packaging_design", updated: "2023-08" },
  pro360Cover: { name: "PRO360 封面設計價格", url: "https://www.pro360.com.tw/price/cover_design", updated: "2025-06" },
  pro360Catalog: { name: "PRO360 型錄設計價格", url: "https://www.pro360.com.tw/price/catelog_design", updated: "2023-08" },
  pro360Banner: { name: "PRO360 Banner設計價格", url: "https://www.pro360.com.tw/price/banner_design", updated: "2023-08" },
  blog104: { name: "104 平面設計報價", url: "https://blog.104.com.tw/quotation-of-graphic-design/", updated: "2021-11" },
};

const PIECE = ["式", "案", "款", "件", "張", "組"];

const MARKET_RATES = {
  checked: "2026-10-21",
  rules: [
    // No reliable public data for album work; keep it from matching 包裝 / 封面 below.
    { match: /專輯|唱片|裝幀|Spotify/i, none: true },
    { label: "CIS 企業識別", match: /CIS|企業識別/i, low: 50000, high: 200000, units: PIECE, sources: ["blog104", "pro360Logo"] },
    { label: "VIS 品牌識別", match: /VIS|品牌識別系統/i, low: 30000, high: 50000, units: PIECE, sources: ["blog104", "pro360Logo"] },
    { label: "LOGO 設計", match: /LOGO|標誌|商標設計/i, low: 10000, high: 30000, units: PIECE, sources: ["blog104", "pro360Logo"] },
    { label: "禮盒設計", match: /禮盒/, low: 10000, high: 30000, units: PIECE, sources: ["pro360Package"] },
    { label: "包裝設計", match: /包裝|盒型|結構設計/, low: 3000, high: 20000, units: PIECE, sources: ["pro360Package"] },
    { label: "貼紙・標籤", match: /貼紙|標籤/, low: 1000, high: 3000, units: PIECE, sources: ["pro360Package"] },
    { label: "海報設計", match: /海報/, low: 2500, high: 12000, units: PIECE, sources: ["pro360Graphic"] },
    { label: "DM・傳單（A4）", match: /DM|傳單|文宣/i, low: 1500, high: 5000, units: ["頁", "面", "張", "件", "款"], sources: ["pro360Graphic", "blog104"] },
    { label: "手冊・型錄內頁", match: /型錄|手冊|目錄|內頁/, low: 500, high: 1200, units: ["頁", "面"], sources: ["pro360Catalog", "blog104"] },
    { label: "書籍封面", match: /封面/, low: 700, high: 3600, units: ["面", "頁", "款", "件", "式"], sources: ["pro360Cover"] },
    { label: "名片設計", match: /名片/, low: 1500, high: 8000, units: PIECE, sources: ["pro360Graphic"] },
    { label: "社群圖・Banner", match: /社群|粉專|Banner|貼文|宣傳圖/i, low: 500, high: 3000, units: ["張", "篇", "則", "款", "件"], sources: ["pro360Banner"] },
  ],
};
