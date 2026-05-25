# Eval Cases

Routing prompts to validate the `expo` skill loads when expected — and stays out when it shouldn't.

## Positive cases (skill SHOULD load)

| # | Prompt | Why it matches |
|---|---|---|
| P1 | "Set up Expo Router with a (tabs) group and a protected (app) layout that redirects to sign-in." | Triggers: expo router, layout, redirect |
| P2 | "Configure eas.json with development / preview / production profiles." | Triggers: eas build, eas.json |
| P3 | "Push an OTA update with EAS Update to the production channel and roll it back." | Triggers: eas update, ota updates, channel, rollback |
| P4 | "Submit our iOS build to TestFlight using an ASC API key." | Triggers: eas submit, ios app, asc api |
| P5 | "Wire push notifications: get an Expo push token and handle responses on Android." | Triggers: expo-notifications, push notifications |
| P6 | "Add a custom config plugin that writes a meta-data tag into AndroidManifest.xml." | Triggers: config plugin, prebuild, AndroidManifest |
| P7 | "Build a native module in Swift that exposes a hello function to JS." | Triggers: expo modules api, native module, swift |
| P8 | "Implement Google OAuth with expo-auth-session and PKCE." | Triggers: expo-auth-session, PKCE, OAuth |
| P9 | "Migrating an Expo app to RN 0.85 — what changes with the New Architecture?" | Triggers: react native, new architecture, fabric, bridgeless |
| P10 | "My Reanimated plugin isn't running and the app crashes on launch — Expo SDK 55." | Triggers: expo, reanimated, troubleshooting |
| P11 | "Set up universal links from example.com to the iOS app and intent filters for Android." | Triggers: expo, deep links, universal links, app links |
| P12 | "Switch our app from Expo Go to a development build with expo-dev-client." | Triggers: expo go, dev client |

## Negative cases (skill should NOT load — there are better matches)

| # | Prompt | Better skill |
|---|---|---|
| N1 | "Write a Next.js App Router server component that streams." | `nextjs` |
| N2 | "Set up a React 19 useOptimistic list with form actions." | `react` |
| N3 | "Configure tsconfig for a strict TypeScript monorepo." | `typescript` |
| N4 | "Implement OAuth with Better Auth on the Hono server." | `better-auth` + `hono` |
| N5 | "Build a Flutter widget for a settings screen." | out of scope; suggest searching for a Flutter skill |
| N6 | "Render an MP4 from React components with Remotion." | `remotion` |
| N7 | "Why is my Playwright getByRole timing out on a web app?" | `playwright` |
| N8 | "Tune PM2 cluster mode for our Node.js API server." | `linux-sysadmin` / `nodejs` |

## Borderline (judgement call)

| # | Prompt | Decision |
|---|---|---|
| B1 | "Render a React form on a mobile screen with React Hook Form + Zod." | Load `react-hook-form` + `zod`; `expo` is incidental unless permissions/native are involved |
| B2 | "Validate JSON from a mobile API call." | `zod` is primary; `expo` skill not needed |
| B3 | "Build a server-side push sender that talks to FCM." | `nodejs`; this skill covers the client side only |
| B4 | "Implement an OAuth flow that signs into our Hono backend from the Expo app." | Load both `expo` (auth-session, deep links) and `hono` (server callback) |

## How to use these

When auditing the skill, run prompts P1–P12 through Claude Code in a clean session and verify the skill loads. Run N1–N8 and verify it does NOT load. Borderline cases document expected co-loading behaviour.
