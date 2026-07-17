/* ===================================================================
   APP.JS — UI wiring and orchestration. No network calls.
   =================================================================== */

const GROUP_CLASS = {
  "Heading / Structure": "g-heading",
  "Structure": "g-structure",
  "Character": "g-character",
  "Word": "g-word",
  "Special (review)": "g-special",
};

const GROUP_OPTIONS = Object.keys(GROUP_CLASS);

let rules = [];
let debounceTimer = null;
let localFileHandle = null; // only used if the File System Access API is available
let draggedIndex = null; // index of the rule row currently being dragged

const el = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ */
/* Init                                                                 */
/* ------------------------------------------------------------------ */
(async function init() {
  rules = await loadRules();
  renderRulesTable();
  wireEvents();
  detectFileSystemAccessSupport();
  transform(); // run once on load (empty input -> empty output)
})();

/* ------------------------------------------------------------------ */
/* Rules table rendering                                                */
/* ------------------------------------------------------------------ */
function renderRulesTable() {
  const tbody = el("rulesTbody");
  tbody.innerHTML = "";

  rules.forEach((rule, index) => {
    const tr = document.createElement("tr");
    tr.dataset.index = index;
    if (!rule.enabled) tr.classList.add("disabled-row");
    if (rule.grupo === "Special (review)") tr.classList.add("group-special");
    if (rule.descricao) tr.title = rule.descricao;

    // Drag handle + move up/down
    const tdDrag = document.createElement("td");
    tdDrag.className = "drag-cell";
    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.textContent = "⠿";
    handle.title = "Drag to reorder";
    tdDrag.appendChild(handle);

    const controls = document.createElement("div");
    controls.className = "reorder-controls";
    const upBtn = document.createElement("button");
    upBtn.className = "move-btn";
    upBtn.textContent = "▲";
    upBtn.title = "Move up";
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", () => moveRule(index, index - 1));
    const downBtn = document.createElement("button");
    downBtn.className = "move-btn";
    downBtn.textContent = "▼";
    downBtn.title = "Move down";
    downBtn.disabled = index === rules.length - 1;
    downBtn.addEventListener("click", () => moveRule(index, index + 1));
    controls.appendChild(upBtn);
    controls.appendChild(downBtn);
    tdDrag.appendChild(controls);
    tr.appendChild(tdDrag);

    // Native HTML5 drag-and-drop (row-level), grabbed only via the handle
    tr.draggable = false;
    handle.addEventListener("mousedown", () => { tr.draggable = true; });
    tr.addEventListener("dragend", () => {
      tr.draggable = false;
      tr.classList.remove("dragging");
      clearDropIndicators();
    });
    tr.addEventListener("dragstart", (e) => {
      draggedIndex = index;
      tr.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    });
    tr.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;
      const rect = tr.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      clearDropIndicators();
      tr.classList.add(before ? "drop-target-above" : "drop-target-below");
      tr.dataset.dropBefore = before ? "1" : "0";
    });
    tr.addEventListener("drop", (e) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;
      const before = tr.dataset.dropBefore === "1";
      // Convert "drop before/after this row's original position" into the
      // row's final index (it shifts left by 1 if the dragged item came from
      // an earlier position), then offset by 1 more if dropping after it.
      const targetFinalPos = draggedIndex < index ? index - 1 : index;
      const toIndexFinal = before ? targetFinalPos : targetFinalPos + 1;
      moveRule(draggedIndex, toIndexFinal);
      draggedIndex = null;
      clearDropIndicators();
    });

    // Group (editable dropdown)
    const tdGroup = document.createElement("td");
    tdGroup.className = "col-group";
    const select = document.createElement("select");
    select.className = "group-select badge-group " + (GROUP_CLASS[rule.grupo] || "g-character");
    GROUP_OPTIONS.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if (opt === rule.grupo) o.selected = true;
      select.appendChild(o);
    });
    select.addEventListener("change", () => {
      rule.grupo = select.value;
      persist();
      renderRulesTable(); // re-render so colors and the "Special" row highlight update
    });
    tdGroup.appendChild(select);
    tr.appendChild(tdGroup);

    // Find
    const tdFind = document.createElement("td");
    tdFind.className = "col-find";
    tdFind.appendChild(makeAutoTextarea(rule.find, (val) => { rule.find = val; }));
    tr.appendChild(tdFind);

    // Replace with
    const tdReplace = document.createElement("td");
    tdReplace.className = "col-replace";
    tdReplace.appendChild(makeAutoTextarea(rule.replace, (val) => { rule.replace = val; }));
    tr.appendChild(tdReplace);

    // On (enabled)
    const tdEnabled = document.createElement("td");
    tdEnabled.className = "col-enabled";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!rule.enabled;
    cb.addEventListener("change", () => {
      rule.enabled = cb.checked;
      tr.classList.toggle("disabled-row", !rule.enabled);
      persist();
      transform();
    });
    tdEnabled.appendChild(cb);
    tr.appendChild(tdEnabled);

    // Delete
    const tdActions = document.createElement("td");
    tdActions.className = "col-actions";
    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.title = "Delete rule";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", () => {
      rules.splice(index, 1);
      renderRulesTable();
      persist();
      transform();
    });
    tdActions.appendChild(delBtn);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

/** Moves a rule from one position to another (used by drag-and-drop and the ▲▼ buttons). */
function moveRule(fromIndex, toIndex) {
  if (fromIndex < 0 || fromIndex >= rules.length) return;
  toIndex = Math.max(0, Math.min(toIndex, rules.length - 1));
  if (fromIndex === toIndex) return;
  const [moved] = rules.splice(fromIndex, 1);
  rules.splice(toIndex, 0, moved);
  renderRulesTable();
  persist();
  transform();
}

function clearDropIndicators() {
  document.querySelectorAll("#rulesTbody tr").forEach((tr) => {
    tr.classList.remove("drop-target-above", "drop-target-below");
  });
}

/** Creates an auto-growing textarea (height follows content) for find/replace cells. */
function makeAutoTextarea(value, onChange) {
  const ta = document.createElement("textarea");
  ta.className = "cell-input";
  ta.rows = 1;
  ta.value = value ?? "";
  ta.spellcheck = false;
  const grow = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
  ta.addEventListener("input", () => { onChange(ta.value); grow(); persist(); });
  // While the Rules tab is hidden on first load, scrollHeight can't be measured
  // correctly (display:none collapses it). We retry on the next frame and also
  // recompute all cell heights whenever the Rules tab becomes visible (see wireTabs()).
  requestAnimationFrame(grow);
  return ta;
}

/** Recomputes the height of every rule textarea — needed after the Rules tab becomes visible. */
function refreshAllCellTextareaHeights() {
  document.querySelectorAll("#rulesTbody textarea.cell-input").forEach((ta) => {
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  });
}

/* ------------------------------------------------------------------ */
/* Text transformation                                                  */
/* ------------------------------------------------------------------ */
function transform() {
  const input = el("inputText").value;
  const output = applyRules(input, rules);
  el("outputText").value = output;
  updateCounts();
}

function updateCounts() {
  el("inputCount").textContent = `${el("inputText").value.length} characters`;
  el("outputCount").textContent = `${el("outputText").value.length} characters`;
}

function scheduleTransform() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(transform, 120); // light debounce for long texts
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */
function persist() {
  saveRulesToLocalStorage(rules);
  if (localFileHandle) {
    writeToLocalFile().catch((e) => console.warn("Could not save to the local file:", e));
  }
}

/* ------------------------------------------------------------------ */
/* General UI events                                                    */
/* ------------------------------------------------------------------ */
function wireEvents() {
  el("inputText").addEventListener("input", scheduleTransform);

  el("btnApply").addEventListener("click", () => { persist(); transform(); });

  el("btnAddRule").addEventListener("click", () => {
    rules.push({
      id: "rule-" + Date.now(),
      grupo: "Word",
      descricao: "",
      type: "text",
      find: "",
      replace: "",
      enabled: true,
    });
    renderRulesTable();
    persist();
  });

  el("btnReset").addEventListener("click", () => {
    if (!confirm("This will replace all current rules with the default rules. Continue?")) return;
    rules = JSON.parse(JSON.stringify(EMBEDDED_DEFAULT_RULES));
    renderRulesTable();
    persist();
    transform();
  });

  el("btnImport").addEventListener("click", () => el("fileImportInput").click());
  el("fileImportInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const imported = Array.isArray(data) ? data : data.rules;
      if (!Array.isArray(imported)) throw new Error("Invalid file format");
      rules = imported;
      renderRulesTable();
      persist();
      transform();
    } catch (err) {
      alert("Could not import the file: " + err.message);
    } finally {
      e.target.value = "";
    }
  });

  el("btnExport").addEventListener("click", () => {
    const json = rulesToJsonString(rules);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rules.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  el("btnClearInput").addEventListener("click", () => {
    el("inputText").value = "";
    transform();
    el("inputText").focus();
  });

  el("btnPasteExample").addEventListener("click", () => {
    el("inputText").value = EXAMPLE_INPUT_TEXT;
    transform();
  });

  el("btnCopy").addEventListener("click", copyOutput);
  el("btnDownloadTxt").addEventListener("click", downloadOutputTxt);

  wireTabs();
}

/* ------------------------------------------------------------------ */
/* Tabs (Editor / Rules)                                                */
/* ------------------------------------------------------------------ */
function wireTabs() {
  const tabs = [
    { btn: el("tabBtnEditor"), panel: el("panelEditor") },
    { btn: el("tabBtnRules"), panel: el("panelRules") },
  ];

  function activate(target) {
    tabs.forEach(({ btn, panel }) => {
      const isActive = btn === target.btn;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
      panel.classList.toggle("active", isActive);
    });
    if (target.panel === el("panelRules")) {
      // the table was hidden (display:none) until now, so cell textareas
      // couldn't size themselves correctly — fix their height now
      requestAnimationFrame(refreshAllCellTextareaHeights);
    }
  }

  tabs.forEach((t) => t.btn.addEventListener("click", () => activate(t)));
}

/* ------------------------------------------------------------------ */
/* Copy / download the result                                          */
/* ------------------------------------------------------------------ */
async function copyOutput() {
  const text = el("outputText").value;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // fallback for browsers/contexts without the Clipboard API (e.g. file:// in some browsers)
    const ta = el("outputText");
    ta.removeAttribute("readonly");
    ta.select();
    document.execCommand("copy");
    ta.setAttribute("readonly", "true");
  }
  const flash = el("copyFlash");
  flash.classList.add("show");
  setTimeout(() => flash.classList.remove("show"), 1400);
}

function downloadOutputTxt() {
  const text = el("outputText").value;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "formatted-text.txt";
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* File System Access API (optional — Chrome/Edge)                     */
/* Lets you open and save directly to a local rules.json, without       */
/* manual download/upload. If the browser doesn't support it, the       */
/* buttons stay hidden and Import/Export keeps working normally.        */
/* ------------------------------------------------------------------ */
function detectFileSystemAccessSupport() {
  if (!("showOpenFilePicker" in window)) return;
  el("btnOpenLocal").style.display = "";
  el("btnSaveLocal").style.display = "";

  el("btnOpenLocal").addEventListener("click", async () => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      });
      localFileHandle = handle;
      const file = await handle.getFile();
      const data = JSON.parse(await file.text());
      const imported = Array.isArray(data) ? data : data.rules;
      if (!Array.isArray(imported)) throw new Error("Invalid file format");
      rules = imported;
      renderRulesTable();
      transform();
      el("autosaveText").textContent = `Connected to "${handle.name}". Changes will be saved to it automatically.`;
    } catch (err) {
      if (err.name !== "AbortError") alert("Could not open the file: " + err.message);
    }
  });

  el("btnSaveLocal").addEventListener("click", async () => {
    try {
      if (!localFileHandle) {
        localFileHandle = await window.showSaveFilePicker({
          suggestedName: "rules.json",
          types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
        });
      }
      await writeToLocalFile();
      el("autosaveText").textContent = `Rules saved to "${localFileHandle.name}".`;
    } catch (err) {
      if (err.name !== "AbortError") alert("Could not save the file: " + err.message);
    }
  });
}

async function writeToLocalFile() {
  if (!localFileHandle) return;
  const writable = await localFileHandle.createWritable();
  await writable.write(rulesToJsonString(rules));
  await writable.close();
}

/* ------------------------------------------------------------------ */
/* Example text (the same case used to validate the rules)             */
/* ------------------------------------------------------------------ */
const EXAMPLE_INPUT_TEXT = `YOUR HOME MAY BE REPOSSESSED IF YOU DO NOT KEEP UP THE REPAYMENTS ON A MORTGAGE OR ANY OTHER DEBT SECURED ON IT.

*£2,000 towards upgrades (including carpets and flooring)  
£2,000 towards upgrades (including carpet and flooring) is available on selected homes for customers who visit a development and reserve by 17th August 2026. Can be used in addition to the up to 5% towards your deposit/stamp duty or Home Exchange/Part Exchange/Assisted Move incentive. Options must be chosen from our standard range of optional upgrades or may already be added within the home. No monetary equivalent available. 

^Up to 5% towards Deposit or Stamp Duty/LBTT 
This offer is only available when reserving selected homes. The offer is subject to lender\u2019s approval and successful legal completion. The purchaser must disclose their intention to claim this incentive to our Development Sales Manager prior to entering into a reservation agreement with St. Modwen Homes and paying the reservation fee. The purchaser must pay the standard reservation charge and exchange deposit on the selected home and complete the purchase. The monetary contribution available is dependent on the purchase price of the new home. The purchase price used to calculate this payment is the price agreed at the point of reservation and is exclusive of stamp duty/LBTT, costs, and fees. The payment will be awarded as a deduction from funds due to St. Modwen Homes at legal completion. 

†Part Exchange
This offer is only available when reserving selected homes. Not all properties are eligible for Part Exchange \u2013 your existing property must meet St. Modwen Homes\u2019 Part Exchange criteria stmodwenhomes.co.uk/ways-to-buy/partexchange. A cap on the value of your existing property may apply. Contact our sales centre for details. To claim this offer: mention the offer before entering into a reservation agreement with St. Modwen Homes and paying the reservation fee for a qualifying home. St. Modwen Homes is under no obligation to make an offer on your existing property. If St. Modwen Homes makes an offer, it will be based on independent valuation(s) arranged by St. Modwen Homes (at the discretion of St. Modwen Homes). Offers are home specific and are subject to a satisfactory homebuyer report, inspection, further enquiries, reports, vacant possession and St. Modwen Homes\u2019 standard terms and conditions, please see stmodwenhomes.co.uk/ways-to-buy/partexchange for the full terms and conditions. This offer is also subject to successful legal completion on both your sale and purchase properties.  St. Modwen Homes will pay estate agent, homebuyer report and energy performance certificate (EPC) fees instructed by St. Modwen Homes, up to a maximum of 5% of the purchase price. You are responsible for instructing a solicitor. You are responsible for any estate agent, homebuyer report and EPC fees instructed by you and for any fees and costs you have incurred, your pre reservation and for any other sale and purchase fees. St. Modwen Homes require reasonable access to your existing property.
 
 
†Assisted Move
St. Modwen Homes will pay your fees up to 1.5% of the Assisted Move house value. Home Report and Estate Agent's fees will be paid by St. Modwen Homes following an instruction being made by or on behalf of St. Modwen Homes. St. Modwen Homes will not reimburse you for marketing fees or Home Reports instructed prior to commencement of the Assisted Move scheme. Home Reports are only applicable to purchases in Scotland. All offers are plot and development specific and may be withdrawn without notice. 

 
†Home Exchange 
Home Exchange is subject to availability, status and eligibility. Open to UK residents, aged 18+. Not all properties can be considered for Home Exchange. Your existing house must meet our Home Exchange criteria including, but not limited to, main residences only, no structural issues, non-standard construction or blight, minimum remaining leasehold term of 100 years, no listed properties, compliance with all relevant regulations (including smoke and fire alarms) and availability of technical reports. Please contact our sales centre for further information on homes included in the offer and the availability of Home Exchange on your property. Our partners are under no obligation to make an offer for your property. Any and all offers are home specific and subject to standard terms and conditions as well as a satisfactory homebuyer report and any necessary inspections, further enquiries or reports. To be considered for Home Exchange, you must disclose your intention to claim this incentive to our Development Sales Manager prior to entering into a reservation agreement with us and paying the reservation fee in relation to that home. Any offer made to purchase your existing property will be based upon two independent RICS valuations arranged by us (at our discretion). You will need to provide access to our appointed agents or our representative for the purposes of valuations and inspections of your existing property. Following valuation and inspection of your existing property, the market appraisal obtained will be sent to at least three panel company partners to bid on the property and the highest offer will be communicated to the prospective purchaser by St. Modwen Homes. Any Home Exchange offer is a time-limited offer and your acceptance will be required within 48 hours. If you do not accept the offer, your application for Home Exchange will be cancelled. If you accept the Home Exchange offer, you will be required to complete a new home reservation form and pay the reservation fee for your new home. An exchange deposit may also be required upon exchange of contracts. You agree to allow reasonable access to your existing property to facilitate the resale (subject to agreed appointments) and to the erection of a \u201cfor sale\u201d sign. You agree to cancel any existing agreements with estate agents and agree that you are responsible for any fees due to them. A professional legal adviser is required to carry out the legal formalities of buying the home and to represent your interests. You will need to ensure your solicitor is instructed to proceed on your behalf upon acceptance of our offer. We will pay Home Report, Energy Performance Certificate and estate agents' fees in connection with the sale of your property, up to a maximum total payment for fees of five per cent (5%) of the valuation of your property. Home Report, Energy Performance Certificate and estate agents' fees are only paid for following instructions made by us (you will be responsible for any fees you incur in connection with instructions you made). No reimbursement will be made for marketing fees or an Energy Performance Certificate or Home Report instructed prior to reservation. Save as expressly set out in this paragraph, you will have to cover the costs required as part of the normal selling/buying process e.g. solicitor fees, fees as part of the selling process (for water, estate charge, council tax, etc.) and any certifications (for gas and electrics or anything else). You will be responsible for any such excluded costs and invoices up to and including the day of legal completion. Your move in date for your new home is subject to build programme and completion. Full vacant possession of your existing home will be required upon legal completion. On the day of legal completion, you will not receive the keys to your new home until completion has taken place on both properties. The Home Exchange scheme is subject to availability and may be withdrawn at any time without notice. This does not affect Home Exchanges which are being processed.\u202f 

General 
Offers are available on new reservations from 6th July 2026.\u202fSt. Modwen Homes reserves the right to suspend, cancel or amend these offers.
 
These offers are open to UK residents, aged 18+ and are subject to availability, status and eligibility. Please contact our development sales centres for further information. 

Each offer is subject to St. Modwen Homes\u2019 standard terms and conditions. 

These offers cannot be used in conjunction with any other discounts, promotions or offers and cannot be redeemed retrospectively. No cash or other alternative is available to any of our offers. 

The incentives and these terms (including any non contractual disputes or claims arising out of them) are subject to English law. Any disputes must be referred to the English courts. Purchasers in Scotland and Northern Ireland may additionally bring an action in their home courts. 

St. Modwen Homes cannot advise you on a mortgage, please speak to an independent Mortgage Adviser to get a specific mortgage illustration for the property that you wish to buy. 
`;
