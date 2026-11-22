- [x] Verify that the copilot-instructions.md file in the .github directory is created.
- [x] Clarify Project Requirements: Arabic RTL Expo / React Native B2B sourcing and manufacturing platform.
- [x] Scaffold the Project: Expo Router TypeScript app, app name `souqi`.
- [x] Customize the Project: auth, role-based permissions, RFQs, quotes, purchase orders, samples, production milestones, supplier directory, and platform admin.
- [x] Install Required Extensions: no extensions are required.
- [x] Compile the Project: install dependencies and run TypeScript / Expo diagnostics.
- [ ] Create and Run Task: not required for this Expo project.
- [ ] Launch the Project: wait for user confirmation before starting a development server.
- [x] Ensure Documentation is Complete: keep README and these instructions current.

## Project notes
- Expo Router screens are under `src/app/`; all screens are B2B platform routes.
- Platform data is persisted by the Express API and Prisma/PostgreSQL; the session token is stored locally.
- Keep UI copy Arabic and layouts right-to-left.
- Do not imply real payment, logistics, or external factory verification integrations.
- Start with `npx expo start`; use Expo Go or an Android emulator to run the app.
- `docs/b2b-manufacturing-platform.md` records the original architecture proposal; the implemented app is the source of truth for current behavior.
- `docs/souqi-platform-development-plan.md` records the Arabic product scope and phased plan; treat later phases as roadmap unless a route and API exist.
- Generate future dashboard concepts with `node scripts/generate-platform-mockups.mjs`, then build the roadmap PDF with `node scripts/generate-platform-plan-pdf.mjs`. The PDF may include these clearly labeled future concepts, but must not include current Expo screenshots or screen walkthroughs.