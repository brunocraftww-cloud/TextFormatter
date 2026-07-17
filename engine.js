/* ===================================================================
   ENGINE.JS
   Rule-matching / text transformation engine.
   100% offline — no network calls happen here.
   =================================================================== */

// Embedded default rules (mirrors rules.json), used as a fallback if
// loading the external file fails (e.g. some browsers block fetch()
// of local files when opened via file://).
const EMBEDDED_DEFAULT_RULES = [
  { id: "heading-2000-heading", grupo: "Heading / Structure",
    descricao: "£2,000 upgrade offer heading: turns the line into a bold heading",
    type: "text",
    find: "*£2,000 towards upgrades (including carpets and flooring)",
    replace: "<strong>*£2,000 towards upgrades (including carpets and flooring)</strong><br />",
    enabled: true },

  { id: "heading-deposit-caret", grupo: "Heading / Structure",
    descricao: "'Up to 5% towards Deposit or Stamp Duty/LBTT' heading (^) in bold",
    type: "text",
    find: "^Up to 5% towards Deposit or Stamp Duty/LBTT",
    replace: "<strong>^Up to 5% towards Deposit or Stamp Duty/LBTT</strong><br />",
    enabled: true },

  { id: "heading-deposit-dagger", grupo: "Heading / Structure",
    descricao: "'Up to 5% towards Deposit or Stamp Duty/LBTT' heading (†) in bold",
    type: "text",
    find: "†Up to 5% towards Deposit or Stamp Duty/LBTT",
    replace: "<strong>†Up to 5% towards Deposit or Stamp Duty/LBTT</strong><br />",
    enabled: true },

  { id: "heading-part-exchange-dagger", grupo: "Heading / Structure",
    descricao: "'Part Exchange' heading (†) in bold",
    type: "text",
    find: "†Part Exchange",
    replace: "<strong>†Part Exchange</strong><br />",
    enabled: true },

  { id: "heading-assisted-move-dagger", grupo: "Heading / Structure",
    descricao: "'Assisted Move' heading (†) in bold",
    type: "text",
    find: "†Assisted Move",
    replace: "<strong>†Assisted Move</strong><br />",
    enabled: true },

  { id: "heading-home-exchange-dagger", grupo: "Heading / Structure",
    descricao: "'Home Exchange' heading (†) in bold",
    type: "text",
    find: "†Home Exchange",
    replace: "<strong>†Home Exchange</strong><br />",
    enabled: true },

  { id: "heading-john-lewis-voucher", grupo: "Heading / Structure",
    descricao: "'Win a £5,000 John Lewis voucher' heading in bold",
    type: "text",
    find: "* Win a £5,000 John Lewis voucher",
    replace: "<strong>* Win a £5,000 John Lewis voucher</strong><br />",
    enabled: true },

  { id: "heading-2000-caret", grupo: "Heading / Structure",
    descricao: "£2,000 upgrade offer heading (^) in bold",
    type: "text",
    find: "^£2,000 towards upgrades (including carpets and flooring)",
    replace: "<strong>^£2,000 towards upgrades (including carpets and flooring)</strong><br />",
    enabled: true },

  { id: "heading-part-exchange-double-dagger", grupo: "Heading / Structure",
    descricao: "'Part Exchange' heading (‡) in bold",
    type: "text",
    find: "‡Part Exchange",
    replace: "<strong>‡Part Exchange</strong><br />",
    enabled: true },

  { id: "heading-assisted-move-double-dagger", grupo: "Heading / Structure",
    descricao: "'Assisted Move' heading (‡) in bold",
    type: "text",
    find: "‡Assisted Move",
    replace: "<strong>‡Assisted Move</strong><br />",
    enabled: true },

  { id: "heading-home-exchange-double-dagger", grupo: "Heading / Structure",
    descricao: "'Home Exchange' heading (‡) in bold",
    type: "text",
    find: "‡Home Exchange",
    replace: "<strong>‡Home Exchange</strong><br />",
    enabled: true },

  { id: "heading-general", grupo: "Heading / Structure",
    descricao: "'General' heading in bold",
    type: "text",
    find: "General",
    replace: "<strong>General</strong><br />",
    enabled: true },

  { id: "char-pound", grupo: "Character",
    descricao: "Pound sign becomes an HTML entity",
    type: "text",
    find: "£",
    replace: "&pound;",
    enabled: true },

  { id: "char-percent", grupo: "Character",
    descricao: "Percent sign becomes an HTML entity",
    type: "text",
    find: "%",
    replace: "&#37;",
    enabled: true },

  { id: "char-curly-apostrophe", grupo: "Character",
    descricao: "Curly (typographic) apostrophe becomes an HTML entity. Straight apostrophes (') are NOT changed.",
    type: "text",
    find: "’",
    replace: "&#39;",
    enabled: true },

  { id: "char-dagger", grupo: "Character",
    descricao: "Dagger symbol becomes a <sup> tag with an HTML entity",
    type: "text",
    find: "†",
    replace: "<sup style=\"line-height: 1px\">&dagger;</sup>",
    enabled: true },

  { id: "char-double-dagger", grupo: "Character",
    descricao: "Double dagger symbol becomes a <sup> tag with an HTML entity",
    type: "text",
    find: "‡",
    replace: "<sup style=\"line-height: 1px\">&Dagger;</sup>",
    enabled: true },

  { id: "char-copyright", grupo: "Character",
    descricao: "Copyright symbol becomes an HTML entity",
    type: "text",
    find: "©",
    replace: "&copy;",
    enabled: true },

  { id: "word-stamp-duty", grupo: "Word",
    descricao: "Standardizes the capitalization of 'stamp duty' to 'Stamp Duty'",
    type: "text",
    find: "stamp duty",
    replace: "Stamp Duty",
    enabled: true },

  { id: "link-stmodwen-partexchange", grupo: "Structure",
    descricao: "Converts the St Modwen Part Exchange URL into a styled HTML link",
    type: "text",
    find: "https://stmodwenhomes.co.uk/ways-to-buy/partexchange",
    replace: "<a href=\"https://stmodwenhomes.co.uk/ways-to-buy/partexchange\" target=\"_blank\" style=\"color: #FFFFFF; text-decoration: underline\">https://stmodwenhomes.co.uk/ways-to-buy/partexchange</a>",
    enabled: true },

  { id: "link-millerhomes-partexchange", grupo: "Structure",
    descricao: "Converts the Miller Homes Part Exchange URL into a styled HTML link",
    type: "text",
    find: "https://millerhomes.co.uk/our-offers/partexchange.aspx",
    replace: "<a href=\"https://www.millerhomes.co.uk/our-offers/partexchange.aspx\" target=\"_blank\" style=\"text-decoration: underline; color: #525252;\">millerhomes.co.uk/our-offers/partexchange.aspx</a>",
    enabled: true },

  { id: "structure-paragraph-break", grupo: "Structure",
    descricao: "One or more blank lines between paragraphs become two <br /> tags",
    type: "regex",
    find: "\\n[ \\t\\u202f]*\\n(?:[ \\t\\u202f]*\\n)*",
    flags: "g",
    replace: "\n<br />\n<br />\n",
    enabled: true }
];

const STORAGE_KEY = "textformatter_rules_v1";

/**
 * Applies a list of rules (in the order given) to a text string.
 * "text" rules use literal replacement (split/join) — not regex —
 * so special characters in find/replace never break the engine.
 * "regex" rules use an explicit regular expression.
 */
function applyRules(text, rules) {
  let result = text;
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!rule.find) continue;
    try {
      if (rule.type === "regex") {
        const re = new RegExp(rule.find, rule.flags || "g");
        result = result.replace(re, rule.replace ?? "");
      } else {
        // literal text replacement (not interpreted as regex)
        result = result.split(rule.find).join(rule.replace ?? "");
      }
    } catch (err) {
      console.error("Error applying rule", rule.id, err);
    }
  }
  return result;
}

/** Loads rules: localStorage (saved edits) > rules.json (fetch) > embedded defaults. */
async function loadRules() {
  // 1) try localStorage first (the user's latest edits)
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) { /* ignore and keep trying other sources */ }

  // 2) try fetching rules.json (works when served via http://localhost)
  try {
    const resp = await fetch("rules.json", { cache: "no-store" });
    if (resp.ok) {
      const data = await resp.json();
      if (data && Array.isArray(data.rules)) return data.rules;
    }
  } catch (e) { /* expected to fail when opened via file:// */ }

  // 3) fallback: rules embedded in app.js
  return JSON.parse(JSON.stringify(EMBEDDED_DEFAULT_RULES));
}

function saveRulesToLocalStorage(rules) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    return true;
  } catch (e) {
    console.error("Could not save to localStorage", e);
    return false;
  }
}

function rulesToJsonString(rules) {
  return JSON.stringify({ version: 1, rules }, null, 2);
}
