// 常用服務項目（取自過往報價單的「歷史提案費用」）與報價單範本。
// price 可填數字或文字區間（例如 "12,000 – 18,000"），文字區間不會計入小計。

const DEFAULT_TERMS = [
  "*確認合作則預先付訂金，訂金為總金額{訂金}%，檔案交付後再付全額",
  "*如已收付訂金開始製作後，因任何因素不採用圖稿，則訂金不予退還",
  "*若未採用的設計內容，希望可之後可使用，可以另外討論計費",
  "*若超過1次大改(與初期討論方向不同)，則需另外計費",
  "*若合作終止，提案內容可提供客戶保留，但不可公開使用或再另外進行修改",
].join("\n");

const SERVICE_LIBRARY = [
  { category: "視覺設計", content: "視覺設計", detail: "初次提案 2 案\n選定1案後續可有3次修改", unit: "式", price: 36000 },
  { category: "品牌識別設計", content: "LOGO 設計（基本）", detail: "1.前期logo ref方向（客戶可先說明希望的方向，或提供之前有看到喜歡的logo）\n2.第一次提案會依ref方向提出2款，確定方向後再進行修改，總共會有2次LOGO修改提案\n3.最後提供檔案含：1款LOGO定稿、基本應用型", unit: "式", price: 8000 },
  { category: "品牌識別設計", content: "LOGO 設計（標準）", detail: "1.前期logo ref方向（客戶可先說明希望的方向，或提供之前有看到喜歡的logo）\n2.第一次提案會依ref方向提出2-3款，確定方向後再進行修改，總共會有2次LOGO修改提案、最多可一次大改\n3.最後提供檔案含：1款LOGO定稿、標準色應用、標準字制定、基本應用型", unit: "式", price: 14000 },
  { category: "品牌識別設計", content: "LOGO 設計（完整 VIS）", detail: "1.前期logo ref方向（客戶可先說明希望的方向，或提供之前有看到喜歡的logo）\n2.第一次提案會依ref方向提出3-4款，確定方向後再進行修改，總共會有3次LOGO修改提案、最多可一次大改\n3.最後提供檔案含：1款LOGO定稿、標準色應用、標準字制定、基本應用型、平面延伸應用圖像、VIS使用規範", unit: "式", price: 20000 },
  { category: "主視覺設計", content: "主視覺設計", detail: "有2次提案，可多次修改\n第一次提案依需求出2-3款樣式\n網路露出 16:9比例 橫式、直式各1\n臉書活動頁 Banner\n實體 A1 海報", unit: "式", price: 20000 },
  { category: "海報設計", content: "系列海報設計", detail: "設定未來系列海報風格/色調/字體等\n初次提案 提出 2款\n可小修改2次", unit: "款", price: 12000 },
  { category: "海報設計", content: "延伸海報設計", detail: "以設定好的主視覺內容做延伸\n初次提案 提出 2款\n可小修改 2次", unit: "款", price: 6500 },
  { category: "社群素材設計", content: "社群素材設計", detail: "設計定案後製作後續社群素材內容\n以所選海報內容做延伸調整 各提出 1款\n可小修改 2次", unit: "式", price: 3000 },
  { category: "平面設計", content: "價目表設計", detail: "設定未來價目表 統一風格/色調/字體等\n初次提案 每項目提出 2款\n可小修改 2次", unit: "項", price: 2500 },
  { category: "手冊設計", content: "手冊設計", detail: "A4 尺寸\n封面/作品介紹2頁/團隊介紹2頁/封底", unit: "式", price: 4500 },
  { category: "包裝設計", content: "包裝結構設計", detail: "", unit: "式", price: 7000 },
  { category: "專輯裝幀設計", content: "裝幀包裝設計", detail: "1.提供前期範例方向討論風格\n2.會有2-3次提案，第一次提案依需求出2-3款樣式\n3.費用依提案數與整體設計內容物做調整\n4.超過3次修改提案，或大改(與最初討論方向不同)則費用另計\n5.若有攝影素材需求則另計", unit: "式", price: "22,000 – 38,000" },
  { category: "專輯封面設計", content: "數位封面", detail: "1.提供前期範例方向討論風格\n2.會有2-3次提案，第一次提案依需求出2-3款樣式\n3.費用依提案數與期望風格做調整\n4.超過3次修改提案，或大改(與最初討論方向不同)則費用另計\n5.若有攝影素材需求則另計", unit: "式", price: "12,000 – 18,000" },
  { category: "數位宣傳", content: "動態影片 (原封面延伸)", detail: "1.Spotify Canvas（動態短影片）\n規格： 9:16 垂直比例 時長 3-8 秒 循環（Loop）影片\n2.依據數位封面內容作動態延伸\n3.提供影片規劃提案", unit: "款", price: "4,000 – 6,000" },
  { category: "數位宣傳", content: "粉專宣傳圖（靜態）", detail: "以封面或照片素材等，去做平面排版", unit: "篇", price: "1,200 – 2,000" },
  { category: "DM設計", content: "封面設計", detail: "依需求設計新封面提出1版\n可修改2次\n尺寸：A4 (297*210mm)", unit: "頁", price: 2200 },
  { category: "DM設計", content: "新增頁面", detail: "依照既有風格或新調整內容\n新增頁面提出1版，可修改2次\n尺寸：A4 (297*210mm)", unit: "頁", price: 1800 },
  { category: "DM設計", content: "調整舊有頁面", detail: "協助舊有頁面資訊排版重新調整\n可修改2次\n尺寸：A4 (297*210mm)", unit: "頁", price: 1200 },
  { category: "實體印刷溝通", content: "印刷諮詢與廠商聯繫", detail: "協助與印刷廠討論裝訂以及材質、印刷方式，與後續看印需求", unit: "次", price: 2000, noDiscount: true },
  { category: "修改與追加", content: "第3次起修改費用", detail: "", unit: "次", price: 800, optional: true },
  { category: "修改與追加", content: "提案追加費用", detail: "適用情況：\n在初次提案希望追加不同方向設計\n後續修改中提出希望與原提案方向不同之大幅調整設計方向（包含更換構圖、風格或主要元素）", unit: "次", price: 8000, optional: true },
];

const TEMPLATES = {
  blank: {
    label: "空白報價單",
    data: {
      project: "", client: "", contact: "", contactInfo: "",
      groups: [{ name: "", items: [{ content: "", detail: "", qty: 1, unit: "式", price: "", optional: false }] }],
      subtotalLabel: "小計",
      discountLabel: "", discountRate: "",
      notes: "",
      schedule: [],
      depositPct: 35,
    },
  },
  dm: {
    label: "DM設計",
    data: {
      project: "DM設計", client: "", contact: "", contactInfo: "",
      groups: [{
        name: "DM設計",
        items: [
          { content: "新增頁面", detail: "依照既有風格或新調整內容\n新增頁面提出1版，可修改2次\n尺寸：A4 (297*210mm)", qty: 4, unit: "頁", price: 1800, optional: false },
          { content: "調整舊有頁面", detail: "協助舊有頁面資訊排版重新調整\n可修改2次\n尺寸：A4 (297*210mm)", qty: 2, unit: "頁", price: 1200, optional: false },
          { content: "第3次起修改費用", detail: "", qty: 1, unit: "次", price: 800, optional: true },
        ],
      }],
      subtotalLabel: "小計 (僅dm設計費)",
      discountLabel: "首次合作/朋友推薦 折扣\n＊僅適用設計費，後續新增修改費用及印刷諮詢不計入", discountRate: "79",
      notes: "1.提供前期風格/形式 ref 方向討論\n（客戶可先說明希望的方向，或提供之前有看到喜歡的內容）\n2.請提供完整所需文字及需使用的照片素材\n3.後續可有2次修改，第3次起修改需收修改費用\n4.完成後提供可印刷用檔案",
      schedule: [
        { start: "", end: "", title: "提供所需文字與照片素材", desc: "" },
        { start: "", end: "", title: "第一次提案", desc: "製作第一版設計" },
        { start: "", end: "", title: "第二次提案", desc: "第一版設計調整" },
        { start: "", end: "", title: "第三次提案", desc: "全部設計最終調整與確認" },
        { start: "", end: "", title: "完稿交檔", desc: "" },
      ],
      depositPct: 35,
    },
  },
  logo: {
    label: "影片 logo設計",
    data: {
      project: "影片 logo設計", client: "", contact: "", contactInfo: "",
      groups: [{
        name: "系列影片\n片頭 logo設計",
        items: [
          { content: "logo設計", detail: "1.前期 logo ref 方向（客戶可先說明希望的方向，或提供之前有看到喜歡的logo）\n2.第一次提案會依ref方向提出 3款，確定方向後再進行修改，總共會有3次 LOGO 修改提案、最多可一次大改\n3.最後提供檔案含：\n1款LOGO定稿、標準字制定、基本應用型、影片用標準色與平面延伸應用圖像、影片用簡易視覺規範", qty: 1, unit: "式", price: 25000, optional: false },
          { content: "第三次起提案修改", detail: "風格確認，僅需微調與細修", qty: 1, unit: "次", price: 1200, optional: true },
        ],
      }],
      subtotalLabel: "小計 (不含後續修改)",
      discountLabel: "", discountRate: "",
      notes: "1.提供前期風格/形式 ref 方向討論\n（客戶可先說明希望的方向，或提供之前有看到喜歡的內容）\n2.第一次提案會依ref方向提出 3款，確定方向後再進行修改\n3.第一次提案後可有2次修改提案，第3次起修改需收修改費用\n4.完成後提供 1款LOGO定稿、標準色應用、標準字制定、基本應用型、平面延伸應用圖像、簡易視覺規範",
      schedule: [
        { start: "", end: "", title: "設計師提供可參考執行的方向範例", desc: "" },
        { start: "", end: "", title: "收回與確認客戶喜歡的方向範例", desc: "" },
        { start: "", end: "", title: "第一次提案", desc: "依需求方向，製作第一版設計，提供2-3案" },
        { start: "", end: "", title: "第二次提案", desc: "依第一次提案做延伸調整" },
        { start: "", end: "", title: "第三次提案", desc: "全部設計最終調整與確認" },
        { start: "", end: "", title: "完稿交檔", desc: "" },
      ],
      depositPct: 35,
    },
  },
  album: {
    label: "專輯裝幀設計",
    data: {
      project: "專輯設計", client: "", contact: "", contactInfo: "",
      groups: [
        {
          name: "專輯裝幀設計",
          items: [
            { content: "① 裝幀包裝設計\n(以公版為主，形式未定)\n包含 外包裝 / CD / 小冊", detail: "1.提供前期範例方向討論風格與包裝形式\n2.會有3次提案，第一次提案依需求出2-3款樣式\n3.超過3次修改提案，或大改(與最初討論方向不同)則費用另計\n4.若有攝影素材需求則另計", qty: 1, unit: "式", price: 22000, optional: false },
            { content: "② 數位封面", detail: "以裝幀包裝設計為主", qty: 1, unit: "式", price: "含", optional: false },
          ],
        },
        {
          name: "實體印刷溝通",
          items: [
            { content: "印刷諮詢與廠商聯繫", detail: "協助與印刷廠討論裝訂以及材質、印刷方式，與後續看印需求", qty: 1, unit: "次", price: 2000, optional: false, noDiscount: true },
          ],
        },
      ],
      subtotalLabel: "小計",
      discountLabel: "*朋友推薦折扣", discountRate: "85",
      notes: "*請客戶協助提供完整所需文字及需使用的照片素材\n1.提供前期風格/形式 ref 方向討論\n客戶可先說明希望的方向，或提供之前有看到喜歡的內容\n*希望可以提供完整的歌詞與專輯概念，或任何相關內容\n2.第一次提案會依討論方向提出2-3款，確定方向後再進行修改\n3.第一次提案後有2次修改提案，第3次起修改需另收修改費用\n4.完成後提供1款裝幀設計完稿檔案 & 1款 數位封面供上架使用",
      schedule: [
        { start: "", end: "", title: "設計師提供可參考執行的方向範例", desc: "" },
        { start: "", end: "", title: "收回與確認客戶喜歡的方向範例", desc: "" },
        { start: "", end: "", title: "第一次提案", desc: "依需求方向，製作第一版設計，提供2-3案" },
        { start: "", end: "", title: "第二次提案", desc: "依第一次提案做延伸調整" },
        { start: "", end: "", title: "第三次提案", desc: "全部設計最終調整與確認" },
        { start: "", end: "", title: "完稿交檔", desc: "*開始與印刷廠進行討論與印製" },
      ],
      depositPct: 35,
    },
  },
};
