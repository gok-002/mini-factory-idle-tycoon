# MINI FACTORY: IDLE TYCOON

**Play it: https://gok-002.github.io/mini-factory-idle-tycoon/** (best on a phone, portrait mode)

A portrait, mobile-first idle/tycoon game. Start with a tiny one-machine workshop and grow it into a factory empire spanning 8 chapters:
**Produce → Sell → Earn → Upgrade → Automate → Unlock new zones.**

The in-game text is in Turkish.

## Tech

- **HTML5 Canvas 2D + plain JavaScript (ES modules)**: no build step, **zero runtime dependencies**.
- All graphics are procedural (drawn on canvas) and sound is synthesized with WebAudio; no external images, audio, fonts or CDNs.
- Tests use Node's built-in `node:test` runner (Node >= 18; developed on Node 24).
- Mobile packaging: Capacitor (optional, see below).

Why not Godot/Unity? The environment was web-based and both engines need a local install/editor. Game logic is separated from rendering
(`src/core`), so it can be ported to another engine later.

## Running locally

```bash
npm start        # http://localhost:5173 (dependency-free static server)
npm test         # automated tests
npm run balance  # balance bot report (npm run balance -- 500 simulates 500 hours)
npm run build    # produces a static bundle in www/
```

ES modules do not work over `file://`; use `npm start` or any static server. To try it on a phone, open `http://<your-computer-ip>:5173`
on the same network ("Add to Home Screen" installs it like an app; the service worker only activates on HTTPS/localhost).

## Project layout

```
index.html, css/style.css       UI skeleton and styling
src/main.js                     entry point: game loop, saving, background/offline handling
src/core/config.js              ALL balance data (machines, zones, upgrades, quests, patents, tuning)
src/core/economy.js             pure economy formulas
src/core/sim.js                 central production simulation + purchase rules (Game)
src/core/offline.js             offline earnings (one central function)
src/core/quests.js, state.js    quests; state schema + corrupt-save repair (sanitize)
src/core/save.js                SaveManager: versioned saves, backup, migrations
src/render/                     canvas scene, machine/product drawing, particle pool
src/ui/                         DOM UI (HUD, dock, sheets), icons
src/services/                   audio/haptics, monetization interface (no provider)
tests/, scripts/                tests, balance bot, build script
docs/MONETIZATION.md            ad / in-app purchase integration points (Turkish)
```

## How to play

- **Tap** a machine: each tap advances production by 1 second (a machine without automation only produces when tapped).
- **Upgrade** (x1 / x10 / MAX): level = value; milestones at Lv.10/25/50/100... double the value and add visual upgrades (lamp, hazard stripes, gold trim, sparkle).
- **Improve**: Production Speed, Item Value, Storage (a full belt stalls the machine) and **Automation**.
- **Buy Machine** or tap an empty slot. Each machine requires the previous one to reach a level first (`machineReq`: Lv.9, 12, 15 ... capped at 60), and prices grow ~7x per machine.
- **Zones / Chapters**: 8 chapters (Toy Workshop -> Galactic Center), 3 machines each. Finish the previous zone and pay the unlock cost to open the next chapter; a story popup introduces it. Use the arrows at the top corners to switch zones.
- **Quests**: 124 quests using a "ladder" system: only the next quest of each series is shown (produce, sell, income, level, zone, chapter quests...). Each reward can be claimed once.
- **Golden Crate**: a crate that appears and vanishes on the scene; catch it for 40-100 seconds of income or a 20-second x3 frenzy boost.
- **Daily gift**: a day streak (day 7 grants +1 Star). The gift button sits in the top corner.
- **Patents / Renovate Factory**: always visible in the bottom bar; while locked it shows the requirement (2B total earnings in the current run) and a progress bar. Once unlocked you can reset progress to earn permanent **Patent Stars** (+10% income each). Spend stars on permanent patents: income, offline time/efficiency, tap power, machine discount, "Heritage Machines" (start a new run with ready-made machines) and Golden Crate frequency.
- **Settings**: sound, haptics, reset.
- While offline, automated machines keep earning: up to 8 hours at 50% efficiency initially (up to 28 hours / 100% with patents).

## Visuals

Everything is drawn procedurally on canvas: animated wall scenery per chapter (clouds and sun beams, twinkling stars with shooting stars, glinting crystals,
ticking clocks, neon waves, a spiral galaxy), per-chapter ambient particles, belt rollers and item shadows, steam from automated machines, a booth clerk who
cheers on every sale, coins that fly to the money counter, a live portrait of the selected machine in the dock, chapter transition fades, a glossy button style
and a splash screen (tap to start, which also unlocks audio and haptics).

## Tuning the economy

Everything lives in `src/core/config.js`: a new machine = one row in `MACHINES`, a new quest = one row in `QUESTS`, a new zone = one row in `ZONES`.
After changing values, run `npm run balance` to see the pacing report and `npm test` to verify the basics.

## Test results (run during development)

`npm test` -> 52 tests, all passing. Coverage: starting values, production timing, belt/sales and money gain, manual/automated production,
blocking purchases with insufficient funds, double-tap protection, sequential machine/zone locks and level requirements, speed upgrades,
storage limits, bulk level costs, offline earnings (efficiency, cap, double-claim prevention, clock rollback), one-time quest rewards,
quest ladders and chapter quests, save/load, corrupt/missing/tampered saves, v1 -> v2 save migration, storage errors, NaN/Infinity guards,
prestige, patents, heritage machines, Golden Crate, daily gift, and a **balance bot** (greedy player simulation).

Verified manually in a Chromium-based embedded browser (375x812 / 360x640 / 320x568 layouts): main screen, tap-to-produce, products moving on belts,
sale effects, buying machines/automation/zones, sheets, quest rewards, save + reload, offline popup, reset, no horizontal overflow.
About 0.2 ms CPU per frame on desktop.

Balance bot (ideal player, 3 taps/second; it does not use Golden Crates, the daily gift or prestige; run `npm run balance -- 500`):
first automation ~7 s, 2nd machine ~5.5 min, 3rd machine ~12 min, zone 2 ~44 min, zone 3 ~4 h, Moon Base ~13 h, Crystal Mine ~25 h,
Time Lab ~54 h, Quantum Core ~114 h, Galactic Center ~248 h, final (24th) machine ~377 h.
Real players were observed reaching the bot's ~6-hour mark in about 2 hours, so a first run should take several weeks of daily play,
after which the renovate/patent loop continues. Post-prestige pacing (how fast the second run goes) is only tuned in theory and should be reviewed with real player data.

## Native mobile app (Capacitor)

> These steps were **not run in this environment** (no Android SDK / Xcode); this is the standard Capacitor flow.

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init "Mini Factory" com.example.minifactory --web-dir=www
npm run build
npx cap add android        # and/or: npx cap add ios (requires macOS + Xcode)
npx cap sync
npx cap open android       # Android Studio: Build > Generate Signed Bundle / APK
```

Tips: lock the screen orientation to portrait (`AndroidManifest.xml -> screenOrientation=portrait`), generate app icons from `icons/icon.svg`
(`@capacitor/assets`), and re-run `npm run build && npx cap sync` after changing `config.js`. Alternative: upload `www/` to any HTTPS static host and distribute it as a PWA.

## Known gaps and next steps

- **Not tested on real devices**: touch feel, haptics (`navigator.vibrate`, unavailable on iOS), audio latency and low-end phone performance still need verification.
- Sound consists of simple synthesized effects; there is no music.
- 3 machines per zone (24 total, 8 zones); production chains (raw material -> processing -> packaging) do not yet link machines together. The data model (`kind`, `product`, `zone`) is ready for it.
- No time-limited events, rewarded ads/IAP or cosmetic themes yet (integration points: `docs/MONETIZATION.md`).
- Save schema is versioned (`SAVE_VERSION`); one migration exists (v1 -> v2, which added prestige, daily gift, 24 machines and 8 zones).
- Accessibility: basic `aria` labels exist; canvas content is not described for screen readers. Text is Turkish only.
- Offline earnings trust the device clock (setting the clock forward only helps up to the offline time cap).
