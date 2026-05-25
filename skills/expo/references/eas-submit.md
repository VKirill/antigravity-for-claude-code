# EAS Submit — App Store and Google Play

`eas submit` uploads a finished EAS build to App Store Connect or Google Play. Auth is per-platform.

## Submit profiles in eas.json

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "you@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "AB12XYZ34S"
      },
      "android": {
        "track": "internal",
        "serviceAccountKeyPath": "./play-service-account.json"
      }
    },
    "preview": {
      "android": { "track": "internal" },
      "ios":     { "appleId": "you@example.com", "ascAppId": "1234567890" }
    }
  }
}
```

Inherit:

```json
{ "production-eu": { "extends": "production", "android": { "releaseStatus": "draft" } } }
```

## iOS credentials

Two paths:

1. **App-Specific Password + Apple ID** — interactive; works locally.
2. **App Store Connect API Key** — preferred for CI. Generate at App Store Connect → Users and Access → Integrations → App Store Connect API.

   ```bash
   eas credentials -p ios
   ```

   Choose "App Store Connect: Manage your API Key" → upload the `.p8`, paste the key ID, paste the issuer ID. EAS stores them server-side.

Required fields in the submit profile:

| Field | Source |
|---|---|
| `appleId` | the team-member email |
| `ascAppId` | App Store Connect → My Apps → App Information → "Apple ID" |
| `appleTeamId` | Apple Developer → Membership |

## Android credentials

Service-account JSON from Google Play Console → Setup → API access → Create new service account in Google Cloud → grant "Release Manager" or appropriate role → download JSON.

Either:

- `serviceAccountKeyPath` pointing to a local file (gitignored), or
- upload via `eas credentials -p android` so EAS stores it

## Tracks

Android Play Console tracks:

| Track | Use |
|---|---|
| `internal` | Up to 100 internal testers; fastest review |
| `alpha` | Closed testing |
| `beta` | Open testing |
| `production` | Public release |

```json
{ "submit": { "production": { "android": { "track": "production", "releaseStatus": "completed" } } } }
```

`releaseStatus`: `draft`, `inProgress`, `halted`, `completed`. Use `draft` to stage a rollout in the Play Console UI without auto-publishing.

iOS doesn't have explicit tracks; submissions land in App Store Connect and you decide between TestFlight (internal/external testing) and store release manually.

## Submitting

```bash
# Submit the latest finished build for the profile
eas submit --profile production --platform ios
eas submit --profile production --platform android
eas submit --profile production --platform all

# Submit a specific build
eas submit --platform ios --id <build-id>

# Submit a local .ipa / .aab
eas submit --platform ios  --path ./MyApp.ipa
eas submit --platform android --path ./MyApp.aab
```

After upload:

- iOS: Apple processes for 15–60 min, then the build appears in TestFlight. App Store review requires extra steps in App Store Connect.
- Android: appears in the selected track immediately; rollout is controlled via `releaseStatus` and the Play Console UI.

## CI/CD

GitHub Actions example:

```yaml
- run: eas submit --platform ios --profile production --non-interactive
  env:
    EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

`EXPO_TOKEN` is a personal access token from expo.dev → Settings → Access Tokens. For unattended submits, all credentials must be uploaded server-side; the local profile only needs identifiers.

## EAS Workflows (built-in CI)

```yaml
# .eas/workflows/release.yml
on:
  push: { branches: ['main'] }

jobs:
  build_ios:
    type: build
    params: { platform: ios, profile: production }
  submit_ios:
    needs: [build_ios]
    type: submit
    params:
      profile: production
      build_id: ${{ needs.build_ios.outputs.build_id }}
```

## TestFlight + Play internal beta

Standard pre-prod workflow:

1. `eas build --profile production --platform all`
2. `eas submit --profile production --platform all` (Android = `internal` track, iOS lands in App Store Connect → TestFlight)
3. Add testers in TestFlight and Play Console
4. After validation, promote: Play Console (internal → production), App Store Connect (submit for review)

## Anti-patterns

- Hard-coding service-account JSON in the repo — use `serviceAccountKeyPath` pointing outside the tree, or upload to EAS
- Forgetting to bump `buildNumber`/`versionCode` — both stores reject duplicates. Use `autoIncrement: true` in `eas.json`.
- Submitting to `production` track first — always validate on `internal`/TestFlight
- Mixing TestFlight builds (debug-stripped, dev-client = false) with dev builds — keep separate `eas.json` profiles
- Storing the Apple App-Specific Password in env vars on CI — use the ASC API key instead
