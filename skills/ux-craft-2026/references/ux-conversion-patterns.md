# UX Heuristics & Conversion Patterns for Landing, SaaS, and E-commerce
*Authoritative Reference for Autonomous Design Orchestrators — May 2026*

This reference document establishes the UX heuristics, conversion optimization patterns, and accessibility guidelines for the autonomous design orchestrator. For page layout and structural blueprinting schema, cross-reference [ia_page_blueprint_kb.md](ia_page_blueprint_kb.md).

---

## 1. 10 Nielsen Heuristics Applied to Modern Conversion (Эвристики Нильсена в конверсиях)
*Adapting classical usability heuristics for transactional and commercial flows.*
Based on the canonical [10 Usability Heuristics for User Interface Design by Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/).

1. **Visibility of System Status**: Users must always know their progress.
   - *Application*: When checking out or configuring a SaaS account, display a visible progress tracker showing completed, active, and upcoming steps. For loading elements, implement skeleton states that mimic the final layout skeleton to keep perceived load times low.
2. **Match Between System and the Real World**: Use terms, concepts, and phrasing familiar to the target audience.
   - *Application*: In SaaS, avoid low-level developer logs on customer-facing onboarding wizards. In e-commerce, use clear concepts like "Shopping Cart" or "Shopping Bag" rather than arbitrary labels like "Bucket" or "Stash".
3. **User Control and Freedom**: Allow users to recover from accidental inputs or navigations.
   - *Application*: Provide immediate "Undo" actions for item removals from carts. When designing multi-step onboarding guides, always include a prominent "Skip" or "Back" option.
4. **Consistency and Standards**: Stick to established industry conventions to prevent cognitive overload.
   - *Application*: Keep the shopping cart icon in the top right viewport quadrant. Place search bars centrally or top-right. Keep standard secondary actions styled as outlines.
5. **Error Prevention**: Design inputs to minimize potential errors before they occur.
   - *Application*: Disable dates in the past for scheduling engines. Force correct phone formatting in inputs using visual masks. Restrict keypress inputs to numbers only in credit card fields.
6. **Recognition Rather than Recall**: Minimize the user's memory load by making objects, actions, and options visible.
   - *Application*: Retain search query terms in search fields on the results page. Show mini-thumbnails of products in the summary checkout sidebar.
7. **Flexibility and Efficiency of Use**: Accelerate interactions for experienced users without alienating novices.
   - *Application*: Enable keyboard shortcuts (e.g., `Cmd + K` for search, `Enter` to submit forms) and provide auto-fill functions for billing/shipping addresses.
8. **Aesthetic and Minimalist Design**: Dialogues should not contain information that is irrelevant or rarely needed.
   - *Application*: Avoid visual noise (e.g., competing display banners, multiple active pop-ups). Keep the attention ratio to 1:1 on checkout views (one page, one primary goal).
9. **Help Users Recognize, Diagnose, and Recover from Errors**: Error messages must be expressed in plain language, precisely indicate the problem, and suggest a constructive solution.
   - *Application*: Instead of "Invalid Input," state "Please enter a valid email address containing an '@' sign." Highlight the specific input field in red with a high-contrast label.
10. **Help and Documentation**: Offer contextual, searchable assistance when users experience friction.
    - *Application*: Place tooltips (`?` icon trigger) next to complex parameters in SaaS configurations or shipping policies in checkout steps.

---

## 2. Conversion-Centered Design (CCD) Rules (Конверсионный дизайн)
High-conversion layouts structure the user's visual path to minimize friction and direct attention to target actions:
*   **Attention Ratio**: The ratio of interactive elements to conversion goals. On landing page hero sections, this ratio should ideally be **1:1** or **2:1** (e.g., a primary conversion button and a neutral video play trigger).
*   **Directional Cues**: Utilize explicit visual cues (e.g., arrows, cursor indicators, or human eyes in hero graphics looking towards the sign-up form) to direct the user's eyes to the primary CTA.
*   **Clarity over Cleverness**: Headlines must state exactly what the product does in under 5 seconds.
*   **Visual Hierarchy Cues**: Use high contrast offsets, sizing, and whitespace to isolate conversion areas. The primary CTA button must be the most visually prominent element on the page.

---

## 3. Hero Copy & Value Proposition Formulas (Формулы ценностных предложений)
A conversion-optimized hero block requires a balanced copywriting and layout formula:

### Copywriting Structural Formula
```
[Headline]: Action-Oriented Verb + Immediate Target Outcome + Unique Mechanism
[Subheadline]: Concrete Supporting Detail (Proof, integration, speed, or risk mitigation)
[CTA]: Action Verb + Contextual Value Driver + Reassurance
```
*   *Example (SaaS)*: 
    - **Headline**: Automate your billing compliance with 100% accuracy.
    - **Subheadline**: Connect your database in under 10 minutes. Zero code needed.
    - **CTA**: Start free trial — No credit card required.

### Visual Layout Formula
*   **Left-Aligned Column Layout**: Left alignment matches the natural Western reading pattern (F-shape). Put text content left-aligned, CTAs clustered directly below it, and the visual asset (application dashboard or product shot) right-aligned.
*   **Text Hierarchy Metrics**:
    - Title Line-height: **1.1 – 1.2** times font-size.
    - Body Line-height: **1.5 – 1.6** times font-size.
    - Whitespace margin below Headline: **1.5rem (24px)**.
    - Whitespace margin below Subheadline: **2rem (32px)**.

---

## 4. Social Proof Placement & Styling (Социальное доказательство)
Social proof builds credibility and resolves skepticism. Implement proof at key decision points:
1. **Above-the-Fold Logo Bar**: Placed directly below the main hero CTA block. Style logos in monochromatic dark/light grey (contrast ratio ≥ 3:1 relative to background) to prevent visual distraction from primary UI.
2. **Inline Review Metrics**: Place G2, Trustpilot, or Capterra badges (e.g., "Rated 4.8/5 on G2 by 1,200+ users") directly above the main hero heading in small typography (font-size: `0.875rem` / `14px`).
3. **High-Fidelity Testimonial Cards**: Style testimonials in a grid or stack layout. Each card must contain:
   - Verified customer portrait (minimum size: `48px` circular, styled with alt-text).
   - Full name, job title, and company name.
   - A bolded key phrase summarizing their success.
   - A "Verified Customer" badge to increase trust.

---

## 5. Pricing-Table Patterns (Шаблоны таблиц цен)
Pricing tables must eliminate ambiguity and simplify plan comparisons.
Refer to NN/g's guidelines on B2B pricing in [Show Prices for Common Scenarios](https://www.nngroup.com/articles/show-prices-common-scenarios/).

*   **Period Toggle**: Feature a prominent horizontal toggle (e.g., "Monthly / Annually"). Highlight the annual discount with a bright label (e.g., "Save 20%").
*   **Most Popular Plan Highlight**: Increase the scale of the target conversion plan by **5% – 10%** relative to other cards. Apply a contrasting border (e.g., brand color border) or a badge ("Recommended" / "Most Popular").
*   **Explicit Difference Comparison**: In the plan details, highlight differentiators using bold text or comparative tables. Avoid generic checkmark lists that look identical. See NN/g's [Explicitly State the Difference Between Options](https://www.nngroup.com/articles/explicit-differences/).
*   **Friction-Reduction Placement**: Always place a simplified FAQ section directly below the pricing grid. Address standard friction points (e.g., cancellation policies, refunds, custom migrations, and security compliance).

---

## 6. Form UX (Проектирование форм)
Forms represent the highest barrier to conversion. Enforce these UX patterns to optimize input rates:

### 6.1. Multi-Step Forms
*   **Progress Indicators**: Always display a visual step indicator (e.g., "Step 2 of 4"). Use a horizontal progress bar styled with color transitions indicating completion.
*   **Local State Recovery**: Save user inputs automatically to `localStorage` or `sessionStorage` on input change. If the browser refreshes or the connection drops, restore the form fields to prevent re-entry.
*   **Logical Steps grouping**: Group inputs into natural categories (e.g., "Personal Details" -> "Account Setup" -> "Billing Options"). Limit each step to a maximum of **3 to 4 inputs**.

### 6.2. Inline Validation Rules
Based on Baymard's validation studies: [Usability Testing of Inline Form Validation](https://baymard.com/blog/inline-form-validation).
*   **Debounced Keyup Validation**: Never validate inputs on every keypress while the user is typing. Apply validation **800ms after the last keypress** (debounce) or upon input `blur`.
*   **Visual Feedback Indicators**: Provide clear success states (green checkmark, `#10b981` border color) and error states (red warning icon, `#ef4444` border color).
*   **Requirements Clarity**: If a password requires specific parameters (e.g., "min 8 characters, 1 number"), list these rules below the input. Turn each rule green dynamically as the user meets the criterion.

### 6.3. Error Recovery
*   **Focused Scroll**: Upon form submission failure, automatically scroll the viewport to the first invalid field and apply focus (`input.focus()`).
*   **Accessible Descriptions**: Bind error messages to input fields using the `aria-describedby` attribute to ensure screen readers announce the issue immediately:
    ```html
    <label for="email">Email Address</label>
    <input type="email" id="email" aria-invalid="true" aria-describedby="email-error">
    <span id="email-error" role="alert" style="color: #ef4444;">Please include a valid '@' symbol.</span>
    ```

---

## 7. Call-to-Action (CTA) Design (Проектирование CTA-элементов)
*   **Clickable Target Sizing**: Maintain minimum touch target sizes. WCAG 2.2 Level AA requires at least **24x24px** (see Section 10). However, Apple's HIG recommends **44x44px** and Google Material Design recommends **48x48px**. Enforce a minimum target height of **48px** for mobile conversion components.
*   **Aria-Labeling**: Formulate clear labels. If the button displays an icon without text, apply an explicit `aria-label`:
    ```html
    <button class="icon-button" aria-label="Close cart checkout modal">
      <svg aria-hidden="true">...</svg>
    </button>
    ```
*   **Contrast Ratios**: Keep contrast high. The text contrast on any button must be ≥ **4.5:1** against the button background color.
*   **Microcopy**: Add small friction-reducing details directly below or inside the CTA button (e.g., "Start free trial — No credit card required" or "Secure 256-bit checkout").

---

## 8. Trust Signals (Сигналы доверия)
Reassure users at checkout points and sign-up steps with verified signals:
*   **Compliance Badges**: Place certifications (e.g., SOC2 Type II, HIPAA Compliant, PCI-DSS Compliant, GDPR Compliant) directly next to payment inputs or signup fields.
*   **Visual Integrity**: Avoid low-quality, pixelated security badges. Use clean SVG vector assets of actual compliance entities.
*   **SSL Fallback**: Do not display "Secure SSL 128-bit" badges. In 2026, HTTPS is standard; showing generic lock icons can sometimes draw unnecessary attention to security risks rather than easing them.

---

## 9. Empty, Loading, and Error States (Состояния пустого UI, загрузки и ошибок)
Every interactive system must handle non-ideal states gracefully to prevent user drop-off:

| State | Usability Requirement | Visual Strategy | Conversion Action |
| :--- | :--- | :--- | :--- |
| **Empty State** | Prevent dead-ends; direct the user on what to do next. | Display a friendly illustrative placeholder and clear instructions. | Provide a single prominent primary CTA button (e.g., "Create your first campaign"). |
| **Loading State** | Reduce perceived wait times and prevent layout shifts. | Render structural skeleton loaders representing the component's final structure. | Avoid full-screen blockers unless processing payments or database queries. |
| **Error State** | Explain the error in plain text and provide immediate recovery options. | Show a clear error code (e.g., "500 Connection Timeout") and visual warning cues. | Include a prominent "Retry" or "Go back to safety" action trigger. |

---

## 10. Friction Audit Checklist (Чек-лист аудита трения)
Use this checklist to identify and resolve conversion blockers on key pages:
*   [ ] **Form Field Reduction**: Are there more than 8 fields in the sign-up or checkout process? (Target: reduce fields to **6–8 inputs**, down from the historical average of 14.88 and 11.3 fields, as researched by [Baymard Institute checkout benchmarks](https://baymard.com/ecommerce-usability/checkout)).
*   [ ] **Guest Checkout Access**: Can users purchase products without forced registration? Ensure a prominent "Checkout as Guest" button is visible at the account step (see [Baymard Guest Checkout Pitfalls](https://baymard.com/blog/guest-checkout-pitfalls)).
*   [ ] **Password Constraints**: Are you enforcing complex rules (e.g., special characters, symbols) that block users from completing checkout? Simplify password setup, or use secure magic links/Google Auth alternatives.
*   [ ] **Auto-completion**: Are you using autocomplete attributes (e.g., `autocomplete="shipping address-line1"`) on billing and shipping forms to accelerate input entry?
*   [ ] **No-Distraction Checkout**: Have you stripped header links, navigation menus, and footers from the checkout screen to keep the focus entirely on the purchase?

---

## 11. Mobile-First Conversion & Touch Targets (Мобильная конверсия)
Mobile visitors experience higher bounce rates due to poor touch layout engineering.
*   **Interactive Target Sizing**: Every interactive component (buttons, checkboxes, links) must meet WCAG 2.2 Success Criterion 2.5.8 (Target Size - Minimum). Interactive targets must be at least **24x24 CSS pixels** or have a spacing of at least **24 CSS pixels** separating them from adjacent elements.
*   **Bottom Thumb Zone Placement**: Primary CTA actions must remain in the bottom third of the screen (the "thumb-zone") for easy one-handed reach. On scroll, pin the primary action container as a sticky bottom bar.
*   **Visual Padding**: Apply padding around interactive elements. A minimum tap space of **8px** of non-interactive margins surrounding target buttons avoids mis-taps.

---

## 12. Onboarding Flows (Процесс онбординга)
Optimize onboarding to guide users toward their first product value point (the "Aha!" moment).
Based on [NN/g Mobile-App Onboarding guidelines](https://www.nngroup.com/articles/mobile-app-onboarding/).

*   **Progressive Disclosure**: Show info only as needed. Introduce advanced product configurations progressively as the user works through the interface rather than overwhelming them on first login.
*   **Skip Option availability**: Always allow users to bypass onboarding tutorials and explore the dashboard immediately. 
*   **Contextual Help over General Tutorials**: Use contextual tooltips that appear when the user reaches specific features for the first time, rather than a generic multi-slide slideshow on startup (see [Onboarding Tutorials vs. Contextual Help](https://www.nngroup.com/articles/onboarding-tutorials-contextual-help/)).

---

## 13. Deterministic UX QA Checklist (Чек-лист контроля качества UX)
Run these automated and semi-automated tests on every layout iteration to verify compliance:

```
[1] Axe-core Audits (accessibility violations = 0)
[2] Color Contrast Checks (text contrast ≥ 4.5:1, non-text contrast ≥ 3:1)
[3] Target Size Verification (interactive elements ≥ 24px width/height)
[4] Focus & Tab Order Tests (prevent focus trap, verify natural tab sequence)
```

1. **Axe-core Accessibility Assertions**:
   - Run automated validation scripts using `axe-core@4.11.4` on all components. Ensure zero accessibility violations.
2. **Contrast Ratio Audits**:
   - Verify body text contrast is at least **4.5:1** against backgrounds, and large display text (≥ 18pt or bold 14pt) is at least **3.0:1** under WCAG 2.2 Level AA.
3. **Interactive Target Size Checks**:
   - Run validation scripts checking target bounding rects. Verify that all clickable elements have dimensions ≥ **24px** on both axes.
4. **Focus Management & Tab Order Logic**:
   - Ensure the focus order follows the visual structure (left-to-right, top-to-bottom).
   - Verify modal windows trap focus when active (`focus-trap` library implemented) and return focus to the trigger button upon closing.
   - Elements must never lose outline states during keyboard tab focus. Use customized `:focus-visible` styles rather than disabling outlines with CSS rules like `outline: none`.

---

## 14. Conversion-Killing Antipatterns (Антипаттерны в конверсиях)
*Avoid these implementation mistakes during interface construction:*

*   **Antipattern 1: Autoplaying Heavy Carousel Sliders** — Carousels distract users, cause banner blindness, and dilute conversion priorities. Replace them with single, targeted hero sections.
*   **Antipattern 2: Keypress Inline Validation** — Showing error warnings on the very first keypress of an email input (e.g. before the user has finished typing) creates immediate frustration. Enforce validation on `blur` or debounced input changes.
*   **Antipattern 3: Hidden Pricing details** — Forcing users to register an account or "Contact Sales" to discover basic entry pricing tiers increases bounce rates and reduces trust.
*   **Antipattern 4: Unresponsive Layout Shifts (CLS)** — Images or dynamic assets loading without defined `width` and `height` properties cause pages to jump, leading to accidental mis-taps and checkout drop-off.
*   **Antipattern 5: Forced Sign-up during Checkout** — Forcing users to create a account and verify their email prior to purchase blocks conversion. Implement guest checkout and offer registration *after* checkout completion.
