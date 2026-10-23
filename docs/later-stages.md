# Later stages

Notes for what may come after the menu landing (task 14). Nothing here is scheduled, and only
what is marked as decided is decided. Each idea lists what it needs and the open questions, so a
later decision starts from facts.

## 1. Accounts, saved progress and a leaderboard

The idea: a signed-in player has the unlock path, progress kept on a server and a place on a
leaderboard. A guest can open every level, but their results do not reach the leaderboard.

What it needs:

- **A server.** The game and kokot.it are static today (no `api/` directory, progress only in
  localStorage). Accounts need serverless functions on the same origin (the CSP allows
  `connect-src 'self'`), a database and a sign-in provider (GitHub, Google or an email link).
- **Sign-in outside the frame.** In `?embed=1` the game runs in an iframe, and Google or GitHub
  will not show their sign-in there. Sign-in has to be a top-level redirect that returns to the
  case study page.
- **A score that can be ranked.** Stars stop at 3, so every good player ties. Candidates: life left
  plus gold left per level, a total over the ten levels, or the whole Siege as one run.
- **Results that cannot be faked.** The simulation runs in the browser, so a posted score is easy
  to forge. The engine is deterministic: the client can send the list of actions per build phase
  (the same `Solution` shape the proofs use, see `src/engine/replay.ts`), and the server replays it
  with the unchanged engine and computes the score itself. This is also a good story for the
  portfolio.
- **Personal data (GDPR).** An account on a business site needs a privacy policy, account deletion,
  a retention period and moderation of the names shown on the leaderboard.

Decided (2026-10-23):

- **A guest keeps the local save.** Guest progress stays in localStorage as today, so current
  players keep their stars; guests are only left off the leaderboard.

Open questions:

- Should signing in move a guest's local progress to the account?
- One leaderboard per level, one for the Siege, or both?

## 2. A leaderboard without accounts

A lighter step before accounts: after a win the player may enter a nickname, and the score goes up
with the replayed action list. No sign-in, no email, so far less personal data. It still needs the
server, the replay check and nickname moderation, but not the sign-in flow or account deletion.

## 3. The case study page on kokot.it

The menu became a landing inside the game; the case study page (`/projekty/relay-defense/`) was
left as it is apart from fresh screenshots. Possible next steps: lead with the live board, open the
embed with the call to action in view, and describe the unlock path and the proofs side by side.

## 4. A help dialog that reads well

The help (`?`, "How to play") is one narrow column: every dialog is `min(100%, 36rem)` wide
(`.dialog` in `src/styles/app.css`), and since the menu landing it holds the introduction, the four
steps, the star rule, levels and progress with the unlock switch, the keyboard table and the source
link. On a laptop it scrolls for several screens and is hard to read.

Directions to weigh:

- **Wider help only.** A `.dialog-help` width of about 56-64rem with two columns on wide screens
  (how to play and stars on the left, progress and keyboard on the right), one column on phones.
- **Sections instead of one long page.** Tabs or a short side list (How to play, Stars and
  progress, Keyboard), so each view fits on one screen; the dialog opens on the first.
- **Show, not tell.** Replace the four steps with small pictures: the sprites and a frame of the
  board with the route preview, one line each.
- **Less in the dialog.** The introduction already lives on the landing as the tagline; the
  keyboard table could open only on demand (a details element or the `?` key).

Constraints that stay: focus kept inside the dialog and returned on close, Escape and a click
outside close it, in `?embed=1` the height still follows the width only (the dialog opens near the top of
the frame), phones 360-640 px without horizontal scrolling, every new string in EN and PL.

## 5. Smaller ideas for the menu

- A short reel instead of a single wave on the showcase board: one wave each from a few levels.
- Show the Siege chapter reached as a small map of the ridge rather than a row of cards.
- A share link for a result (`?level=<id>` plus the stars), once there is a reason to share it.
