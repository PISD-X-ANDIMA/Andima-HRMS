// D4 V2 Screen Builder — builds the 36 numbered D4 screens (format D3: "NN HRMS D4 - <Layar> (<Role>)", 1440×1024)
// from the variables, text styles and components already in file "PISD – D4 V2" (board "00 Foundations & Components").
// Re-running removes the frames and row titles it created before, then rebuilds them. Nothing else is touched.

const H = 1024;
const SIDEBAR = 260;
const ROW_GAP = 320;
const COL_GAP = 120;
// Placeholder people only (rows marked as placeholders in the org structure file); no real staff next to scores.
const USER = { name: "Mercury", role: "HR" };
const GENERATED = /^(\d\d HRMS D4 - |Baris \d · )/;

const V = {};
const S = {};
const SETS = {};
const FRAMES = {};

// ---------- tokens & primitives ----------

function P(name) {
  const variable = V[name];
  if (!variable) throw new Error(`Variable "${name}" tidak ada di koleksi D4 V2 Tokens.`);
  return figma.variables.setBoundVariableForPaint({ type: "SOLID", color: { r: 0, g: 0, b: 0 } }, "color", variable);
}

const SHADOW_CARD = { type: "DROP_SHADOW", color: { r: 0.08, g: 0.36, b: 0.99, a: 0.08 }, offset: { x: 0, y: 8 }, radius: 24, spread: 0, visible: true, blendMode: "NORMAL" };
const SHADOW_MODAL = { type: "DROP_SHADOW", color: { r: 0.06, g: 0.09, b: 0.17, a: 0.2 }, offset: { x: 0, y: 24 }, radius: 48, spread: 0, visible: true, blendMode: "NORMAL" };

function box(direction, o = {}) {
  const f = figma.createFrame();
  f.name = o.name || "Frame";
  f.layoutMode = direction;
  f.primaryAxisSizingMode = "AUTO";
  f.counterAxisSizingMode = "AUTO";
  f.fills = o.fill ? [P(o.fill)] : [];
  f.clipsContent = Boolean(o.clip);
  if (o.gap != null) f.itemSpacing = o.gap;
  if (o.p != null) {
    const [t, r, b, l] = Array.isArray(o.p) ? o.p : [o.p, o.p, o.p, o.p];
    f.paddingTop = t; f.paddingRight = r; f.paddingBottom = b; f.paddingLeft = l;
  }
  if (o.r != null) f.cornerRadius = o.r;
  if (o.stroke) { f.strokes = [P(o.stroke)]; f.strokeWeight = 1; f.strokeAlign = "INSIDE"; }
  if (o.align) f.counterAxisAlignItems = o.align;
  if (o.justify) f.primaryAxisAlignItems = o.justify;
  if (o.wrap) { f.layoutWrap = "WRAP"; f.counterAxisSpacing = o.gap || 0; }
  if (o.shadow) f.effects = [o.shadow];
  if (o.w) {
    f.resize(o.w, f.height);
    if (direction === "HORIZONTAL") f.primaryAxisSizingMode = "FIXED"; else f.counterAxisSizingMode = "FIXED";
  }
  if (o.h) {
    f.resize(f.width, o.h);
    if (direction === "VERTICAL") f.primaryAxisSizingMode = "FIXED"; else f.counterAxisSizingMode = "FIXED";
  }
  return f;
}

function add(parent, child, o = {}) {
  parent.appendChild(child);
  if (o.fillW) child.layoutSizingHorizontal = "FILL";
  if (o.fillH) child.layoutSizingVertical = "FILL";
  if (o.grow) child.layoutGrow = 1;
  return child;
}

function edge(frame, side, color = "border/default") {
  frame.strokes = [P(color)];
  frame.strokeAlign = "INSIDE";
  frame.strokeTopWeight = side === "top" ? 1 : 0;
  frame.strokeBottomWeight = side === "bottom" ? 1 : 0;
  frame.strokeLeftWeight = 0;
  frame.strokeRightWeight = 0;
}

async function T(text, style = "D4/Body/MD", color = "text/primary", width, lines) {
  const t = figma.createText();
  await t.setTextStyleIdAsync(S[style].id);
  t.characters = text;
  t.fills = [P(color)];
  if (width) {
    t.textAutoResize = "HEIGHT";
    t.resize(width, t.height);
    if (lines) { t.maxLines = lines; t.textTruncation = "ENDING"; }
  }
  return t;
}

const ICON = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
};

function icon(name, color = "#45556C", size = 16) {
  const node = figma.createNodeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`);
  node.name = "icon/" + name;
  return node;
}

// ---------- component instances ----------

function inst(setName, variant = {}, texts = {}) {
  const node = SETS[setName];
  const component = node.type === "COMPONENT_SET" ? node.defaultVariant : node;
  const instance = component.createInstance();
  const defs = instance.componentProperties;
  const props = Object.assign({}, variant);
  for (const [name, value] of Object.entries(texts)) {
    const key = Object.keys(defs).find((k) => k === name || k.startsWith(name + "#"));
    if (key) props[key] = value;
  }
  if (Object.keys(props).length) instance.setProperties(props);
  return instance;
}

function variantOptions(setName, property) {
  const def = SETS[setName].componentPropertyDefinitions[property];
  return def && def.variantOptions ? def.variantOptions : [];
}

// Statuses without their own variant reuse a variant of the same tone and override the text.
const BADGE_ALIAS = {
  "On Track": "Completed", "Needs Attention": "Gap", Identified: "Active", High: "Gap", Medium: "Planned", Low: "Draft",
  Revisi: "Active", Superseded: "Draft",
};

function badge(status) {
  const exists = variantOptions("Status Badge", "Status").includes(status);
  const instance = inst("Status Badge", { Status: exists ? status : BADGE_ALIAS[status] || "Draft" });
  if (!exists) { const label = instance.findOne((n) => n.type === "TEXT"); if (label) label.characters = status; }
  return instance;
}

function button(label, type = "Primary") {
  return inst("Button", { Type: type }, { Label: label });
}

function chip(source, reference) {
  const options = variantOptions("Source Chip", "Source");
  const instance = inst("Source Chip", { Source: options.includes(source) ? source : options[0] }, { Reference: reference });
  if (!options.includes(source)) { const label = instance.findOne((n) => n.type === "TEXT" && n.name === "Label"); if (label) label.characters = source; }
  return instance;
}

// Runs after layout: a chip wider than its column fills the column and ellipsizes the reference, so the source type stays readable.
function fitChips(frame) {
  for (const c of frame.findAll((n) => n.type === "INSTANCE" && n.name === "Source Chip")) {
    const p = c.parent;
    if (!p || p.layoutMode === "NONE" || c.width <= p.width - (p.paddingLeft || 0) - (p.paddingRight || 0) + 0.5) continue;
    const ref = c.findOne((n) => n.type === "TEXT" && n.name === "Reference");
    c.layoutSizingHorizontal = "FILL";
    ref.textAutoResize = "HEIGHT";
    ref.layoutSizingHorizontal = "FILL";
    ref.maxLines = 1;
    ref.textTruncation = "ENDING";
  }
}

function field(label, value, o = {}) {
  const instance = inst("Form Field", { State: o.state || "Default", Type: o.select ? "Select" : "Input" }, { Label: label, Value: value, Helper: o.helper || " " });
  if (!o.helper) { const helper = instance.findOne((n) => n.name === "Helper"); if (helper) helper.visible = false; }
  if (o.w) instance.resize(o.w, instance.height);
  return instance;
}

// ---------- layout blocks ----------

async function screen(no, title, role, o) {
  const width = o.width || 1440;
  const frame = figma.createFrame();
  frame.name = `${no} HRMS D4 - ${title} (${role})`;
  frame.resize(width, H);
  frame.layoutMode = "HORIZONTAL";
  frame.primaryAxisSizingMode = "FIXED";
  frame.counterAxisSizingMode = "FIXED";
  frame.fills = [P("bg/app")];
  frame.clipsContent = true;
  const compact = width < 1024;
  if (!compact) add(frame, inst("Sidebar", { Active: o.menu }));
  const main = add(frame, box("VERTICAL", { name: "Main" }), { fillW: true, fillH: true });
  // Below 1024 px the sidebar becomes a drawer, so the top row gets a menu trigger before the topbar.
  const topRow = compact ? add(main, box("HORIZONTAL", { name: "Top Row", fill: "bg/surface", align: "CENTER", p: [0, 0, 0, 16], gap: 4 }), { fillW: true }) : main;
  if (compact) topRow.appendChild(icon("menu", "#0F172B", 20));
  const top = inst("Topbar", {}, { Breadcrumb: o.crumb, "User Name": USER.name, "User Role": USER.role });
  add(topRow, top, compact ? { grow: true } : { fillW: true });
  const content = add(main, box("VERTICAL", { name: "Content", gap: 24, p: compact ? [24, 16, 24, 16] : [32, 32, 32, 32] }), { fillW: true, fillH: true });
  FRAMES[no] = frame;
  return { frame, content, contentWidth: width - (compact ? 0 : SIDEBAR) - (compact ? 32 : 64) };
}

async function pageHeader(parent, title, subtitle, action) {
  const row = add(parent, box("HORIZONTAL", { name: "Page Header", gap: 16, align: "CENTER" }), { fillW: true });
  const text = add(row, box("VERTICAL", { gap: 4 }), { grow: true });
  add(text, await T(title.toUpperCase(), "D4/Display/Page Title"));
  add(text, await T(subtitle, "D4/Body/MD", "text/secondary"));
  if (action) row.appendChild(button("+ " + action));
  return row;
}

async function select(label, width = 180) {
  const s = box("HORIZONTAL", { name: "Select - " + label, fill: "bg/surface", stroke: "border/strong", r: 10, p: [10, 12, 10, 12], gap: 8, align: "CENTER", w: width });
  add(s, await T(label, "D4/Body/MD", "text/secondary"), { grow: true });
  s.appendChild(icon("chev", "#64748B", 16));
  return s;
}

async function filterBar(parent, search, selects, compact) {
  const bar = add(parent, box("HORIZONTAL", { name: "Filter Bar", fill: "bg/surface", r: 16, p: 16, gap: 12, align: "CENTER", stroke: "border/default", shadow: SHADOW_CARD, wrap: compact }), { fillW: true });
  const input = add(bar, box("HORIZONTAL", { name: "Search", fill: "bg/surface", stroke: "border/strong", r: 10, p: [10, 12, 10, 12], gap: 8, align: "CENTER", w: compact ? 300 : undefined }));
  if (!compact) input.layoutGrow = 1;
  input.appendChild(icon("search", "#64748B", 16));
  add(input, await T(search, "D4/Body/MD", "text/muted"));
  for (const label of selects) bar.appendChild(await select(label, compact ? 160 : 180));
  return bar;
}

async function card(parent, title, o = {}) {
  const c = add(parent, box("VERTICAL", { name: "Card - " + (title || "content"), fill: "bg/surface", r: 16, p: o.p != null ? o.p : 24, gap: 16, stroke: "border/default", shadow: SHADOW_CARD, clip: o.clip }), { fillW: true });
  if (title) {
    const head = add(c, box("HORIZONTAL", { gap: 12, align: "CENTER" }), { fillW: true });
    add(head, await T(title, "D4/Heading/Section"), { grow: true });
    if (o.action) head.appendChild(o.action);
  }
  return c;
}

async function person(name, code) {
  const row = box("HORIZONTAL", { name: "Person", gap: 10, align: "CENTER" });
  const avatar = add(row, box("HORIZONTAL", { name: "Avatar", fill: "status/success", r: 999, w: 32, h: 32, align: "CENTER", justify: "CENTER" }));
  add(avatar, await T(name.split(" ").map((w) => w[0]).join("").slice(0, 2), "D4/Badge", "bg/surface"));
  const text = add(row, box("VERTICAL", { gap: 0 }));
  add(text, await T(name, "D4/Heading/Sub"));
  add(text, await T(code, "D4/Body/SM", "text/muted"));
  return row;
}

async function cellContent(value, width) {
  if (value && value.person) return person(value.person[0], value.person[1]);
  if (value && value.badge) return badge(value.badge);
  if (value && value.chip) return chip(value.chip[0], value.chip[1]);
  if (value && value.score) {
    const v = box("VERTICAL", { gap: 0 });
    add(v, await T(value.score[0], "D4/Heading/Sub"));
    if (value.score[1]) add(v, await T(value.score[1], "D4/Body/SM", "text/muted"));
    return v;
  }
  if (value && value.strong) return T(value.strong, "D4/Heading/Sub", "text/primary", width, 1);
  if (value && value.muted) return T(value.muted, "D4/Body/SM", "text/muted", width, 2);
  if (value && value.danger) return T(value.danger, "D4/Body/SM", "status/danger", width, 1);
  return T(String(value), "D4/Body/MD", "text/primary", width, 2);
}

async function table(parent, columns, rows, o = {}) {
  const c = await card(parent, o.title, { p: 0, clip: true });
  const head = add(c, box("HORIZONTAL", { name: "Table Header", fill: "bg/app", p: [12, 20, 12, 20], gap: 16, align: "CENTER" }), { fillW: true });
  for (const col of columns) {
    const cell = add(head, box("HORIZONTAL", { name: "th - " + col.h, w: col.w || 120 }), { grow: col.grow });
    add(cell, await T(col.h, "D4/Label/Caps", "text/muted"));
  }
  if (o.actions !== false) head.appendChild(box("HORIZONTAL", { name: "th - action", w: 36, h: 16 }));
  const triggers = [];
  for (const row of rows) {
    const r = add(c, box("HORIZONTAL", { name: "Row", fill: row.highlight ? "primary/50" : "bg/surface", p: [12, 20, 12, 20], gap: 16, align: "CENTER" }), { fillW: true });
    edge(r, "top");
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const cell = add(r, box("HORIZONTAL", { name: "td - " + col.h, w: col.w || 120, align: "CENTER" }), { grow: col.grow });
      // appendChild returns nothing, so keep our own handle on the node.
      const content = await cellContent(row.cells[i], col.grow ? undefined : (col.w || 120));
      cell.appendChild(content);
      // A growing column has no fixed width to wrap against, so let its text fill the cell and truncate.
      if (col.grow && content.type === "TEXT") { content.layoutSizingHorizontal = "FILL"; content.textAutoResize = "HEIGHT"; content.maxLines = 2; content.textTruncation = "ENDING"; }
      // refOnly: the header already names the source type, so the chip shows just the reference.
      if (col.refOnly && content.findOne) { const label = content.findOne((n) => n.type === "TEXT" && n.name === "Label"); if (label) label.visible = false; }
    }
    if (o.actions !== false) triggers.push(add(r, inst("Row Action Trigger")));
  }
  if (o.footer !== false) {
    const foot = add(c, box("HORIZONTAL", { name: "Table Footer", p: [12, 20, 12, 20], justify: "MAX", align: "CENTER" }), { fillW: true });
    edge(foot, "top");
    foot.appendChild(inst("Pagination", {}, { Info: o.info || `Showing 1–${rows.length} of ${rows.length}` }));
  }
  return { card: c, triggers };
}

async function metrics(parent, items, contentWidth) {
  // Min card width 160; when the cards don't fill whole rows, balance them (6 in 5 columns → 3 + 3) so no card sits alone.
  const fit = Math.max(1, Math.min(items.length, Math.floor((contentWidth + 16) / (160 + 16))));
  const perRow = Math.ceil(items.length / Math.ceil(items.length / fit));
  const width = Math.floor((contentWidth - 16 * (perRow - 1)) / perRow);
  const grid = add(parent, box("HORIZONTAL", { name: "Metric Grid", gap: 16, wrap: true }), { fillW: true });
  for (const [label, value, helper] of items) {
    const m = inst("Metric Card", {}, { Label: label, Value: value, Helper: helper || " " });
    try { m.resize(width, m.height); } catch (error) { console.warn("Metric card keeps its component width", error); }
    grid.appendChild(m);
  }
  return grid;
}

async function detailHeader(parent, crumb, name, meta, status, actions) {
  const nav = add(parent, box("HORIZONTAL", { name: "Back & Breadcrumb", gap: 12, align: "CENTER" }), { fillW: true });
  nav.appendChild(button("← Back", "Secondary"));
  add(nav, await T(crumb, "D4/Body/SM", "text/secondary"));
  const head = add(parent, box("HORIZONTAL", { name: "Detail Header", r: 16, p: 24, gap: 20, align: "CENTER", shadow: SHADOW_CARD }), { fillW: true });
  head.fills = [{ type: "GRADIENT_LINEAR", gradientTransform: [[1, 0, 0], [0, 1, 0]], gradientStops: [{ position: 0, color: { r: 0.02, g: 0.31, b: 0.84, a: 1 } }, { position: 1, color: { r: 0.23, g: 0.44, b: 0.96, a: 1 } }] }];
  const avatar = add(head, box("HORIZONTAL", { name: "Avatar", fill: "status/success", r: 999, w: 56, h: 56, align: "CENTER", justify: "CENTER" }));
  add(avatar, await T(name.split(" ").map((w) => w[0]).join("").slice(0, 2), "D4/Heading/Section", "bg/surface"));
  const text = add(head, box("VERTICAL", { gap: 6 }), { grow: true });
  const title = add(text, box("HORIZONTAL", { gap: 12, align: "CENTER" }));
  add(title, await T(name, "D4/Heading/Section", "text/inverse"));
  if (status) title.appendChild(badge(status));
  add(text, await T(meta.join("  ·  "), "D4/Body/SM", "text/inverse"));
  for (const [label, type] of actions) head.appendChild(button(label, type || "Secondary"));
  return head;
}

async function columns2(parent, rightWidth = 380) {
  const row = add(parent, box("HORIZONTAL", { name: "Two Columns", gap: 24 }), { fillW: true });
  const left = add(row, box("VERTICAL", { name: "Main Column", gap: 24 }), { grow: true });
  const right = add(row, box("VERTICAL", { name: "Side Column", gap: 24, w: rightWidth }));
  return { left, right };
}

async function infoGrid(parent, items, itemWidth = 200) {
  const grid = add(parent, box("HORIZONTAL", { name: "Info Grid", gap: 20, wrap: true }), { fillW: true });
  for (const [label, value] of items) {
    const item = add(grid, box("VERTICAL", { gap: 4, w: itemWidth }));
    add(item, await T(label, "D4/Label/Caps", "text/muted"));
    if (value && value.badge) item.appendChild(badge(value.badge)); else add(item, await T(value, "D4/Heading/Sub", "text/primary", itemWidth));
  }
  return grid;
}

async function timeline(parent, entries) {
  const list = add(parent, box("VERTICAL", { name: "Timeline", gap: 0 }), { fillW: true });
  for (let i = 0; i < entries.length; i++) {
    const [date, title, status, actor, body] = entries[i];
    const row = add(list, box("HORIZONTAL", { name: "Entry", gap: 16 }), { fillW: true });
    const rail = add(row, box("VERTICAL", { name: "Rail", gap: 0, align: "CENTER", w: 16 }), { fillH: true });
    const dot = figma.createEllipse(); dot.resize(12, 12); dot.fills = [P(i === 0 ? "primary/600" : "border/strong")]; rail.appendChild(dot);
    if (i < entries.length - 1) { const line = figma.createRectangle(); line.resize(2, 40); line.fills = [P("border/default")]; add(rail, line, { grow: true }); }
    const text = add(row, box("VERTICAL", { gap: 6, p: [0, 0, 24, 0] }), { grow: true });
    add(text, await T(date, "D4/Body/SM", "text/muted"));
    const head = add(text, box("HORIZONTAL", { gap: 10, align: "CENTER" }));
    add(head, await T(title, "D4/Heading/Sub"));
    if (status) head.appendChild(badge(status));
    if (body) add(text, await T(body, "D4/Body/MD", "text/secondary"));
    add(text, await T("Dicatat oleh " + actor, "D4/Body/SM", "text/muted"));
  }
  return list;
}

async function notice(parent, text, tone = "warning") {
  const n = add(parent, box("HORIZONTAL", { name: "Notice", fill: `status/${tone}-bg`, r: 12, p: [12, 16, 12, 16], gap: 10, align: "CENTER" }), { fillW: true });
  n.appendChild(icon(tone === "danger" ? "alert" : "info", tone === "danger" ? "#D9364F" : tone === "warning" ? "#B57F0F" : "#3B6FF5", 16));
  add(n, await T(text, "D4/Body/MD", `status/${tone}`), { grow: true });
  return n;
}

function absolute(frame, node, x, y) {
  frame.appendChild(node);
  node.layoutPositioning = "ABSOLUTE";
  node.x = x;
  node.y = y;
  return node;
}

async function modal(frame, width, title, subtitle, build, actions) {
  const shade = figma.createRectangle();
  shade.name = "Overlay";
  shade.resize(frame.width, H);
  shade.fills = [{ type: "SOLID", color: { r: 0.06, g: 0.09, b: 0.17 }, opacity: 0.4 }];
  absolute(frame, shade, 0, 0);
  const m = box("VERTICAL", { name: "Form Modal", fill: "bg/surface", r: 16, w: width, shadow: SHADOW_MODAL, clip: true });
  const head = add(m, box("HORIZONTAL", { name: "Modal Header", p: [20, 24, 20, 24], gap: 12 }), { fillW: true });
  edge(head, "bottom");
  const text = add(head, box("VERTICAL", { gap: 4 }), { grow: true });
  add(text, await T(title, "D4/Heading/Section"));
  if (subtitle) add(text, await T(subtitle, "D4/Body/SM", "text/secondary", width - 100));
  head.appendChild(icon("x", "#64748B", 20));
  const body = add(m, box("VERTICAL", { name: "Modal Body", p: 24, gap: 16 }), { fillW: true });
  await build(body, width - 48);
  const foot = add(m, box("HORIZONTAL", { name: "Modal Footer", p: [16, 24, 16, 24], gap: 12, justify: "MAX", align: "CENTER" }), { fillW: true });
  edge(foot, "top");
  for (const [label, type] of actions) foot.appendChild(button(label, type));
  absolute(frame, m, Math.round((frame.width - width) / 2), 0);
  m.y = Math.max(40, Math.round((H - m.height) / 2));
  return m;
}

async function fieldGrid(parent, width, fields) {
  const grid = add(parent, box("HORIZONTAL", { name: "Fields", gap: 16, wrap: true }), { fillW: true });
  const half = Math.floor((width - 16) / 2);
  for (const f of fields) grid.appendChild(field(f[0], f[1], Object.assign({ w: f[2] && f[2].full ? width : half }, f[2] || {})));
  return grid;
}

async function menuAt(frame, trigger, labels) {
  const menu = box("VERTICAL", { name: "Row Action Menu", fill: "bg/surface", r: 12, p: 6, gap: 2, stroke: "border/default", shadow: SHADOW_MODAL, w: 264 });
  for (const label of labels) { const item = inst("Menu Item", {}, { Label: label }); add(menu, item, { fillW: true }); }
  const t = trigger.absoluteBoundingBox;
  const f = frame.absoluteBoundingBox;
  absolute(frame, menu, Math.round(t.x - f.x + t.width - 264), Math.round(t.y - f.y + t.height + 6));
  return menu;
}

function toast(frame, message, type = "Success") {
  const t = inst("Toast", { Type: type }, { Message: message });
  absolute(frame, t, frame.width - t.width - 24, 80);
  return t;
}

// ---------- data (sama dengan mode preview aplikasi) ----------

const PEOPLE = [
  ["Echo", "FIX-D4-EMP-007", "Finance Staff"],
  ["Mercury", "FIX-D4-EMP-005", "HR Associate Officer"],
  ["Charlie", "FIX-D4-EMP-004", "Operations Staff"],
  ["Alfa", "FIX-D4-EMP-002", "Finance Staff"],
  ["Holly", "FIX-D4-EMP-009", "Finance Staff"],
  ["Bravo", "FIX-D4-EMP-003", "Sales Staff"],
  ["Delta", "FIX-D4-EMP-006", "Sales Administration Associate"],
  ["Fanta", "FIX-D4-EMP-008", "Operations Staff"],
];
const SCORE_LABELS = { 1: "Sangat Kurang", 2: "Kurang", 3: "Cukup", 4: "Baik", 5: "Sangat Baik" };
const P_ = (i) => ({ person: [PEOPLE[i][0], PEOPLE[i][1]] });

const KPI_LINES = [
  ["Kecepatan Penerbitan Invoice (SLA < 24 jam)", 25, "< 24 jam", "Rata-rata 20 jam", 4],
  ["Akurasi Pembukuan Sistem & Krishand GL", 25, "Selisih 0", "1 koreksi minor", 4],
  ["Ketepatan Waktu Pembayaran & Reimbursement", 20, "100% tepat waktu", "3 transaksi terlambat", 3],
  ["Efektivitas Collection/Penagihan Piutang", 15, "Sesuai target periode", "Semua invoice tertagih", 5],
  ["Kerapian Arsip Keuangan & Kepatuhan Pajak", 15, "Arsip lengkap", "Arsip lengkap", 4],
];
const KPI_TOTAL = KPI_LINES.reduce((sum, l) => sum + (l[1] * l[4]) / 100, 0).toFixed(2); // 3.95

const MENUS = {
  perf: "Performance Evaluation", kpi: "KPI Scorecard", comp: "Competency Gap",
  dev: "Development Requirement", train: "Training Tracking", dash: "People Dashboard",
};

// ---------- screens ----------

async function performanceList(no, o = {}) {
  const s = await screen(no, o.title || "Performance Evaluation List", "HR", { menu: MENUS.perf, crumb: "HRMS / Performance Evaluation", width: o.width });
  await pageHeader(s.content, "Performance Evaluation", "Catat dan telusuri evaluasi kinerja per employee dan periode (FR-D4-001).", "Add Evaluation");
  await filterBar(s.content, "Search employee name or ID", ["All positions", "Latest period", "All status"]);
  const data = [
    [0, "Sep 2026", "3.00", "Completed"], [1, "Sep 2026", "4.00", "Completed"], [2, "Sep 2026", "4.00", "Completed"],
    [3, "Sep 2026", "4.00", "Completed"], [4, "—", "—", "Not Evaluated"], [5, "Sep 2026", "4.00", "Completed"],
    [6, "Sep 2026", "5.00", "Completed"], [7, "Sep 2026", "4.00", "Completed"],
  ];
  const t = await table(s.content, [
    { h: "Employee", grow: true }, { h: "Position", w: 190 }, { h: "Period", w: 100 }, { h: "Hasil", w: 80 }, { h: "Evaluator", w: 120 }, { h: "Status", w: 140 },
  ], data.map(([i, period, score, status]) => ({ highlight: o.highlight === i, cells: [P_(i), PEOPLE[i][2], period, { strong: score }, status === "Completed" ? "Mercury" : "—", { badge: status }] })), { info: "Showing 1–8 of 9" });
  return Object.assign(s, t);
}

async function evaluationForm(frame, o = {}) {
  // FR-01.2: employee, period, result/notes, date, evaluator, optional evidence. No aspects, weights or review labels (not in FR-D4-001).
  return modal(frame, 640, o.title || "Add Evaluation", "Evaluasi baru disimpan sebagai riwayat periode; evaluasi periode sebelumnya tidak ditimpa.", async (body, w) => {
    if (o.error) await notice(body, "Lengkapi tanggal, hasil evaluasi sebelum menyimpan.", "danger");
    await fieldGrid(body, w, [
      ["Employee *", "Alfa · FIX-D4-EMP-002", { select: true, full: true }],
      ["Position", "Finance Staff", { state: "Disabled" }], ["Department", "Finance & Administration", { state: "Disabled" }],
      ["Period *", o.period || "Sep 2026", { select: true }],
      ["Evaluation date *", o.error ? "" : "29/09/2026", o.error ? { state: "Error", helper: "Tanggal wajib diisi." } : {}],
      ["Evaluator *", "Mercury"],
      ["Hasil evaluasi *", o.error ? "Select result" : "4 · Baik", o.error ? { select: true, state: "Error", helper: "Hasil evaluasi wajib dipilih." } : { select: true, helper: "Diisi evaluator; tidak memicu keputusan HR otomatis." }],
      ["Catatan evaluasi *", "Hasil kerja konsisten. Rekomendasi: pelatihan akurasi administrasi lanjutan.", { full: true, helper: "Termasuk rekomendasi/rencana pelatihan bila ada — dapat dipakai sebagai konteks Development Requirement." }],
      ["Evidence / reference", "", { full: true, helper: "Opsional: nomor dokumen atau tautan bukti." }],
    ]);
  }, [["Cancel", "Secondary"], ["Save Evaluation", "Primary"]]);
}

async function performanceDetail(no, o = {}) {
  const s = await screen(no, o.title || "Evaluation Detail", "HR", { menu: MENUS.perf, crumb: "HRMS / Performance Evaluation / Detail" });
  await detailHeader(s.content, "HRMS / Performance Evaluation / Detail", "Alfa", ["Finance Staff", "FIX-D4-EMP-002", "Periode Sep 2026"], "Completed", [["View History"], ["KPI Scorecard"], ["+ New Evaluation", "Primary"]]);
  const { left, right } = await columns2(s.content);
  const summary = await card(left, "Evaluation summary");
  await infoGrid(summary, [["Period", "Sep 2026"], ["Evaluation date", "20 Sep 2026"], ["Evaluator", "Mercury"], ["Hasil evaluasi", "4.00 / 5"], ["Kriteria", SCORE_LABELS[4]], ["Department", "Finance & Administration"]], 190);
  add(summary, await T("Catatan evaluasi", "D4/Heading/Sub", "text/secondary"));
  add(summary, await T("Hasil kerja konsisten dan akurat. Rekomendasi: pelatihan akurasi administrasi lanjutan.", "D4/Body/MD", "text/secondary", 600));
  const evidence = await card(right, "Evidence");
  add(evidence, await T("Laporan rekonsiliasi Sep 2026", "D4/Body/MD", "text/secondary", 330));
  add(evidence, await T("Dicatat oleh Mercury · 21 Sep 2026", "D4/Body/SM", "text/muted", 330));
  const related = await card(right, "Related records");
  related.appendChild(chip("Performance Evaluation", "KPI Scorecard · Sep 2026"));
  related.appendChild(chip("Development Requirement", "Perkuat ketelitian dokumen"));
  add(related, await T("Evaluasi menjadi konteks development bila relevan; tidak ada keputusan HR otomatis dari skor.", "D4/Body/SM", "text/muted", 330));
  return s;
}

async function performanceHistory(no) {
  const s = await screen(no, "Evaluation History", "HR", { menu: MENUS.perf, crumb: "HRMS / Performance Evaluation / History" });
  await detailHeader(s.content, "HRMS / Performance Evaluation / History", "Alfa", ["Finance Staff", "FIX-D4-EMP-002", "3 evaluasi"], null, [["KPI Scorecard"]]);
  const c = await card(s.content, "Evaluation history", { action: await select("All periods", 160) });
  await timeline(c, [
    ["Sep 2026 · 20 Sep 2026", "Evaluasi Sep 2026 — 4.00 (Baik)", "Completed", "Mercury", "Evaluator: Mercury · Rekomendasi: pelatihan akurasi administrasi lanjutan"],
    ["Aug 2026 · 28 Aug 2026", "Evaluasi Aug 2026 — 3.00 (Cukup)", "Completed", "Mercury", "Evaluator: Mercury · Perlu pendampingan rekonsiliasi"],
    ["Jul 2026 · 30 Jul 2026", "Evaluasi Jul 2026 — 4.00 (Baik)", "Completed", "Sun", "Evaluator: Sun"],
  ]);
  return s;
}

async function kpiList(no) {
  const s = await screen(no, "KPI Scorecard List", "HR", { menu: MENUS.kpi, crumb: "HRMS / KPI Scorecard" });
  await pageHeader(s.content, "KPI Scorecard", "5 Core KPI sesuai position, bobot dari katalog V5.1, skor mentah 1–5 (FR-D4-002).", "New Scorecard");
  await filterBar(s.content, "Search employee name or ID", ["All positions", "All departments", "Latest period", "All status"]);
  const data = [[0, "Finance & Administration", "Sep 2026", "3.70", "Completed"], [3, "Finance & Administration", "Sep 2026", KPI_TOTAL, "Completed"], [4, "Finance & Administration", "Aug 2026", "4.05", "Completed"], [6, "Sales & Marketing", "Sep 2026", "3.60", "Completed"], [5, "—", "—", "—", "Not Evaluated"], [1, "—", "—", "—", "Not Evaluated"]];
  await table(s.content, [{ h: "Employee", grow: true }, { h: "KPI role", w: 200 }, { h: "Period", w: 100 }, { h: "Total", w: 70 }, { h: "Status", w: 140 }],
    data.map(([i, role, period, total, status]) => ({ cells: [P_(i), role, period, { strong: total }, { badge: status }] })), { info: "Showing 1–6 of 6" });
  return s;
}

async function kpiForm(frame, o = {}) {
  return modal(frame, 880, "KPI Scorecard", "Lima Core KPI dan bobot mengikuti KPI Scorecard V5.1 sesuai position employee.", async (body, w) => {
    // FR-02.3 header; KPI jabatan follows the employee's position and is read-only (FR-02.1, FR-02.11).
    const quarter = Math.floor((w - 48) / 4);
    const row1 = add(body, box("HORIZONTAL", { gap: 16 }), { fillW: true });
    row1.appendChild(field("Employee *", "Alfa · FIX-D4-EMP-002", { select: true, w: quarter * 2 + 16 }));
    row1.appendChild(field("Period *", "Sep 2026", { select: true, w: quarter }));
    row1.appendChild(field("Position", "Finance Staff", { state: "Disabled", w: quarter }));
    const row2 = add(body, box("HORIZONTAL", { gap: 16 }), { fillW: true });
    row2.appendChild(field("Department", "Finance & Administration", { state: "Disabled", w: quarter }));
    row2.appendChild(field("KPI jabatan", "Finance & Administration", { state: "Disabled", w: quarter }));
    row2.appendChild(field("Tanggal penilaian *", o.error ? "" : "29/09/2026", o.error ? { state: "Error", helper: "Tanggal wajib diisi.", w: quarter } : { w: quarter }));
    row2.appendChild(field("Penilai *", "Mercury", { w: quarter }));
    if (o.error) await notice(body, "Lengkapi periode, tanggal penilaian, penilai, dan skor 1–5 untuk kelima KPI.", "danger");
    const grid = add(body, box("VERTICAL", { name: "KPI Lines", gap: 0, r: 12, stroke: "border/default", clip: true }), { fillW: true });
    const cols = [["KPI", 0], ["Bobot", 56], ["Target", 120], ["Realisasi", 150], ["Skor 1–5", 96], ["Terbobot", 72]];
    const head = add(grid, box("HORIZONTAL", { fill: "bg/app", p: [8, 12, 8, 12], gap: 12 }), { fillW: true });
    for (const [label, width] of cols) add(head, await T(label, "D4/Label/Caps", "text/muted", width || undefined), { grow: !width });
    for (let i = 0; i < KPI_LINES.length; i++) {
      const [name, weight, target, actual, score] = KPI_LINES[i];
      const missing = o.error && i === 2;
      const r = add(grid, box("HORIZONTAL", { p: [8, 12, 8, 12], gap: 12, align: "CENTER" }), { fillW: true });
      edge(r, "top");
      add(r, await T(name, "D4/Heading/Sub", "text/primary", 200, 2), { grow: true });
      add(r, await T(weight + "%", "D4/Body/MD", "text/secondary", 56));
      add(r, await T(target, "D4/Body/SM", "text/secondary", 120, 2));
      add(r, await T(actual, "D4/Body/SM", "text/primary", 150, 2));
      const sel = await select(missing ? "Pilih" : String(score), 96);
      if (missing) sel.strokes = [P("status/danger")];
      r.appendChild(sel);
      add(r, await T(missing ? "—" : ((weight * score) / 100).toFixed(2), "D4/Heading/Sub", "text/primary", 72));
    }
    const total = add(grid, box("HORIZONTAL", { fill: "bg/app", p: [10, 12, 10, 12], gap: 12, align: "CENTER" }), { fillW: true });
    edge(total, "top");
    add(total, await T("Total", "D4/Heading/Sub"), { grow: true });
    add(total, await T("100%", "D4/Heading/Sub", "status/success", 56));
    add(total, await T(o.error ? "—" : KPI_TOTAL + " / 5", "D4/Number/KPI", "text/primary", 100));
    add(body, await T("Kriteria skor: " + [1, 2, 3, 4, 5].map((v) => v + " " + SCORE_LABELS[v]).join(" · ") + ". Skor mentah diisi penilai; sistem tidak mengonversi realisasi menjadi skor dan tidak memberi label tercapai/tidak tercapai.", "D4/Body/SM", "text/muted", w));
    body.appendChild(field("Catatan / rekomendasi atasan", "Pertahankan akurasi; ikutkan workshop akurasi administrasi.", { w }));
  }, [["Cancel", "Secondary"], ["Save Scorecard", "Primary"]]);
}

async function kpiDetail(no) {
  const s = await screen(no, "KPI Scorecard Detail", "HR", { menu: MENUS.kpi, crumb: "HRMS / KPI Scorecard / Detail" });
  await detailHeader(s.content, "HRMS / KPI Scorecard / Detail", "Alfa", ["Finance & Administration", "FIX-D4-EMP-002", "Periode Sep 2026", "Katalog V5.1"], "Completed", [["View History"], ["Open Evaluation"], ["+ New Scorecard", "Primary"]]);
  await metrics(s.content, [["KPI total", KPI_TOTAL, "Σ bobot × skor mentah"], ["Total bobot", "100%", "5 Core KPI"], ["Evaluator", "Mercury", "29 Sep 2026"]], s.contentWidth);
  await table(s.content, [{ h: "KPI", grow: true }, { h: "Bobot", w: 70 }, { h: "Target", w: 150 }, { h: "Realisasi", w: 170 }, { h: "Skor", w: 60 }, { h: "Terbobot", w: 80 }],
    KPI_LINES.map(([name, weight, target, actual, score]) => ({ cells: [{ strong: name }, weight + "%", target, actual, String(score), { strong: ((weight * score) / 100).toFixed(2) }] })), { title: "5 Core KPI", actions: false, footer: false });
  await notice(s.content, "Tidak ada label tercapai/tidak tercapai. Skor mentah dipilih evaluator; realisasi hanya catatan pendukung.", "info");
  return s;
}

async function kpiHistory(no) {
  const s = await screen(no, "KPI Scorecard History", "HR", { menu: MENUS.kpi, crumb: "HRMS / KPI Scorecard / History" });
  await detailHeader(s.content, "HRMS / KPI Scorecard / History", "Alfa", ["Finance Staff", "FIX-D4-EMP-002", "3 scorecard"], null, [["Open Evaluation"]]);
  const c = await card(s.content, "Scorecard history");
  await timeline(c, [
    ["Sep 2026 · 29 Sep 2026", `Finance & Administration — ${KPI_TOTAL}`, "Completed", "Mercury", "Katalog V5.1 · 5 KPI · total bobot 100%"],
    ["Aug 2026 · 28 Aug 2026", "Finance & Administration — 3.80", "Completed", "Mercury", "Katalog V5.1"],
    ["Jul 2026 · 30 Jul 2026", "Finance & Administration — 3.65", "Completed", "Sun", "Katalog V3.1 (versi saat scorecard dibuat)"],
  ]);
  return s;
}

async function competencyList(no, o = {}) {
  const s = await screen(no, o.title || "Competency Gap List", "HR", { menu: MENUS.comp, crumb: "HRMS / Competency Gap" });
  await pageHeader(s.content, "Competency Gap", "Bandingkan requirement position dengan capability dan evidence employee (FR-D4-003).", "New Assessment");
  await filterBar(s.content, "Search employee name or ID", ["All positions", "All status"]);
  const data = [[0, "3 requirement", "1", "Gap", "12 Sep 2026"], [1, "2 requirement", "0", "Terpenuhi", "10 Sep 2026"], [2, "2 requirement", "1", "Gap", "15 Sep 2026"], [3, "3 requirement", "1", "Gap", "29 Sep 2026"], [4, "3 requirement", "0", "Data Belum Cukup", "20 Sep 2026"], [5, "2 requirement", "0", "Terpenuhi", "18 Sep 2026"], [7, "2 requirement", "0", "Terpenuhi", "18 Sep 2026"]];
  const t = await table(s.content, [{ h: "Employee", grow: true }, { h: "Position", w: 160 }, { h: "Requirement", w: 130 }, { h: "Gap", w: 60 }, { h: "Status", w: 170 }, { h: "Last assessed", w: 120 }],
    data.map(([i, req, gap, status, date]) => ({ highlight: o.highlight === i, cells: [P_(i), PEOPLE[i][2], req, { strong: gap }, { badge: status }, date] })), { info: "Showing 1–7 of 7" });
  return Object.assign(s, t);
}

async function competencyDetail(no) {
  const s = await screen(no, "Competency Gap Detail", "HR", { menu: MENUS.comp, crumb: "HRMS / Competency Gap / Detail" });
  await detailHeader(s.content, "HRMS / Competency Gap / Detail", "Alfa", ["Finance Staff", "FIX-D4-EMP-002", "Assessment 29 Sep 2026"], "Gap", [["View History"], ["+ Create Development Requirement", "Primary"]]);
  await table(s.content, [{ h: "Competency", grow: true }, { h: "Required", w: 90 }, { h: "Current", w: 90 }, { h: "Evidence", w: 240 }, { h: "Status", w: 170 }], [
    { cells: [{ strong: "Komunikasi" }, "3", "4", "Bukti komunikasi", { badge: "Terpenuhi" }] },
    { cells: [{ strong: "Akurasi Administrasi" }, "4", "2", "Berkas administrasi", { badge: "Gap" }] },
    { cells: [{ strong: "Pengelolaan Arsip" }, "3", "—", { muted: "Belum ada evidence" }, { badge: "Data Belum Cukup" }] },
  ], { title: "Requirement vs capability", actions: false, footer: false });
  await notice(s.content, "Skill tanpa evidence ditandai Data Belum Cukup, bukan Gap. Training yang selesai tidak otomatis menutup gap; gap ditutup lewat assessment baru.", "info");
  return s;
}

async function competencyHistory(no) {
  const s = await screen(no, "Competency Gap History", "HR", { menu: MENUS.comp, crumb: "HRMS / Competency Gap / History" });
  await detailHeader(s.content, "HRMS / Competency Gap / History", "Alfa", ["Finance Staff", "FIX-D4-EMP-002", "3 assessment"], null, [["Open Detail"]]);
  const c = await card(s.content, "Assessment history");
  await timeline(c, [
    ["29 Sep 2026", "Assessment Finance Staff — 1 gap", "Gap", "Mercury", "Akurasi Administrasi di bawah level (2 dari 4)"],
    ["01 Aug 2026", "Role change: Sales Admin → Finance Staff", "Revisi", "Mercury", "Snapshot position lama tetap tersimpan; dapat menjadi source Development Requirement"],
    ["15 Mar 2026", "Assessment Sales Admin — terpenuhi", "Terpenuhi", "Sun", "Semua requirement Sales Admin terpenuhi"],
  ]);
  return s;
}

const DEV_ROWS = [
  [3, "Perkuat ketelitian dokumen", ["Competency Gap", "Akurasi Administrasi"], "High", "In Progress", "29 Sep 2026"],
  [0, "Rekonsiliasi bank mingguan", ["Performance Evaluation", "Evaluasi Sep 2026"], "Medium", "Planned", "25 Sep 2026"],
  [2, "Sertifikasi keselamatan gudang", ["Competency Gap", "Keselamatan Operasi"], "High", "Identified", "20 Sep 2026"],
  [6, "Orientasi peran Sales Admin", ["Position Change", "Sales → Sales Admin"], "Low", "Completed", "02 Sep 2026"],
  [4, "Pengelolaan arsip digital", ["Performance Evaluation", "Evaluasi Aug 2026"], "Medium", "Planned", "30 Aug 2026"],
];

async function developmentList(no) {
  const s = await screen(no, "Development Requirement List", "HR", { menu: MENUS.dev, crumb: "HRMS / Development Requirement" });
  await pageHeader(s.content, "Development Requirement", "Kebutuhan pengembangan dengan source type dan source reference yang dapat ditelusuri (FR-D4-004).", "Add Requirement");
  await filterBar(s.content, "Search employee or objective", ["All sources", "All status", "All periods"]);
  const t = await table(s.content, [{ h: "Employee", w: 190 }, { h: "Objective", grow: true }, { h: "Source", w: 280 }, { h: "Priority", w: 90 }, { h: "Status", w: 130 }],
    DEV_ROWS.map(([i, objective, source, priority, status]) => ({ cells: [P_(i), { strong: objective }, { chip: source }, { badge: priority }, { badge: status }] })), { info: "Showing 1–5 of 5" });
  return Object.assign(s, t);
}

async function developmentDetail(no) {
  const s = await screen(no, "Development Requirement Detail", "HR", { menu: MENUS.dev, crumb: "HRMS / Development Requirement / Detail" });
  await detailHeader(s.content, "HRMS / Development Requirement / Detail", "Alfa", ["Finance Staff", "FIX-D4-EMP-002", "Revisi 3"], "In Progress", [["View History"], ["Update Status"], ["+ Create Training", "Primary"]]);
  const { left, right } = await columns2(s.content);
  const main = await card(left, "Requirement");
  await infoGrid(main, [["Objective", "Perkuat ketelitian dokumen"], ["Priority", { badge: "High" }], ["Status", { badge: "In Progress" }], ["Created", "12 Sep 2026"], ["Last update", "29 Sep 2026"], ["Updated by", "Mercury"]], 190);
  add(main, await T("Catatan: fokus pada rekonsiliasi jurnal dan verifikasi dokumen pendukung sebelum posting.", "D4/Body/MD", "text/secondary", 600));
  await table(left, [{ h: "Training", grow: true }, { h: "Date", w: 120 }, { h: "Status", w: 130 }], [
    { cells: [{ strong: "Workshop Akurasi Dokumen & Administrasi" }, "06 Oct 2026", { badge: "Planned" }] },
    { cells: [{ strong: "Mentoring rekonsiliasi dengan Finance Lead" }, "15 Sep 2026", { badge: "In Progress" }] },
  ], { title: "Linked trainings", actions: false, footer: false });
  const source = await card(right, "Source (traceability)");
  source.appendChild(chip("Competency Gap", "Akurasi Administrasi · level 2/4"));
  add(source, await T("Dibuat dari requirement berstatus Gap pada assessment 29 Sep 2026. Source tidak berubah walau status requirement diperbarui.", "D4/Body/SM", "text/muted", 330));
  return s;
}

async function developmentHistory(no) {
  const s = await screen(no, "Development Requirement History", "HR", { menu: MENUS.dev, crumb: "HRMS / Development Requirement / History" });
  await detailHeader(s.content, "HRMS / Development Requirement / History", "Perkuat ketelitian dokumen", ["Alfa", "Source: Competency Gap", "3 revisi"], "In Progress", [["Open Detail"]]);
  const c = await card(s.content, "Revision history");
  await timeline(c, [
    ["Revisi 3 · 29 Sep 2026", "Status → In Progress", "In Progress", "Mercury", "Mentoring dimulai"],
    ["Revisi 2 · 18 Sep 2026", "Status → Planned", "Planned", "Mercury", "Workshop dijadwalkan Okt 2026"],
    ["Revisi 1 · 12 Sep 2026", "Requirement dibuat dari Competency Gap", "Identified", "Mercury", "Source: Akurasi Administrasi (level 2/4)"],
  ]);
  return s;
}

const TRAIN_ROWS = [
  [3, "Workshop Akurasi Dokumen & Administrasi", ["Development Requirement", "Perkuat ketelitian dokumen"], "06 Oct 2026", "Planned", "—"],
  [3, "Mentoring rekonsiliasi dengan Finance Lead", ["Development Requirement", "Perkuat ketelitian dokumen"], "15 Sep 2026", "In Progress", "—"],
  [0, "Kelas rekonsiliasi bank", ["Development Requirement", "Rekonsiliasi bank mingguan"], "02 Oct 2026", "Planned", "—"],
  [6, "Onboarding Sales Admin", ["Development Requirement", "Orientasi peran Sales Admin"], "05 Sep 2026", "Completed", "Lulus, sertifikat internal"],
  [2, "Sertifikasi K3 gudang", ["Development Requirement", "Sertifikasi keselamatan gudang"], "20 Oct 2026", "Cancelled", "Jadwal vendor batal"],
];

async function trainingList(no, o = {}) {
  const s = await screen(no, o.title || "Training Tracking List", "HR", { menu: MENUS.train, crumb: "HRMS / Training Tracking" });
  await pageHeader(s.content, "Training Tracking", "Aktivitas pengembangan yang terhubung ke Development Requirement (FR-D4-005).", "Add Training");
  await filterBar(s.content, "Search employee or training", ["All periods", "All status", "All source requirements"]);
  const t = await table(s.content, [{ h: "Employee", w: 200 }, { h: "Activity", grow: true }, { h: "Source requirement", w: 230, refOnly: true }, { h: "Date", w: 110 }, { h: "Status", w: 130 }],
    TRAIN_ROWS.map(([i, activity, source, date, status]) => ({ cells: [P_(i), { strong: activity }, { chip: source }, date, { badge: status }] })), { info: "Showing 1–5 of 5" });
  return Object.assign(s, t);
}

async function trainingDetail(no) {
  const s = await screen(no, "Training Detail", "HR", { menu: MENUS.train, crumb: "HRMS / Training Tracking / Detail" });
  await detailHeader(s.content, "HRMS / Training Tracking / Detail", "Delta", ["Sales Administration Associate", "FIX-D4-EMP-006", "Versi 3"], "Completed", [["View History"], ["Update Progress", "Primary"]]);
  const { left, right } = await columns2(s.content);
  const main = await card(left, "Training");
  await infoGrid(main, [["Activity", "Onboarding Sales Admin"], ["Date", "05 Sep 2026"], ["Status", { badge: "Completed" }], ["Result", "Lulus, sertifikat internal"], ["Last update", "12 Sep 2026"], ["Updated by", "Mercury"]], 190);
  await notice(left, "Training Completed tidak otomatis mengubah competency gap menjadi terpenuhi. Gap tetap terbuka sampai ada reassessment.", "warning");
  const source = await card(right, "Source (traceability)");
  source.appendChild(chip("Development Requirement", "Orientasi peran Sales Admin"));
  source.appendChild(chip("Position Change", "Sales → Sales Admin"));
  return s;
}

async function trainingHistory(no) {
  const s = await screen(no, "Training History", "HR", { menu: MENUS.train, crumb: "HRMS / Training Tracking / History" });
  await detailHeader(s.content, "HRMS / Training Tracking / History", "Onboarding Sales Admin", ["Delta", "Source: Orientasi peran Sales Admin", "3 versi"], "Completed", [["Open Detail"]]);
  const c = await card(s.content, "Version history");
  await timeline(c, [
    ["Versi 3 · 12 Sep 2026", "Status → Completed", "Completed", "Mercury", "Result: Lulus, sertifikat internal. Gap tidak otomatis tertutup."],
    ["Versi 2 · 05 Sep 2026", "Status → In Progress", "In Progress", "Mercury", "Sesi pertama berjalan"],
    ["Versi 1 · 01 Sep 2026", "Training dibuat dari Development Requirement", "Planned", "Mercury", "Source: Orientasi peran Sales Admin"],
  ]);
  return s;
}

async function dashboard(no, o = {}) {
  const width = o.width || 1440;
  const compact = width < 1024;
  // Below 1440 the sidebar leaves too little room, so secondary columns (position, open dev.) drop first.
  const full = width >= 1440;
  const s = await screen(no, o.title || "People Dashboard", "HR", { menu: MENUS.dash, crumb: "HRMS / People Dashboard", width });
  await pageHeader(s.content, "People Dashboard", "Ringkasan KPI, performance, competency gap, development, dan training per employee pada periode yang sama (FR-D4-006).");
  await filterBar(s.content, "Search employee name or ID", ["All positions", "Latest period"], compact);
  if (o.empty) {
    const c = await card(s.content, null, { p: 48 });
    c.counterAxisAlignItems = "CENTER";
    const circle = add(c, box("HORIZONTAL", { fill: "bg/muted", r: 999, p: 16 }));
    circle.appendChild(icon("inbox", "#64748B", 28));
    add(c, await T("Tidak ada employee yang cocok", "D4/Heading/Section"));
    const text = add(c, await T("Ubah kata kunci, position, atau periode, lalu coba lagi.", "D4/Body/MD", "text/secondary", 420));
    text.textAlignHorizontal = "CENTER";
    c.appendChild(button("Reset filter", "Secondary"));
    return s;
  }
  // One period per row (FR-06.1); no aggregate management metrics (out of scope #12).
  const rows = [[3, "Sep 2026", KPI_TOTAL, "4.00", "Gap", "1", "Planned"], [5, "Sep 2026", "—", "4.00", "Terpenuhi", "—", null], [2, "Sep 2026", "—", "4.00", "Gap", "1", "In Progress"], [6, "Sep 2026", "3.60", "5.00", "Terpenuhi", "—", "Completed"], [0, "Sep 2026", "3.70", "3.00", "Gap", "—", null], [4, "Aug 2026", o.invalid ? { danger: "Data tidak valid" } : "4.05", "—", "Data Belum Cukup", "—", null]];
  const cols = !full
    ? [{ h: "Employee", w: compact ? 190 : undefined, grow: !compact }, { h: "Period", w: 90 }, { h: "KPI total", w: 80 }, { h: "Performance", w: 100 }, { h: "Competency", w: 160 }, { h: "Training", w: 120 }]
    : [{ h: "Employee", grow: true }, { h: "Position", w: 150 }, { h: "Period", w: 80 }, { h: "KPI total", w: 70 }, { h: "Performance", w: 90 }, { h: "Competency", w: 140 }, { h: "Open dev.", w: 70 }, { h: "Training", w: 120 }];
  const t = await table(s.content, cols, rows.map(([i, period, kpi, perf, gap, dev, training]) => ({
    cells: (!full ? [P_(i), period] : [P_(i), PEOPLE[i][2], period]).concat([typeof kpi === "string" ? { strong: kpi } : kpi, { strong: perf }, { badge: gap }]).concat(!full ? [] : [dev]).concat([training ? { badge: training } : "—"]),
  })), { info: "Showing 1–6 of 8" });
  return Object.assign(s, t);
}

async function employeeProfile(no, o = {}) {
  const s = await screen(no, o.title || "Employee Performance Profile", "HR", { menu: MENUS.dash, crumb: "HRMS / People Dashboard / Employee" });
  await detailHeader(s.content, "HRMS / People Dashboard / Employee", "Alfa", ["Finance Staff", "FIX-D4-EMP-002", "Finance & Administration"], null, [["View KPI Scorecard"], ["View Evaluation"]]);
  const bar = add(s.content, box("HORIZONTAL", { name: "Period", gap: 16, align: "CENTER", fill: "bg/surface", r: 16, p: [12, 16, 12, 16], stroke: "border/default" }), { fillW: true });
  bar.appendChild(await select("Sep 2026", 180));
  add(bar, await T("Menampilkan periode Sep 2026 untuk KPI dan performance.", "D4/Body/MD", "text/secondary"), { grow: true });
  if (o.invalid) await notice(s.content, "Scorecard periode ini tidak memiliki lima KPI dengan total bobot 100%. Periksa data di halaman KPI Scorecard sebelum dipakai.", "warning");
  const { left, right } = await columns2(s.content, 400);
  // FR-06.2: five KPI with target and realisation from the same scorecard as the detail page (FR-06.8).
  await table(left, [{ h: "Core KPI", grow: true }, { h: "Bobot", w: 56 }, { h: "Target", w: 100 }, { h: "Realisasi", w: 110 }, { h: "Skor", w: 46 }, { h: "Terbobot", w: 70 }],
    KPI_LINES.slice(0, o.invalid ? 4 : 5).map(([name, weight, target, actual, score]) => ({ cells: [{ strong: name }, weight + "%", target, actual, String(score), { strong: ((weight * score) / 100).toFixed(2) }] })), { title: o.invalid ? "KPI scorecard · Total —" : "KPI scorecard · Total " + KPI_TOTAL + " / 5", actions: false, footer: false });
  const perf = await card(right, "Performance evaluation", { action: await T("View source →", "D4/Heading/Sub", "primary/600") });
  add(perf, await T("4.00 / 5 · " + SCORE_LABELS[4], "D4/Number/KPI"));
  add(perf, await T("Sep 2026 · Evaluator Mercury", "D4/Body/SM", "text/secondary", 330));
  add(perf, await T("Hasil kerja konsisten dan akurat. Rekomendasi: pelatihan akurasi administrasi lanjutan.", "D4/Body/SM", "text/muted", 330, 3));
  for (const [title, lines] of [["Competency gap", [["Terpenuhi", "Komunikasi · 4/3"], ["Gap", "Akurasi Administrasi · 2/4"], ["Data Belum Cukup", "Pengelolaan Arsip · —/3"]]], ["Development & training", [["Identified", "Perkuat akurasi administrasi"], ["Planned", "Workshop Akurasi Administrasi · 08 Oct 2026"]]]]) {
    const c = await card(right, title, { action: await T("View source →", "D4/Heading/Sub", "primary/600") });
    for (const [status, text] of lines) {
      const r = add(c, box("HORIZONTAL", { gap: 10, align: "CENTER" }), { fillW: true });
      r.appendChild(badge(status));
      add(r, await T(text, "D4/Body/MD", "text/secondary"), { grow: true });
    }
  }
  return s;
}

async function stateScreen(no, title, kind) {
  const s = await screen(no, title, "HR", { menu: MENUS.perf, crumb: "HRMS / Performance Evaluation" });
  await pageHeader(s.content, "Performance Evaluation", "Catat dan telusuri evaluasi kinerja per employee dan periode (FR-D4-001).", kind === "permission" ? null : "Add Evaluation");
  if (kind !== "permission") await filterBar(s.content, "Search employee name or ID", ["All positions", "Latest period", "All status"]);
  const c = await card(s.content, null, { p: kind === "loading" ? 0 : 48 });
  if (kind === "loading") {
    for (let i = 0; i < 6; i++) {
      const r = add(c, box("HORIZONTAL", { p: [16, 20, 16, 20], gap: 24, align: "CENTER" }), { fillW: true });
      if (i) edge(r, "top");
      for (const w of [36, 220, 140, 100, 80, 120]) { const bar = figma.createRectangle(); bar.resize(w, w === 36 ? 36 : 12); bar.cornerRadius = w === 36 ? 18 : 6; bar.fills = [P("bg/muted")]; r.appendChild(bar); }
    }
    return s;
  }
  c.counterAxisAlignItems = "CENTER";
  const spec = {
    empty: ["inbox", "#64748B", "Belum ada evaluasi", "Belum ada evaluasi untuk periode ini. Tambahkan evaluasi pertama atau ubah filter.", ["+ Add Evaluation", "Primary"]],
    error: ["alert", "#D9364F", "Data gagal dimuat", "Koneksi ke server terputus. Coba lagi beberapa saat lagi.", ["Retry", "Primary"]],
    permission: ["lock", "#64748B", "Data tidak tersedia", "Data tidak ditemukan atau akun Anda tidak memiliki akses ke halaman ini.", ["← Kembali ke Performance Evaluation", "Secondary"]],
  }[kind];
  const circle = add(c, box("HORIZONTAL", { fill: kind === "error" ? "status/danger-bg" : "bg/muted", r: 999, p: 16 }));
  circle.appendChild(icon(spec[0], spec[1], 28));
  add(c, await T(spec[2], "D4/Heading/Section"));
  const text = add(c, await T(spec[3], "D4/Body/MD", "text/secondary", 420));
  text.textAlignHorizontal = "CENTER";
  c.appendChild(button(spec[4][0], spec[4][1]));
  return s;
}

// ---------- prototype ----------

// Links are resolved after every frame exists: a target built later in the same row (01 → 02) or in a
// later row (14 → 18, 03 → 34) is not in FRAMES yet when the source is created.
const LINKS = [];

function link(from, toNo) {
  if (from) LINKS.push([from, toNo]);
}

async function applyLinks(page) {
  let applied = 0;
  for (const [from, no] of LINKS) {
    const target = FRAMES[no] || page.children.find((n) => n.type === "FRAME" && n.name.startsWith(no + " HRMS D4 - "));
    if (!target || from.removed) continue;
    try {
      await from.setReactionsAsync([{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", destinationId: target.id, navigation: "NAVIGATE", transition: { type: "SMART_ANIMATE", easing: { type: "EASE_OUT" }, duration: 0.2 }, preserveScrollPosition: false }] }]);
      applied++;
    } catch (error) {
      console.warn("Prototype link skipped", error);
    }
  }
  return applied;
}

// ---------- main ----------

async function main() {
  await figma.loadAllPagesAsync();
  for (const v of await figma.variables.getLocalVariablesAsync("COLOR")) V[v.name] = v;
  for (const s of await figma.getLocalTextStylesAsync()) S[s.name] = s;
  for (const node of figma.root.findAllWithCriteria({ types: ["COMPONENT_SET", "COMPONENT"] })) {
    if (node.type === "COMPONENT" && node.parent && node.parent.type === "COMPONENT_SET") continue;
    SETS[node.name] = node;
  }
  const required = ["Button", "Status Badge", "Source Chip", "Row Action Trigger", "Menu Item", "Toast", "Metric Card", "Form Field", "Sidebar", "Topbar", "Pagination"];
  const missing = required.filter((name) => !SETS[name]);
  if (missing.length) throw new Error("Komponen tidak ditemukan: " + missing.join(", ") + ". Jalankan plugin di file PISD – D4 V2.");
  if (!S["D4/Body/MD"] || !V["primary/600"]) throw new Error("Token D4 V2 tidak ditemukan. Jalankan plugin di file PISD – D4 V2.");

  const fonts = new Map();
  for (const style of Object.values(S)) fonts.set(style.fontName.family + "|" + style.fontName.style, style.fontName);
  await Promise.all([...fonts.values()].map((font) => figma.loadFontAsync(font)));

  const page = figma.root.children.find((p) => p.name === "D4") || figma.currentPage;
  await figma.setCurrentPageAsync(page);
  for (const node of page.children.slice()) if (GENERATED.test(node.name)) node.remove();
  const board = page.children.find((n) => n.name === "00 Foundations & Components");
  const originY = board ? board.y + board.height + 400 : 0;

  const rows = [
    ["Baris 1 · Performance Evaluation (FR-D4-001)", async () => {
      const list = await performanceList("01");
      if (list.triggers[3]) link(list.triggers[3], "02");
      const open = await performanceList("02", { title: "Performance List - Action Menu Open", highlight: 3 });
      const menu = await menuAt(open.frame, open.triggers[3], ["View Detail", "View History", "Open KPI Scorecard", "Add Evaluation"]);
      link(menu.children[0], "05"); link(menu.children[1], "06"); link(menu.children[3], "03");
      const add1 = await performanceList("03", { title: "Add Evaluation Modal" });
      await evaluationForm(add1.frame);
      const add2 = await performanceList("04", { title: "Add Evaluation - Validation Error" });
      await evaluationForm(add2.frame, { error: true });
      await performanceDetail("05");
      await performanceHistory("06");
      const revise = await performanceDetail("07", { title: "New Evaluation Modal (revisi periode)" });
      await evaluationForm(revise.frame, { title: "New Evaluation", period: "Oct 2026" });
    }],
    ["Baris 2 · KPI Scorecard (FR-D4-002)", async () => {
      await kpiList("08");
      const form = await kpiList("09"); FRAMES["09"].name = "09 HRMS D4 - KPI Scorecard Form Modal (HR)"; await kpiForm(form.frame);
      const invalid = await kpiList("10"); FRAMES["10"].name = "10 HRMS D4 - KPI Form - Validation (HR)"; await kpiForm(invalid.frame, { error: true });
      await kpiDetail("11");
      await kpiHistory("12");
    }],
    ["Baris 3 · Competency Gap (FR-D4-003)", async () => {
      const list = await competencyList("13");
      if (list.triggers[3]) link(list.triggers[3], "14");
      const open = await competencyList("14", { title: "Competency List - Action Menu Open", highlight: 3 });
      const menu = await menuAt(open.frame, open.triggers[3], ["View Detail", "View History", "Create Development Requirement"]);
      link(menu.children[0], "15"); link(menu.children[2], "18");
      await competencyDetail("15");
      await competencyHistory("16");
    }],
    ["Baris 4 · Development Requirement (FR-D4-004)", async () => {
      await developmentList("17");
      const form = await developmentList("18"); FRAMES["18"].name = "18 HRMS D4 - Add Development Requirement Modal (HR)";
      await modal(form.frame, 640, "Add Development Requirement", "Setiap requirement wajib punya source. Dibuat dari Competency Gap Alfa.", async (body, w) => {
        await fieldGrid(body, w, [
          ["Employee *", "Alfa · FIX-D4-EMP-002", { select: true }], ["Source type *", "Competency Gap", { select: true }],
          ["Source reference *", "Akurasi Administrasi · level 2/4", { select: true, full: true }],
          ["Objective *", "Perkuat ketelitian dokumen", { full: true }], ["Priority *", "High", { select: true }], ["Initial status", "Identified", { state: "Disabled" }],
          ["Notes", "Fokus rekonsiliasi jurnal", { full: true }],
        ]);
      }, [["Cancel", "Secondary"], ["Save", "Primary"]]);
      await developmentDetail("19");
      await developmentHistory("20");
    }],
    ["Baris 5 · Training Tracking (FR-D4-005)", async () => {
      await trainingList("21");
      const add1 = await trainingList("22", { title: "Add Training Modal" });
      await modal(add1.frame, 640, "Add Training", "Training selalu mengacu pada Development Requirement milik employee yang sama.", async (body, w) => {
        await fieldGrid(body, w, [
          ["Development requirement *", "Alfa · Perkuat ketelitian dokumen", { select: true, full: true }],
          ["Activity *", "Workshop Akurasi Dokumen & Administrasi", { full: true }], ["Date *", "06/10/2026"], ["Status *", "Planned", { select: true }],
          ["Notes", "Vendor internal Finance", { full: true }],
        ]);
      }, [["Cancel", "Secondary"], ["Save", "Primary"]]);
      const upd = await trainingList("23", { title: "Update Progress Modal" });
      await modal(upd.frame, 640, "Update Progress", "Perubahan disimpan sebagai versi baru; riwayat tidak ditimpa.", async (body, w) => {
        await fieldGrid(body, w, [["Status *", "Completed", { select: true }], ["Result *", "Lulus, sertifikat internal"], ["Notes", "Sesi terakhir 12 Sep 2026", { full: true }]]);
        await notice(body, "Status Completed tidak otomatis menutup competency gap.", "warning");
      }, [["Cancel", "Secondary"], ["Save", "Primary"]]);
      await trainingDetail("24");
      await trainingHistory("25");
    }],
    ["Baris 6 · People Dashboard (FR-D4-006)", async () => {
      const d = await dashboard("26");
      if (d.triggers[0]) link(d.triggers[0], "27");
      await employeeProfile("27");
      await dashboard("28", { title: "People Dashboard - 1280", width: 1280 });
      await dashboard("29", { title: "People Dashboard - 768", width: 768 });
      await dashboard("35", { title: "People Dashboard - Empty State", empty: true });
      await employeeProfile("36", { title: "Employee Profile - Validation State", invalid: true });
    }],
    ["Baris 7 · System States", async () => {
      await stateScreen("30", "Loading State", "loading");
      await stateScreen("31", "Empty State", "empty");
      await stateScreen("32", "Error State", "error");
      await stateScreen("33", "No Permission - Not Found", "permission");
      const ok = await performanceList("34", { title: "Success Toast" });
      toast(ok.frame, "Evaluation saved successfully.");
    }],
  ];

  let y = originY;
  for (const [title, build] of rows) {
    const before = new Set(Object.keys(FRAMES));
    const label = await T(title, "D4/Display/Page Title");
    label.name = title;
    page.appendChild(label);
    label.x = 0;
    label.y = y;
    await build();
    let x = 0;
    for (const no of Object.keys(FRAMES).filter((k) => !before.has(k)).sort()) {
      const frame = FRAMES[no];
      page.appendChild(frame);
      frame.x = x;
      frame.y = y + 80;
      x += frame.width + COL_GAP;
    }
    y += 80 + H + ROW_GAP;
  }

  const footer = FRAMES["03"] && FRAMES["03"].findOne((n) => n.name === "Modal Footer");
  if (footer) link(footer.children[footer.children.length - 1], "34");
  for (const frame of Object.values(FRAMES)) fitChips(frame);
  await applyLinks(page);
  figma.viewport.scrollAndZoomIntoView(Object.values(FRAMES));
  return Object.keys(FRAMES).length;
}

main()
  .then((count) => figma.closePlugin(`D4 V2: ${count} frame dibuat.`))
  .catch((error) => figma.closePlugin("D4 V2 gagal: " + (error && error.message ? error.message : String(error))));
