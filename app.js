(function () {
  const storageKey = "cardWikiData:v1";
  const builtInCards = normalizeCards(window.CARD_WIKI_DATA || []);
  let cards = loadStoredCards() || builtInCards;

  const state = {
    lang: "cn",
    type: "all",
    query: "",
    sort: "id",
    selectedId: cards[0]?.id || "",
  };

  const els = {
    langCn: document.querySelector("#langCn"),
    langEn: document.querySelector("#langEn"),
    search: document.querySelector("#searchInput"),
    csvInput: document.querySelector("#csvInput"),
    resetData: document.querySelector("#resetData"),
    importStatus: document.querySelector("#importStatus"),
    typeFilters: document.querySelector("#typeFilters"),
    sort: document.querySelector("#sortSelect"),
    grid: document.querySelector("#cardGrid"),
    empty: document.querySelector("#emptyState"),
    totalCount: document.querySelector("#totalCount"),
    visibleCount: document.querySelector("#visibleCount"),
    listTitle: document.querySelector("#listTitle"),
    detailArt: document.querySelector("#detailArt"),
    detailType: document.querySelector("#detailType"),
    detailName: document.querySelector("#detailName"),
    detailSubname: document.querySelector("#detailSubname"),
    detailEffectCn: document.querySelector("#detailEffectCn"),
    detailEffectEn: document.querySelector("#detailEffectEn"),
    detailId: document.querySelector("#detailId"),
    detailEnName: document.querySelector("#detailEnName"),
  };

  let typeOrder = getTypeOrder();

  renderTypeFilters();
  bindEvents();
  updateImportStatus(loadStoredCards() ? "已加载你上次上传的表格数据。" : "当前使用内置数据。", false);
  render();

  function bindEvents() {
    els.langCn.addEventListener("click", () => setLang("cn"));
    els.langEn.addEventListener("click", () => setLang("en"));
    els.search.addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      render();
    });
    els.sort.addEventListener("change", (event) => {
      state.sort = event.target.value;
      render();
    });
    els.csvInput.addEventListener("change", handleCsvUpload);
    els.resetData.addEventListener("click", resetData);
  }

  function setLang(lang) {
    state.lang = lang;
    els.langCn.classList.toggle("active", lang === "cn");
    els.langEn.classList.toggle("active", lang === "en");
    els.langCn.setAttribute("aria-pressed", String(lang === "cn"));
    els.langEn.setAttribute("aria-pressed", String(lang === "en"));
    els.search.placeholder = lang === "cn" ? "卡名、ID、效果文本" : "Name, ID, effect text";
    render();
  }

  function renderTypeFilters() {
    typeOrder = getTypeOrder();
    els.typeFilters.innerHTML = "";
    typeOrder.forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.type = key;
      button.textContent = key === "all" ? "全部" : getTypeLabel(key);
      button.addEventListener("click", () => {
        state.type = key;
        render();
      });
      els.typeFilters.append(button);
    });
  }

  function render() {
    const visible = getVisibleCards();
    const selected = visible.find((card) => card.id === state.selectedId) || visible[0] || cards[0];

    if (selected) {
      state.selectedId = selected.id;
    }

    els.totalCount.textContent = cards.length;
    els.visibleCount.textContent = visible.length;
    els.listTitle.textContent = state.type === "all" ? "全部卡牌" : getTypeLabel(state.type);
    els.empty.hidden = visible.length > 0;

    document.querySelectorAll("#typeFilters button").forEach((button) => {
      button.classList.toggle("active", button.dataset.type === state.type);
    });

    els.grid.innerHTML = "";
    visible.forEach((card) => els.grid.append(renderCard(card)));
    renderDetail(selected);
  }

  function handleCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || ""));
        validateCsvRows(rows);
        const importedCards = normalizeCards(rows);
        validateCards(importedCards);
        cards = importedCards;
        state.type = "all";
        state.selectedId = cards[0]?.id || "";
        localStorage.setItem(storageKey, JSON.stringify(importedCards.map(stripType)));
        renderTypeFilters();
        render();
        updateImportStatus(`已导入 ${cards.length} 张卡牌：${file.name}`, false);
      } catch (error) {
        updateImportStatus(error.message || "导入失败，请检查表格格式。", true);
      } finally {
        event.target.value = "";
      }
    };
    reader.onerror = () => updateImportStatus("读取文件失败，请重新选择 CSV。", true);
    reader.readAsText(file, "utf-8");
  }

  function resetData() {
    cards = builtInCards;
    state.type = "all";
    state.selectedId = cards[0]?.id || "";
    localStorage.removeItem(storageKey);
    renderTypeFilters();
    render();
    updateImportStatus("已恢复初始数据。", false);
  }

  function parseCsv(text) {
    const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const records = [];
    let field = "";
    let row = [];
    let inQuotes = false;

    for (let index = 0; index < normalized.length; index += 1) {
      const char = normalized[index];
      const next = normalized[index + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push(field);
        field = "";
      } else if (char === "\n" && !inQuotes) {
        row.push(field);
        records.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }

    if (field || row.length) {
      row.push(field);
      records.push(row);
    }

    const [header, ...body] = records.filter((record) => record.some((value) => value.trim()));
    if (!header) {
      throw new Error("CSV 是空的。");
    }

    const keys = header.map((key) => key.trim());
    return body.map((record) => {
      const item = {};
      keys.forEach((key, index) => {
        item[key] = (record[index] || "").trim();
      });
      return item;
    });
  }

  function normalizeCards(rows) {
    return rows.map((card) => ({
      id: String(card.id || "").trim(),
      cardname_cn: String(card.cardname_cn || "").trim(),
      cardname_en: String(card.cardname_en || "").trim(),
      cardeffect_cn: String(card.cardeffect_cn || "").trim(),
      cardeffect_en: String(card.cardeffect_en || "").trim(),
      type: getType(card.id),
    }));
  }

  function validateCards(nextCards) {
    if (!nextCards.length) {
      throw new Error("没有找到卡牌数据。");
    }

    const firstInvalid = nextCards.find((card) => !card.id || !card.cardname_cn || !card.cardname_en);
    if (firstInvalid) {
      throw new Error("存在缺少 ID、中文名或英文名的卡牌。");
    }
  }

  function validateCsvRows(rows) {
    const required = ["id", "cardname_cn", "cardname_en", "cardeffect_cn", "cardeffect_en"];
    const firstRow = rows[0] || {};
    const missing = required.filter((key) => !Object.prototype.hasOwnProperty.call(firstRow, key));
    if (missing.length) {
      throw new Error(`缺少必要字段：${missing.join(", ")}`);
    }
  }

  function loadStoredCards() {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? normalizeCards(JSON.parse(raw)) : null;
    } catch (error) {
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  function stripType(card) {
    const { type, ...rest } = card;
    return rest;
  }

  function updateImportStatus(message, isError) {
    els.importStatus.textContent = message;
    els.importStatus.classList.toggle("error", isError);
  }

  function getTypeOrder() {
    return ["all", ...Array.from(new Set(cards.map((card) => card.type.key)))];
  }

  function getVisibleCards() {
    const filtered = cards.filter((card) => {
      const matchesType = state.type === "all" || card.type.key === state.type;
      const haystack = [
        card.id,
        card.cardname_cn,
        card.cardname_en,
        card.cardeffect_cn,
        card.cardeffect_en,
      ].join(" ").toLowerCase();
      return matchesType && haystack.includes(state.query);
    });

    return filtered.sort((a, b) => {
      if (state.sort === "name") {
        return getName(a).localeCompare(getName(b), state.lang === "cn" ? "zh-Hans-CN" : "en");
      }
      return a.id.localeCompare(b.id, "en", { numeric: true });
    });
  }

  function renderCard(card) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    button.classList.toggle("selected", card.id === state.selectedId);
    button.addEventListener("click", () => {
      state.selectedId = card.id;
      render();
    });

    button.innerHTML = `
      <div class="card-top">
        <span class="card-id">${escapeHtml(card.id)}</span>
        <span class="card-type">${escapeHtml(card.type.label)}</span>
      </div>
      <h3>${escapeHtml(getName(card))}</h3>
      <div class="card-effects">
        <p>${escapeHtml(card.cardeffect_cn)}</p>
        <p class="en-effect">${escapeHtml(card.cardeffect_en)}</p>
      </div>
    `;
    return button;
  }

  function renderDetail(card) {
    if (!card) {
      return;
    }

    els.detailArt.textContent = getArtGlyph(card);
    els.detailType.textContent = card.type.label;
    els.detailName.textContent = getName(card);
    els.detailSubname.textContent = state.lang === "cn" ? card.cardname_en : card.cardname_cn;
    els.detailEffectCn.textContent = card.cardeffect_cn;
    els.detailEffectEn.textContent = card.cardeffect_en;
    els.detailId.textContent = card.id;
    els.detailEnName.textContent = card.cardname_en;
  }

  function getName(card) {
    return state.lang === "cn" ? card.cardname_cn : card.cardname_en;
  }

  function getType(id) {
    const prefix = String(id || "").replace(/[0-9+]/g, "").slice(0, 1).toUpperCase();
    const map = {
      A: { key: "action", label: "行动" },
      U: { key: "unit", label: "单位" },
      E: { key: "event", label: "事件" },
      S: { key: "spell", label: "法术" },
      P: { key: "passive", label: "被动" },
    };
    return map[prefix] || { key: "other", label: "其他" };
  }

  function getTypeLabel(key) {
    const labels = {
      action: "行动",
      unit: "单位",
      event: "事件",
      spell: "法术",
      passive: "被动",
      other: "其他",
    };
    return labels[key] || key;
  }

  function getArtGlyph(card) {
    const name = state.lang === "cn" ? card.cardname_cn : card.cardname_en;
    return name.replace("+", "").trim().slice(0, 1).toUpperCase();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
