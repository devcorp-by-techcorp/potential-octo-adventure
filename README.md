# Studio Suite — mobile

Illuminate Studios' Studio Suite as an Expo (React Native) app: the public marketing
site, the client portal, the studio admin portal, and Illuminate Kids (public site,
parent registration, organisation dashboard and the studio's Kids workspace).

```
apps/mobile/       the Expo Router app — see apps/mobile/README.md
packages/tokens/   @illuminate/tokens — shared design tokens
```

## Run

```bash
npm install --ignore-scripts
npm run mobile                              # Expo dev server
npm run typecheck --workspace @illuminate/mobile
npm run e2e --workspace @illuminate/mobile  # needs Playwright + Chromium
```

All data is seeded and held in memory; there is no backend yet.
