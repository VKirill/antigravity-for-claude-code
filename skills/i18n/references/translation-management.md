# Translation management platforms

When the team grows past 2 locales and 1 developer, you need a translation management system (TMS). Translators don't edit JSON; product managers don't write ICU; you need versioning, machine translation suggestions, and in-context editing.

## Popularity-filtered 2026 options

Four mainstream choices. Anything not listed (Transifex, POEditor, Smartling, Localize.com) is niche or enterprise-only — out of scope for this skill.

| Platform | Free tier | Strength | Pricing model |
|---|---|---|---|
| **Crowdin** | Free for open source / small teams | Mature, huge integration catalog, in-context editor | Per-translator + per-string |
| **Lokalise** | 14-day trial | Best developer experience, CLI + API, strong git integration | Per-seat |
| **Phrase** | 14-day trial | Enterprise-ready, branching workflow | Per-seat |
| **Tolgee** | Open source, self-hosted free | Modern, screenshots-based in-context editing, AI translations | Per-string / self-host free |

Decision heuristic:
- **Open source / small team / self-hosted** → Tolgee
- **Crowd-sourced community translations** → Crowdin
- **Tight git/CI integration, dev-first** → Lokalise
- **Enterprise, branching, approval workflow** → Phrase

## Common workflow

Regardless of platform, the loop is:

1. Developer adds an English string to `messages/en.json` and pushes
2. CI pushes new keys to TMS via CLI/API
3. Translators receive notifications, translate in TMS UI
4. CI pulls translated locales back into `messages/<locale>.json`
5. Build deploys with all locales

Three sync modes:

| Mode | When |
|---|---|
| **TMS-as-source-of-truth** | TMS owns master; repo is generated. Best for translation-heavy projects |
| **Git-as-source-of-truth** | Repo owns master; TMS is a UI for translators. Best for dev-heavy projects |
| **Bidirectional sync** | Either side can update; conflict resolution rules. Hardest to maintain |

We default to **git-as-source-of-truth** — translators work in TMS, but the canonical file is in the repo. The repo can rebuild without TMS access.

## Crowdin integration

```yaml
# crowdin.yml
project_id_env: CROWDIN_PROJECT_ID
api_token_env: CROWDIN_API_TOKEN
base_path: '.'
base_url: 'https://crowdin.com'

files:
  - source: '/messages/en.json'
    translation: '/messages/%two_letters_code%.json'
    languages_mapping:
      two_letters_code:
        ru-RU: ru
        de-DE: de
```

CLI commands in CI:

```bash
# Push English source
npx crowdin upload sources

# Pull all translations
npx crowdin download
```

## Lokalise integration

```bash
# Push
lokalise2 file upload \
  --project-id=$LOKALISE_PROJECT_ID \
  --token=$LOKALISE_TOKEN \
  --file=messages/en.json \
  --lang-iso=en

# Pull
lokalise2 file download \
  --project-id=$LOKALISE_PROJECT_ID \
  --token=$LOKALISE_TOKEN \
  --format=json \
  --original-filenames=true \
  --directory-prefix=messages
```

Lokalise also has a GitHub Action for push-on-merge.

## Tolgee integration

Tolgee is open source and supports self-hosting:

```bash
docker run -p 8085:8085 tolgee/tolgee:latest
```

Push/pull via CLI:

```bash
npx @tolgee/cli push --api-key $TOLGEE_API_KEY
npx @tolgee/cli pull --api-key $TOLGEE_API_KEY --path ./messages
```

Tolgee's killer feature: in-context editing — Alt+click any string in your dev app to open the editor. Wire up:

```tsx
// next-intl + Tolgee dev plugin
import {Tolgee, DevTools, FormatIcu} from '@tolgee/web';

const tolgee = Tolgee()
  .use(DevTools())
  .use(FormatIcu())
  .init({apiKey: process.env.NEXT_PUBLIC_TOLGEE_API_KEY});
```

## Phrase integration

```bash
# Push
phrase push --project-id=$PHRASE_PROJECT_ID

# Pull
phrase pull --project-id=$PHRASE_PROJECT_ID
```

Phrase supports branching — each feature branch can have its own translation set; merges happen on branch merge.

## CI/CD patterns

### Pre-build pull (every build pulls latest)

```yaml
# .github/workflows/build.yml
- name: Pull translations
  run: npx crowdin download
  env:
    CROWDIN_API_TOKEN: ${{ secrets.CROWDIN_API_TOKEN }}

- name: Build
  run: pnpm build
```

Risk: production build fails if TMS is down. Mitigate by caching last-known-good translations.

### Post-merge push (only `main` pushes new keys to TMS)

```yaml
on:
  push:
    branches: [main]

jobs:
  push-keys:
    if: contains(github.event.head_commit.modified, 'messages/en.json')
    steps:
      - name: Push to Crowdin
        run: npx crowdin upload sources
```

Translators only see merged keys, not feature branches.

### Scheduled pull (nightly translations PR)

```yaml
on:
  schedule:
    - cron: '0 6 * * *'

jobs:
  pull-translations:
    steps:
      - run: npx crowdin download
      - uses: peter-evans/create-pull-request@v6
        with:
          title: 'i18n: sync translations'
          branch: 'chore/sync-translations'
```

Reviewer merges if changes look reasonable.

## Machine translation as draft

All four platforms offer MT (Google, DeepL, OpenAI) as suggestions. **Never auto-publish MT** — always human review. Configure:

- Crowdin: TM-first, MT as fallback for empty keys
- Tolgee: built-in DeepL/OpenAI prompt-based translation
- Lokalise: Google / DeepL / Amazon Translate

For Russian/CIS markets, DeepL > Google for fluency. For Asian markets, Google's CLM is competitive.

## Avoiding key sprawl

When translators see hundreds of keys with no context, they make mistakes. Rules:

1. Group keys by feature (`Checkout.shipping.title`, not `checkoutShippingTitle`)
2. Provide a **description** field in TMS for ambiguous keys (e.g., `submit` — "submit button on login form" vs "submit a support ticket")
3. Attach screenshots when possible (Tolgee and Crowdin both support this)
4. Keep ICU placeholders consistent — never rename `{name}` to `{userName}` between locales

## Things that go wrong

- Translators introduce HTML they shouldn't (`<b>`) — validate with linter
- Russian translator removes the `=0` plural branch — validate ICU integrity in CI
- Branch with new keys merged before translations land → fallback to English (acceptable IF fallback is configured)
- TMS API rate limit hits in CI → cache the last successful pull
- Secret exposure: never commit `CROWDIN_API_TOKEN` to repo

See [troubleshooting.md](troubleshooting.md) for ICU validation tooling.

## Related

- [translation-files.md](translation-files.md) — file structure that TMS sync expects
- [troubleshooting.md](troubleshooting.md) — ICU validation, missing-key handling
