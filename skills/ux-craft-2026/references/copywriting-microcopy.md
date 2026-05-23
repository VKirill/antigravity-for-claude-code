# Copywriting & Microcopy for Premium and Award Sites
*Authoritative Reference for Autonomous Design Orchestrators — May 2026*

This reference document establishes copywriting methodologies, value-proposition frameworks, microcopy guidelines, and localization rules for the autonomous design orchestrator. For layouts, sitemaps, conversion layouts, and accessibility standards, cross-reference [ia_page_blueprint_kb.md](ia_page_blueprint_kb.md), [ux-conversion-patterns.md](ux-conversion-patterns.md), and [accessibility-wcag22.md](accessibility-wcag22.md).

---

## 1. Hero Headline Formulas & Examples (Формулы заголовков первого экрана)
Premium sites avoid generic slogans like "Welcome to the future." They utilize structural, outcome-driven formulas that establish immediate clarity.

### Formula A: Direct Capability + Competitive Differentiator
*   **Structure**: `[Verb] + [Core Outcome] + without + [Industry Pain Point]`
*   **Example (SaaS)**: Sync your production databases in real time without provisioning server infrastructure.
*   **Example (E-commerce)**: Rent designer apparel for formal events without subscription commitments.

### Formula B: Category Definition + Core Value Metric
*   **Structure**: `The [Product Category] built to + [Perform Job] + [Exact Metric/Speed/Efficiency]`
*   **Example (DevTools)**: The headless CMS built to compile static builds under 200ms.
*   **Example (FinTech)**: The treasury operations platform designed to reclaim 14 hours of accounting reconciliation weekly.

---

## 2. Value-Proposition Frameworks (Рамки ценностных предложений)
High-end conversion layouts employ established copy frameworks to structure their message hierarchy:

### 2.1. JTBD (Jobs-To-Be-Done) Framework
Focuses on the "progress" a user wants to achieve.
*   **Formula**: `When [Situation], I want to [Action/Job], so that I can [Target Progress/Value].`
*   **Example**: "When transaction volumes double overnight, I want my accounting ledger to auto-reconcile, so that we avoid manual reporting errors at month-end."

### 2.2. PAS (Problem-Agitation-Solution) Framework
Addresses pain points before introducing the product utility.
*   **Problem**: Misaligned engineering specs lead to redundant code.
*   **Agitation**: Code rewrites delay product launches by weeks and burn engineering budgets.
*   **Solution**: Connect spec schemas to code output automatically. Design components and production code stay 100% in sync.

### 2.3. 4U Checklist Framework
Developed by marketing expert Michael Masterson, this checklist evaluates copy across four parameters:
*   **Useful**: Does it solve a real user challenge?
*   **Urgent**: Does it explain why the user needs to act now? (e.g. addressing current inefficiencies).
*   **Unique**: Does it position the product as a distinct solution?
*   **Ultra-specific**: Does it use precise details and numbers?
*   *Example Application*: "Reclaim 12 engineering hours this week (Useful + Ultra-specific) by deploying self-healing API integrations (Unique + Urgent)."

---

## 3. Section Copy Patterns (Структура текста в секциях)
Structure sub-hero sections to sustain reading momentum:

### 3.1. Feature Cards
*   **Header**: Concise benefit title (3-5 words).
*   **Body**: One paragraph (maximum 25 words) explaining the mechanism. Avoid adjectives; focus on verbs.
*   **Link**: Small contextual anchor link (e.g., "Explore schema validation →").

### 3.2. Case Studies & Success Metrics
*   **Metric Label**: A large, bold metric (e.g., "40% reduction in churn" or "1.2s faster page loads").
*   **Supporting Quote**: A short customer quote (maximum 15 words) focusing on the result.
*   **Client Context**: Company name, logo, and link to the case study.

---

## 4. Microcopy Guidelines (Микрокопирайтинг)
Microcopy refers to the small labels, error messages, and tooltips that guide users.

*   **Buttons (CTAs)**: State the exact action. Use active verbs.
    - *Poor*: "Submit" or "Click Here".
    - *Premium*: "Deploy to Vercel" or "Start Free Trial".
*   **Empty States**: Explain what is missing and provide the next step.
    - *Poor*: "No campaigns found."
    - *Premium*: "You haven't launched a campaign yet. Create your first campaign to start tracking conversions." (Includes primary CTA).
*   **Error Messages**: Clearly identify what went wrong and how to fix it.
    - *Poor*: "Invalid card details."
    - *Premium*: "The expiration date entered is in the past. Please check your card details and try again."
*   **Form Labels**: Maintain descriptive, persistent labels. Do not rely on placeholders (violates WCAG 2.2).
    - *Example*: Use "Business Email Address" rather than "Email".
*   **Tooltips**: Provide technical definitions or policy clarifications. Keep under 15 words.
    - *Example*: "Calculated based on your active team seats billed monthly. Cancel anytime."

---

## 5. Tone & Voice Systems: Stripe, Linear, and Vercel Profiles (Голос бренда)
Premium digital platforms employ distinct tone systems. The orchestrator must match these profiles:

| Brand Profile | Core Attributes | Word Choice Rules | Visual Matching |
| :--- | :--- | :--- | :--- |
| **Stripe Style** | Authoritative, technical, enabling, institutional. | Use precise financial terms. Avoid hype. Focus on developer enablement and reliability. | Sleek borders, subtle gradients, clean typography, detailed grids. |
| **Linear Style** | Focused, minimalist, opinionated, professional. | Short sentences. Action verbs. Focus on speed, efficiency, and engineering craft. | Monochromatic dark UI, sharp borders, high negative space, smooth spring animations. |
| **Vercel Style** | Developer-centric, performance-focused, modern. | Focus on metrics, speeds (ms), build times, global delivery, and simplicity. | High contrast bold text, clean vector icons, dynamic code-block previews. |

---

## 6. Narrative, Scrollytelling, & Motion Pacing (Текст и анимация прокрутки)
When copy and motion interact, copy must fit the scroll sequence:
1. **Scroll-Stop Length Budgets**: In scroll-triggered transitions, keep copy blocks to **35 words or fewer per viewport transition**. This prevents text from overflowing as components shift.
2. **Animation Reveals & Pacing**: Reveal headings first, followed by subheadings, and then body text. Apply a slight delay offset (stagger) to the text elements:
   - Heading: `delay: 0ms`
   - Subheading: `delay: 150ms`
   - Body copy: `delay: 300ms`
3. **Scroll-Linked Text Highlighting**: In storytelling sections, light up text spans based on scroll position (e.g., highlighting key terms as they scroll into view, setting background text opacity to `0.3` and active text to `1.0`).

---

## 7. Brevity & Rhythm Rules (Ритм и краткость текста)
*   **The "Short-Short-Long" Rule**: Vary sentence lengths to create natural reading flow. Place a short sentence (3-5 words) next to a medium sentence (6-12 words) and follow it with a longer, explanatory sentence (15-20 words).
*   **Reading Time Math**: The average reader processes **200 – 250 words per minute** (~3.3 – 4.1 words per second).
    - Above-the-fold hero content must be readable in **under 3 seconds** (Maximum length: **12 words** including headline and CTA label).

---

## 8. Localization Guidelines for the Russian Market (Локализация для рынка РФ)
When translating or writing copy for Russian-market digital platforms:
*   **Sentence Expansion Factor**: Russian sentences are typically **15% – 25% longer** than their English equivalents. 
    - *Design Implication*: The UI layout must account for this expansion. Use flexible container sizing (`min-height: max-content`) and avoid fixed-width containers that will cause text to overflow or wrap awkwardly.
*   **The Info-Style (Инфостиль) Standard**: Apply the editing principles of Maxim Ilyahov (clarity, facts, reduction of emotional filler words).
    - *Poor (Literal translation of marketing hype)*: "Уникальный и революционный сервис для взрывного роста ваших продаж!"
    - *Premium Info-Style*: "Система автоматизации продаж. Увеличивает конверсию корзины на 15% за счет оптимизации форм."
*   **Tone of Voice Shift**: Russian audiences are generally skeptical of overly enthusiastic sales copy. Switch to a calm, technical, engineering-focused tone. Highlight facts, metrics, and security guarantees.

---

## 9. Reusable Copy-Deck Template (Шаблон копирайтинга проекта)
Autonomous agents must populate this template for each design project before generating layouts:

```yaml
project_id: "lusion-redesign-2026"
tone_profile: "linear_style" # Choose: stripe_style | linear_style | vercel_style
market_locale: "en-US" # Choose: en-US | ru-RU

hero_section:
  headline:
    text: "Push the boundaries of WebGL storytelling."
    length_words: 6
    target_reveal_delay_ms: 0
  subheadline:
    text: "We design and engineer high-performance immersive WebGL experiences that run at 60 FPS on any device."
    length_words: 16
    target_reveal_delay_ms: 150
  cta_primary:
    label: "Explore Case Studies"
    destination: "/work"
  cta_secondary:
    label: "View Pricing"
    destination: "/pricing"

pricing_section:
  toggle_label_monthly: "Monthly"
  toggle_label_annual: "Annually (Save 20%)"
  plan_cards:
    - plan_id: "starter"
      name: "Starter"
      price: "$49"
      billing_detail: "per seat, billed monthly"
      features_highlight:
        - "Up to 3 active projects"
        - "Standard WebGL template exports"
      cta_label: "Start Starter Plan"
    - plan_id: "pro"
      name: "Professional"
      price: "$149"
      billing_detail: "per seat, billed monthly"
      recommended: true
      features_highlight:
        - "Unlimited active projects"
        - "Custom shader injection engine"
        - "Priority technical support"
      cta_label: "Deploy Pro Sandbox"

microcopy_fallbacks:
  empty_states:
    projects_list: "No case studies published. Click 'Create Project' below to upload your first WebGL experience."
  error_validation:
    email_field: "Please enter a valid business email address containing an '@' symbol."
```

---

## 10. Copywriting Antipatterns (Антипаттерны в копирайтинге)
*Avoid these implementation mistakes in copywriting pipelines:*

*   **Antipattern 1: Feature Dumping** — Listing technical database configurations (e.g. "PostgreSQL 15 integration") on consumer-facing landing pages without explaining the benefit (e.g. "Your data stays synced instantly").
*   **Antipattern 2: Corporate Jargon** — Using vague business buzzwords ("Synergistic paradigms", "Next-gen solutions", "Paradigm shifts") that communicate zero concrete value.
*   **Antipattern 3: Fake Urgency / Dark Patterns** — Using artificial countdown timers or claiming "Only 3 items left in stock!" when there is no physical inventory constraint. This degrades brand trust.
*   **Antipattern 4: Unlabeled Icons** — Displaying navigation icons (e.g., a custom compass or gear) without associated text labels or `aria-label` screen reader tags.
*   **Antipattern 5: Paragraph Blocks** — Presenting product descriptions in dense paragraphs (more than 4 lines of text). Break text blocks into bulleted feature grids or clean, scannable subheadings.
