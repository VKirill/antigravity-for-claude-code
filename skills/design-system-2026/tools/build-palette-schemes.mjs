#!/usr/bin/env node
// build-palette-schemes.mjs — SOURCE OF TRUTH generator for references/palette-schemes.md
// Computes OKLCH + WCAG contrast deterministically from raw hex, merges with authored
// metadata (mood / use-when / do-dont / why), emits the markdown catalog.
// Re-run after editing PALETTES to regenerate the catalog. Zero deps.
//   node build-palette-schemes.mjs > ../references/palette-schemes.md
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/* ---------- color math (Ottosson OKLab) + WCAG ---------- */
const srgb = (h) => { h = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function oklch(hex) {
  const [r, g, b] = srgb(hex).map(lin);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const [L_, M_, S_] = [Math.cbrt(l), Math.cbrt(m), Math.cbrt(s)];
  const L = 0.2104542553 * L_ + 0.793617785 * M_ - 0.0040720468 * S_;
  const A = 1.9779984951 * L_ - 2.428592205 * M_ + 0.4505937099 * S_;
  const B = 0.0259040371 * L_ + 0.7827717662 * M_ - 0.808675766 * S_;
  let C = Math.hypot(A, B), H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(0)})`;
}
const Y = (hex) => { const [r, g, b] = srgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [Y(a) + 0.05, Y(b) + 0.05]; return Math.max(x, y) / Math.min(x, y); };
const aa = (c) => (c >= 4.5 ? "AA" : c >= 3 ? "AA-lg" : "✗ decor-only");

/* ---------- the catalog data (roles = raw hex; metadata = authored) ---------- */
const PALETTES = [
  {
    id: "PAL-001", name: "Mar Sereno", source: "ColorHunt coastal sand+teal (re-tokenized)",
    mood: ["спокойный", "прибрежный", "тёплый", "доверие", "женственный без ноющего"],
    industry: ["салон красоты", "wellness", "клиника", "локальные услуги"],
    audience: "женщины 30–55, решают на мобильном, ценят прозрачность и лёгкость",
    use_when: "бренд про море/побережье/свежесть; конкуренты монохромные → дифференциация тёплым светом",
    avoid_when: "финтех/B2B-строгость; нужен тёмный «премиум-люкс»",
    type_pairing: "TYP-001 (Fraunces + Manrope)",
    roles: { bg: "#F7F2EA", surface: "#FFFFFF", ink: "#16302F", primary: "#1E6E6A", "primary-dark": "#123F3C", accent: "#C2643F", cta: "#1E8A4C", border: "#E5DFD3" },
    distribution: "60% арена/white · 30% ink+бирюза (структура) · 10% терракота + зелёный CTA",
    do: ["зелёный — ТОЛЬКО на CTA-кнопках", "терракота мелкими дозами (тепло)", "цены в primary-dark"],
    dont: ["терракота для основного текста (провалит AA)", "второй холодный акцент → вернётся суп v3", "белый текст <14px на cta"],
    why: "холодный бренд (hue 190) + тёплый акцент (hue 42) = комплементарная пара; функциональный зелёный (153) изолирован ролью. Три тона по РОЛЯМ, не четыре в драке.",
  },
  {
    id: "PAL-002", name: "Arena & Salvia", source: "Coolors warm-greige+sage (re-tokenized)",
    mood: ["органический", "спокойный", "тёплый-нейтральный", "натуральный"],
    industry: ["spa", "wellness", "органическая косметика", "йога/студия"],
    audience: "аудитория, ищущая «чистоту/натуральность»; 25–50",
    use_when: "бренд экологичный/натуральный; CTA = WhatsApp/зелёный (бренд-зелёный = семья, ноль конфликта)",
    avoid_when: "нужна яркость/энергия; детский/игровой тон",
    type_pairing: "TYP-002 (Cormorant + Inter)",
    roles: { bg: "#F4EFE6", surface: "#FBF8F2", ink: "#2C2A24", primary: "#5C7A60", "primary-dark": "#3F5743", accent: "#BC6C4F", cta: "#2E8A57", border: "#E4DCCD" },
    distribution: "65% greige · 25% espresso+шалфей · 10% глина/clay + CTA",
    do: ["держать всё в землистой гамме", "шалфей для структуры, глина для тепла", "крупный воздух между секциями"],
    dont: ["добавлять холодный синий (разобьёт землю)", "глина для мелкого текста", "чистый чёрный для текста (используй espresso ink)"],
    why: "бренд-зелёный и CTA-зелёный — одна семья → конфликт WhatsApp-зелёного, который убил v3, физически отсутствует. Глина даёт единственную тёплую ноту.",
  },
  {
    id: "PAL-003", name: "Azahar", source: "ColorHunt blush+plum (re-tokenized)",
    mood: ["женственный", "мягкий", "премиум-beauty", "тёплый"],
    industry: ["ногтевой/бровист", "косметология", "свадебное", "бутик"],
    audience: "женщины 20–45, эстетика «нежно и дорого»",
    use_when: "максимально женственный beauty-бренд; акцент-золото для премиум-ноты",
    avoid_when: "нужен зелёный CTA как главный (плам+зелёный = напряжение — см. dont)",
    type_pairing: "TYP-003 (Playfair Display + Mulish)",
    roles: { bg: "#FAF3EF", surface: "#FFFFFF", ink: "#2E2630", primary: "#8A5A6B", "primary-dark": "#5E3B49", accent: "#C09A4B", cta: "#2E8A57", border: "#EEE1D9" },
    distribution: "60% blush/white · 30% plum (структура) · 10% золото-декор + CTA",
    do: ["золото ТОЛЬКО как декор/крупное (провалило AA для текста)", "плам для заголовков/ссылок", "тонкие линии border"],
    dont: ["золото для текста (контраст 2.6:1 — нечитаемо)", "зелёный CTA крупными пятнами (чужой плам-гамме)", "тёплый + холодный одновременно"],
    why: "плам (hue 357) + золото (hue 84) = классическая премиум-beauty пара. CTA-зелёный — компромисс: оставить ТОЛЬКО кнопкой WhatsApp, иначе ввести rose-CTA.",
  },
  {
    id: "PAL-004", name: "Tinta & Coral", source: "Coolors navy+coral (re-tokenized)",
    mood: ["профессиональный-дружелюбный", "чистый", "уверенный", "энергичный-в-меру"],
    industry: ["SaaS", "агентство", "консалтинг", "стартап-лендинг"],
    audience: "ЛПР/профессионалы 28–50, нужно доверие + лёгкая живость",
    use_when: "B2B/продукт, где строгость + одна тёплая искра конверсии",
    avoid_when: "wellness/уют; роскошь",
    type_pairing: "TYP-004 (Space Grotesk + Inter)",
    roles: { bg: "#F6F7F9", surface: "#FFFFFF", ink: "#16202E", primary: "#1F3A5F", "primary-dark": "#13263F", accent: "#E2674A", cta: "#1F6FEB", border: "#E2E6EC" },
    distribution: "70% white/cool-grey · 20% navy (структура) · 10% синий CTA + коралл-акцент",
    do: ["navy для каркаса/текста-акцента", "синий CTA для действий", "коралл точечно (highlight/иконки)"],
    dont: ["коралл и синий равными площадями", "тёплый бежевый фон (сломает чистоту)", "больше двух акцентов"],
    why: "navy = доверие, синий CTA = действие (одна холодная семья, читается как система), коралл = единственная тёплая искра, чтобы не было «холодно-корпоративно».",
  },
  {
    id: "PAL-005", name: "Bosque Profundo", source: "ColorHunt deep-green+cream (re-tokenized)",
    mood: ["премиум", "эко", "устойчивый", "землистый-богатый"],
    industry: ["финансы-эко", "архитектура", "органик-премиум", "недвижимость"],
    audience: "состоятельная аудитория 35–60, ценит «солидно и натурально»",
    use_when: "премиум с природным характером; тёмно-зелёный как роскошь, не как эко-клише",
    avoid_when: "бюджетный/массовый тон; детский",
    type_pairing: "TYP-005 (Fraunces + Söhne/Inter)",
    roles: { bg: "#F3F0E7", surface: "#FBFAF4", ink: "#1A241C", primary: "#2C4A36", "primary-dark": "#1E3325", accent: "#B08423", cta: "#2C7A4B", border: "#E0DBCB" },
    distribution: "60% крем · 30% тёмно-зелёный (структура/блоки) · 10% латунь + CTA",
    do: ["тёмно-зелёные full-bleed блоки для премиума", "латунь как тонкий люкс-акцент", "крупная типографика"],
    dont: ["латунь крупными заливками", "яркий неон-зелёный", "холодный синий"],
    why: "тёмно-зелёный (hue ~150) + латунь (hue 84) = богатая природная пара; CTA в той же зелёной семье, латунь — только акцентная роскошь.",
  },
  {
    id: "PAL-006", name: "Noche Ámbar", source: "Coolors near-black+amber (re-tokenized)",
    mood: ["тёмный", "люкс", "драматичный", "тёплый-контраст"],
    industry: ["ресторан/бар", "фотограф/портфолио", "ивент", "премиум-продукт"],
    audience: "аудитория «вечер/событие», ценит атмосферу",
    use_when: "тёмная тема ОБОСНОВАНА брендом (вечер, премиум, шоу); один тёплый акцент",
    avoid_when: "клиника/wellness/детское; нужна максимальная читаемость длинных текстов",
    type_pairing: "TYP-006 (Bricolage Grotesque + Inter)",
    roles: { bg: "#14110E", surface: "#1F1B16", ink: "#F3EDE3", primary: "#E0A33E", "primary-dark": "#B97F22", accent: "#D9603C", cta: "#E0A33E", border: "#332C24" },
    distribution: "75% near-black · 15% тёплый светлый текст · 10% амбер CTA/акцент",
    do: ["амбер для CTA и ключевых акцентов на тёмном", "крупный светлый текст", "много негативного пространства"],
    dont: ["мелкий серый текст на тёмном (низкий контраст)", "несколько ярких акцентов", "холодный синий на тёплом тёмном"],
    why: "тёмная база + тёплый амбер (hue ~75) = драма и премиум; единственный акцент работает и как бренд, и как CTA — предельная дисциплина.",
  },
  {
    id: "PAL-007", name: "Cielo Claro", source: "ColorHunt airy-blue+white (re-tokenized)",
    mood: ["воздушный", "чистый", "технологичный", "спокойный"],
    industry: ["health-tech", "SaaS", "образование", "финтех-дружелюбный"],
    audience: "широкая, нужна ясность и спокойное доверие",
    use_when: "продукт про ясность/здоровье/технологию; светлый и просторный",
    avoid_when: "роскошь/уют; нужен «тёплый» эмоциональный тон",
    type_pairing: "TYP-007 (Schibsted Grotesk + Inter)",
    roles: { bg: "#F4F8FB", surface: "#FFFFFF", ink: "#13212E", primary: "#1E6DA8", "primary-dark": "#144C77", accent: "#23B0A6", cta: "#1E6DA8", border: "#DEE8F0" },
    distribution: "70% white/ледяной · 20% синий (структура) · 10% бирюза-акцент + CTA",
    do: ["синий для каркаса и CTA", "бирюза как свежий акцент", "тонкие тени, много воздуха"],
    dont: ["тёплый бежевый (сломает воздух)", "третий акцент", "тяжёлые сатурированные заливки"],
    why: "синий (hue ~250) + бирюза (hue ~190) — соседи, поэтому холодная гамма читается как одна свежая система; тёплого нет намеренно.",
  },
  {
    id: "PAL-008", name: "Terracota Cálida", source: "Coolors terracotta+olive+cream (re-tokenized)",
    mood: ["ремесленный", "тёплый", "уютный", "натуральный"],
    industry: ["кофейня/пекарня", "локальная еда", "ремесло/handmade", "бутик-отель"],
    audience: "локальная аудитория, ценит «душевно и по-настоящему»",
    use_when: "тёплый ремесленный бренд; земля и солнце",
    avoid_when: "tech/строгий B2B; холодный премиум",
    type_pairing: "TYP-008 (Fraunces + Work Sans)",
    roles: { bg: "#F7F0E4", surface: "#FFFBF3", ink: "#2A2018", primary: "#A8542E", "primary-dark": "#7E3D20", accent: "#6B7A3A", cta: "#A8542E", border: "#E8DDC9" },
    distribution: "60% крем · 30% терракота (структура) · 10% олива-акцент + CTA",
    do: ["терракота для каркаса/CTA", "олива как природный акцент", "тёплые тени"],
    dont: ["холодный синий/серый", "неон", "олива для мелкого текста"],
    why: "терракота (hue ~42) + олива (hue ~120) = земля+растение, тёплая природная пара; CTA в терракотовой семье — единый тёплый мир.",
  },
  {
    id: "PAL-009", name: "Grafito & Lima", source: "Coolors neutral-dark+lime (re-tokenized)",
    mood: ["смелый", "современный", "энергичный", "минималистичный"],
    industry: ["стартап", "tech-продукт", "креатив-агентство", "фитнес"],
    audience: "молодая активная 22–40, ценит энергию и чёткость",
    use_when: "нужен бодрый современный характер; один электрический акцент на нейтрали",
    avoid_when: "wellness/нежность; консервативный B2B",
    type_pairing: "TYP-009 (Clash/Anton + Inter)",
    roles: { bg: "#F4F5F3", surface: "#FFFFFF", ink: "#191C1A", primary: "#23262B", "primary-dark": "#101316", accent: "#5FA800", cta: "#23262B", border: "#E3E5E2" },
    distribution: "70% white/графит · 20% тёмный графит (структура) · 10% лайм-акцент",
    do: ["графит для каркаса/CTA", "лайм как единственный электрический акцент", "жирная крупная типографика"],
    dont: ["второй яркий акцент", "лайм для длинного текста", "тёплый бежевый фон"],
    why: "почти-монохром (графит) + один электрический лайм (hue ~130) = смело и дисциплинированно; акцент бьёт именно потому что один.",
  },
  {
    id: "PAL-010", name: "Lavanda Suave", source: "ColorHunt soft-lavender+grey (re-tokenized)",
    mood: ["спокойный", "женственный", "мягко-премиум", "успокаивающий"],
    industry: ["wellness", "косметология", "ментальное здоровье", "beauty-подписка"],
    audience: "женщины 25–50, тема заботы/спокойствия",
    use_when: "успокаивающий заботливый бренд; мягкая лаванда + тёплый нейтраль",
    avoid_when: "энергия/срочность; жёсткий B2B",
    type_pairing: "TYP-010 (Gambetta + Inter)",
    roles: { bg: "#F6F4F8", surface: "#FFFFFF", ink: "#221E2A", primary: "#6A5A92", "primary-dark": "#4A3E6B", accent: "#C98AA0", cta: "#6A5A92", border: "#E7E2EC" },
    distribution: "65% лавандово-белый · 25% фиолет (структура) · 10% розовый акцент + CTA",
    do: ["фиолет для каркаса/CTA", "тёплый розовый как мягкий акцент", "много воздуха, мягкие радиусы"],
    dont: ["холодный синий", "сатурированный неон", "розовый для мелкого текста"],
    why: "лаванда (hue ~300) + тёплый розовый (hue ~0) = успокаивающая женственная пара; CTA в фиолетовой семье держит спокойствие.",
  },
];

/* ---------- emit ---------- */
const order = ["bg", "surface", "ink", "primary", "primary-dark", "accent", "cta", "border"];
const roleUse = {
  bg: "доминанта фона (~60%)", surface: "карточки/контейнеры", ink: "весь текст",
  primary: "голос бренда", "primary-dark": "цены, hover, заголовки-акцент",
  accent: "eyebrow/бейдж/иконки/крупное", cta: "ТОЛЬКО кнопки действия", border: "разделители",
};
function contrastNote(role, r) {
  if (role === "ink") { const c = ratio(r.ink, r.surface); return `${c.toFixed(1)}:1 ${aa(c)} (vs surface)`; }
  if (role === "primary" || role === "primary-dark" || role === "accent") { const c = ratio(r[role], r.surface); return `${c.toFixed(1)}:1 ${aa(c)} (vs surface)`; }
  if (role === "cta") { const c = ratio("#FFFFFF", r.cta); return `бел.текст ${c.toFixed(1)}:1 ${aa(c)}`; }
  return "—";
}
function entry(p) {
  const rows = order.map((k) => `| ${k.padEnd(12)} | ${p.roles[k]} | \`${oklch(p.roles[k])}\` | ${roleUse[k]} | ${contrastNote(k, p.roles)} |`).join("\n");
  return `### ${p.id} · ${p.name}
- **source:** ${p.source}
- **mood:** ${p.mood.join(", ")}
- **industry:** ${p.industry.join(", ")}
- **audience:** ${p.audience}
- **use-when:** ${p.use_when}
- **avoid-when:** ${p.avoid_when}
- **type-pairing:** ${p.type_pairing}

| role | hex | oklch (computed) | использование | контраст (computed) |
|------|-----|------------------|---------------|---------------------|
${rows}

- **distribution (60-30-10):** ${p.distribution}
- **do:** ${p.do.map((x) => `${x}`).join(" · ")}
- **don't:** ${p.dont.map((x) => `${x}`).join(" · ")}
- **why-it-works:** ${p.why}
`;
}

const header = `<!-- GENERATED by tools/build-palette-schemes.mjs — DO NOT edit by hand. Edit the PALETTES array + re-run. -->
# palette-schemes.md — выверенные interface-палитры (библиотечный слой)

> Это **меню**, а не код. Каждая запись — целостная схема с РОЛЯМИ (а не 4 равных свотча),
> посчитанным OKLCH и контрастом WCAG, тегами и правилами. Агент **выбирает одну** под бизнес
> (см. \`transform-procedure.md\` шаг «select») и инстанцирует её в проектный \`docs/plans/<slug>/DESIGN.md\`
> как \`:root\` токены + строку \`palette: <ID>\`.
>
> Контраст: **AA** ≥4.5:1 (любой текст) · **AA-lg** ≥3:1 (крупный ≥18px/≥14px-bold, иконки) ·
> **✗ decor-only** <3:1 (только заливки/декор, НИКОГДА текст).
>
> Анти-суп правило (урок v3): максимум **один тёплый + один холодный + функциональный CTA**.
> Никогда не больше 2 хроматических акцентов равной площади.

Роли (контракт, одинаковый у всех схем): \`bg surface ink primary primary-dark accent cta border\`.

---

`;

const out = header + PALETTES.map(entry).join("\n---\n\n");
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "references", "palette-schemes.md");
writeFileSync(target, out);
console.error(`wrote ${PALETTES.length} palettes -> ${target}`);
process.stdout.write(out.slice(0, 0)); // no stdout noise
