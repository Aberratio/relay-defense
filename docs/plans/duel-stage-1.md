# Duel, stage 1 — plan

Sources: D-049 and D-050 in `brains/personal-brand/decisions.md`; the measurements in
`brains/personal-brand/research/2026-10-24-pojedynek-pomiary.md` (Q-010, Q-011, Q-012). No tracker key:
the branch slug `duel-stage-1` names this plan and its ledger.

## 1. What this is

This adds a browser-only rematch duel to Heartwood. Player A picks one of three maps and plays a
sparring run against fixed, visible sparring waves. The build actions taken before each wave become
A's defence script, which goes out as link 1. Player B opens link 1 and sees A's defence. B composes
four waves against it from 560 gold and plays their own sparring run on the same map; that becomes
link 2. A opens link 2, sees B's defence and composes waves against it; that becomes link 3. Both
players watch both replays: A's waves against B's defence, and B's waves against A's defence. The
score is the lives taken from the rival's Heart Tree, uncapped, because the waves play to the end.
Whoever takes more wins; an equal count is a draw. There are no accounts and no server. Everything
travels in the URL hash and the score is computed in the browser.

Corrections found while checking the premise:

- `profiles/personal-brand/profile.md` lists only `kokot-it` under `## repos`, so its test commands
  and gates do not cover relay-defense. This plan takes them from relay-defense's own `package.json`
  and `.github/workflows/ci.yml`: lint, typecheck, test, build, check:language, check:wording, smoke.
  The profile should get a relay-defense row (flow-onboard-project). Not blocking.
- The smoke test serves the build with `vite preview` and no CSP header. "Zero CSP errors" is
  therefore not checked anywhere today. Step 6 adds the check.
- The kokot.it case-study iframe has a fixed `src` (`kokot-it/src/embed.ts`) and does not forward a
  hash. A link to the case-study page would arrive without the duel, so the links point to the
  game's own page (decision 3).

## 2. Decisions taken, overridable

1. A defence is recorded from a sparring run. The build-phase actions (build, up, sell, mode) the
   player takes before each wave of a fixed sparring wave set form the `Solution`. If the gold runs
   out against the rival's waves, the action is skipped (`replay().rejected`) and the replay says how
   many were skipped. Beat: a single build before wave 1. Agreed with the owner, AskUserQuestion.
2. Uncapped lives need no engine change. The scored replay runs the duel level with a pool of 10 000
   lives and the score is `10 000 − lives`. The Heart Tree in the HUD shows "lives taken". Beat: an
   `endless` flag on `LevelDef` that bypasses the `lives <= 0` loss in `game.ts:492`. The maximum
   possible damage is 560 / 0.5 mites ≈ 1 120 lives, far below the pool. Self.
3. Links use the hash (`#duel=<payload>`) on the game's own page (`/tools/relay-defense/` on
   kokot.it). The hash never reaches a server log, which fits inviolable 2. Copying uses a read-only
   text field plus `navigator.clipboard` when the iframe allows it. Beat: forwarding the hash
   through the kokot.it case-study iframe, which needs a kokot-it code change. Left for a follow-up.
   Self.
4. The link format is compact text (`l54` = lance at 5,4; `u54` upgrade; `.` between waves; groups
   as kind/count/hp/gap/delay/portal tokens) with a leading format version and the duel balance
   version. A version mismatch shows "made with another version of the game" instead of a wrong
   result. Measured: the largest solution is 132 characters compact, 1 163 as base64url(JSON). Beat:
   base64url(JSON), which is simpler but about 9 times longer. Self.
5. Wave editor limits: 4 waves, 1–4 groups per wave, count 1–500, hp ×1/1.5/2/3/4, gap
   0.12/0.3/0.6/1/1.5 s, delay 0/2/4/8 s, portal 0 or 1. Every monster is allowed, the Ogre Warlord
   included. These are the values the measurement searched. The cap of 500 keeps a replay and a link
   bounded. Self.
6. Sparring waves: each map gets the "mixed" reference attack from the measurement, priced at the
   duel rate (0.5) and filled to 560. They are shown before the run like any level's waves. CI
   proves the solver beats them from 560 and the careless player wins at most 15%. Beat: no
   sparring, a free build. Self.
7. Names: there are no nicknames in stage 1. The screens say "Challenger" (A) and "Rival" (B)
   (Polish equivalents in the PL block of i18n.ts). Nicknames and moderation belong to stage 2. Self.
8. No new localStorage key. The whole duel state is in the link. A half-made answer is lost on
   reload, and the screen says so before you leave. Self.
9. The menu entry comes last. Steps 4–5 reach the duel only through `?mode=duel` or a `#duel=`
   link, and step 6 adds the menu button, so every synced build on kokot.it shows either a whole
   mode or none. Self.
10. Merge authority: the profile's `## merge authority` says `**` → human. The owner's instruction
    for this work grants a squash merge to main by the agent after a fresh-subagent review
    (flow-code-review / flow-confidence-check) and green CI, followed by a kokot-it sync PR
    (`npm run tools:sync`, `tools.lock.json`). No seam in this plan changes that, because every path
    is in relay-defense or `kokot-it/tools.lock.json` plus the synced build. Agreed with the owner,
    task prompt 2026-10-24.
11. `Math.hypot` → `Math.sqrt(dx*dx + dy*dy)` in `src/engine/game.ts:136` only. The renderer's
    `hypot`/`atan2` calls (board.ts, effects.ts) and the tower `atan2` (drawing angle only) stay,
    because they never feed back into the simulation. Measured: WebKit and Firefox differ from V8 in
    hypot on 38% of inputs; atan2 differs only in WebKit and only sets `t.angle`. Self.

## 3. The spine: seam table

| seam                                                                                                      | test level                                                                                                                                               | loop mode                                | deliberately not tested here                                          |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| `src/engine/game.ts` distance (`dist`)                                                                    | unit (engine.test.ts) plus replay (every reference solution still wins with unchanged lives/credits per wave)                                            | red→green on a pinned per-wave table     | renderer `hypot`/`atan2` (visual only)                                |
| `scripts/determinism.ts` cross-engine replay check                                                        | pipeline: CI job runs it in WebKit and Firefox against Node                                                                                              | job red on a seeded mismatch, then green | Chromium (same V8 as Node, measured 0 diffs)                          |
| `src/levels/duel.ts`: maps, sparring waves, `price`, `attackCost`, `validateAttack`, `duelLevel`, `score` | unit                                                                                                                                                     | red→green per rule                       | balance tuning beyond the D-050 numbers                               |
| `tests/duel-solutions.ts` and `tests/duel.test.ts`: proof per map                                         | replay (solver solution beats sparring; careless ≤ 15%; reference rematch golden scores, not a tie)                                                      | red→green per map                        | other budgets and rates                                               |
| `src/duel/link.ts`: encode/decode, versions, rejects garbage                                              | unit (round trip of every reference solution; fuzzed bad input → null)                                                                                   | red→green                                | URL length in real browsers beyond ~2000 (measured)                   |
| `src/duel/recorder.ts`: actions taken in the UI → `Solution`                                              | unit (a recorded sparring run replays to the same lives/credits)                                                                                         | red→green                                | the DOM click paths (smoke)                                           |
| `src/duel/editor.ts` model: groups, budget left, limits                                                   | unit                                                                                                                                                     | red→green                                | layout (smoke)                                                        |
| UI screens in `src/ui/app.ts` / `src/ui/duel.ts`: map choice, sparring, share, editor, replay, result     | e2e (scripts/smoke.ts: full A→B→A flow at 360 px and 1000 px, no horizontal scroll, height follows width, zero CSP violations under the kokot.it header) | smoke red → green                        | pixel-exact visuals; screen-reader output beyond the live-region text |
| `src/ui/i18n.ts` EN/PL duel strings                                                                       | unit (i18n.test.ts: key parity) plus check:language, check:wording                                                                                       | red→green                                | translation quality (owner reads PL)                                  |

## 4. Steps (one PR each, squash, then a kokot-it sync PR)

1. **Deterministic distance and a browser determinism check.** Area: `src/engine/game.ts`,
   `scripts/determinism.ts`, `.github/workflows/ci.yml` (installs WebKit and Firefox). Levels: unit,
   replay, pipeline. Agent.
2. **Duel rules and proofs.** Area: `src/levels/duel.ts`, `tests/duel.test.ts`,
   `tests/duel-solutions.ts` (written by `npm run solve -- duel-<map>`; the solver learns the duel
   ids). Levels: unit, replay. No UI. Agent.
3. **Link codec.** Area: `src/duel/link.ts`, tests. Level: unit. Agent.
4. **Sparring and challenge link (A, part 1).** Area: `src/duel/recorder.ts`, `src/ui/duel.ts`, app
   wiring for `?mode=duel` and `#duel=`, i18n. Levels: unit plus smoke (A plays sparring, gets link
   1). Agent.
5. **Wave editor and the answer (B), then the return (A).** Area: `src/duel/editor.ts`, editor UI,
   link 2 and link 3 flow, i18n. Levels: unit plus smoke (B composes on 360 px, budget enforced). Agent.
6. **Replays, result and menu entry.** Area: replay viewer (auto-applies the script, waves
   auto-start), result screen with the score and skipped moves, menu button, README "Duel" section
   and screenshot, smoke CSP check, docs/later-stages note. Levels: smoke, unit for the result model.
   Agent.

After each merge: a kokot-it PR, `npm run tools:sync` → `tools.lock.json` plus synced build; its CI
green; squash merge (deploys production through Actions). Agent, under decision 10.

## 5. Hand-offs and gates

| step                          | trigger                                  | owner                                        | command                                              | fallback                                          |
| ----------------------------- | ---------------------------------------- | -------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| merge each relay-defense PR   | irreversible (main moves; public repo)   | agent, granted by owner (decision 10)        | `gh pr merge <n> --squash` after review and green CI | leave the PR open and report it                   |
| merge each kokot-it sync PR   | irreversible (production deploy on main) | agent, granted by owner                      | `gh pr merge <n> --squash` after green CI            | leave open; production stays on the last tool SHA |
| WebKit/Firefox in CI          | none: a public download in CI, no secret | agent                                        | `npx playwright install --with-deps webkit firefox`  | run the check only in WebKit                      |
| secrets, DNS, outside parties | inviolable 2                             | not applicable: nothing in stage 1 needs one | —                                                    | —                                                 |

Permissions probed: `gh api repos/Aberratio/relay-defense --jq .permissions` gives admin and push;
kokot-it gives admin. Gates per PR: lint, typecheck, test, build, check:language, check:wording,
smoke (plus the new determinism job).

## 6. What no test level reaches

- **Needs a human:** whether the duel is fun and the editor understandable on a real phone; the PL
  wording reads naturally; a real Safari on iOS (the CI check uses Playwright WebKit, not iOS
  Safari).
- **Non-behavioural:** README "Duel" section and screenshot; docs/later-stages.md note that accounts
  and server replay are stage 2; the profile gap (relay-defense missing from `## repos`); the
  balance numbers are an agreement (D-050), not something a test proves fair beyond the
  measurement.

## 7. Traceability

| criterion                                                                                                                    | satisfied by                                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| A builds defence on a chosen map, gets link 1                                                                                | step 4 (smoke)                                                    |
| B opens link 1, sees A's defence, composes waves (560, price 0.5 × bounty × hp, ceil per group), builds own defence → link 2 | step 5 (editor unit and smoke), step 2 (`price`/`validateAttack`) |
| A opens link 2, sees B's defence, composes waves → link 3                                                                    | step 5 (smoke)                                                    |
| both watch replays; score = lives taken uncapped, more wins, equal = draw                                                    | step 6 (smoke), step 2 (`score` unit)                             |
| maps: Siege (2 portals, no hazards), Two Fronts, Colossus                                                                    | step 2                                                            |
| every duel map proven in CI                                                                                                  | step 2 (`tests/duel.test.ts`)                                     |
| hypot replaced, browser determinism in CI (Q-010)                                                                            | step 1                                                            |
| link fits (~2000)                                                                                                            | step 3 (unit asserts the longest reference stays under 2000)      |
| embed: height follows width only; 360–640 px without horizontal scroll                                                       | step 6 (smoke at 360 and 640)                                     |
| zero CSP errors (connect-src 'self')                                                                                         | step 6 (smoke under the kokot.it CSP header)                      |
| UI EN + PL, PL only in i18n PL block; check:language, check:wording                                                          | steps 4–6 (i18n.test.ts, CI gates)                                |
| new localStorage key only if needed                                                                                          | decision 8 (none added; reviewed in every UI PR)                  |
| small PRs, squash after fresh review and green CI, kokot-it sync after each                                                  | section 4 and 5, decision 10                                      |
| no secrets, DNS, outside parties; no accounts or server                                                                      | section 5; decision 3                                             |
| final report in Polish: what is live, PR links, what is open                                                                 | after step 6 (session)                                            |
