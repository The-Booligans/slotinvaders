# BaselHack 2026 — Rules, Terms & Judging (research notes)

Researched 2026-10-18. Sources linked at the bottom.

> **Important:** the "Terms and Conditions" link in the website footer is generic
> website/webshop boilerplate — it is **not** the competition ruleset. The actual
> hackathon rules live in the **Verein (association) GitHub wiki**.

## Event frame

- **Dates:** Fri 30 Oct – Sun 1 Nov 2026, 48h format.
- **Location:** Basel region (venue not stated on the public page at time of research;
  past editions were at Haus der Wirtschaft, Pratteln).
- **Schedule (from the event page):**
  - Fri 17:00 — registration opens
  - Fri 18:00–19:45 — opening, challenge pitches, team building, dinner
  - Fri ~20:30 — hacking starts
  - **Sun 12:00 — "hands off" (hard submission deadline)**
  - Sun ~15:15–16:00 — awards + networking
- Attendance need not be continuous, but **be there Friday for team building and
  Sunday for the pitches**.
- **Language:** pitches and the final presentation must be **in English**. Team-internal
  working language is free.

## Teams

- Size: "more than you alone … and we suggest less than 8".
- Team changes are possible but discouraged.
- All skill levels welcome. **Age 16+**; minors need parental consent.
- One team works on **one challenge**; several teams may pick the same challenge.

## Intellectual property — the big one

- **Everything must be open source.** Verbatim: "all artefacts will be published on
  GitHub and thus have to be licensed open-sourced according to GitHub's suggestion."
- **No single team owns the IP.** The association's stated mission is that outputs are
  made available to the public under open licences
  ("Die Erzeugnisse werden der Allgemeinheit unter offenen Lizenzen zur Verfügung gestellt").
- Repos: **"open GitHub repo; personal will be forked from BaselHack"** — i.e. the team
  repo is expected to live under / be forked from the BaselHack org.
- Challenge providers (here: Endress+Hauser) must supply the data and hardware, and
  **that material also gets published openly**.

→ Practical consequence: do not bring anything into this repo that we are not willing
to publish under MIT/Apache-2.0. No proprietary snippets, no private credentials, no
NDA material.

## Explicitly prohibited

- **Cheating → disqualification.**
- **Modifying the competition itself** is prohibited.
- Website T&C additionally prohibit: unlawful use, harassment, discrimination
  (gender, sexual orientation, religion, ethnicity, race, age, national origin,
  disability), uploading malware, spamming.

## Notably _permissive_ / unusual rules

- **"Open doors" policy — "spying in other teams is allowed."**
- **"Fake it until you make it"** is explicitly endorsed (mock what you can't finish —
  the prototype is judged on what it demonstrates).
- **No pre-registration deadline for ideas** — "no deadline, pitches at BaselHack".
- **There is no published rule requiring all code to be written during the event**, and
  **no published AI-tool policy.** This is unlike MLH-style hackathons, which do forbid
  pre-built projects. BaselHack's own wiki is silent on both.

  → **We do not use that gap.** Our own stricter rule holds regardless: see
  "Our self-imposed rule" below.

## Our self-imposed rule: no repo, no commits before the hack starts

Even though the published rules permit it, **this team does not create the project repo
or commit project code before hacking begins** (Fri 2026-10-30, ~20:30).

- This directory (`~/projects/baselhack26`) is **preparation only** and is deliberately
  **not a git repository**. Don't `git init` it.
- The real repo is created fresh at the event, under / forked from the BaselHack org.
- Anything useful from here gets re-created deliberately at the event, not imported as
  a finished codebase.
- Rationale: a git history predating Friday reads as a pre-built submission no matter
  what the wiki allows.

What preparation _is_ fine: reading, research, notes, architecture thinking, learning
the ESP32-CAM toolchain, throwaway spikes that stay here, and arriving with a clear idea.

## Judging

Six criteria, each scored **1–10 points per juror** (equal weight, max 360 points with
six jurors):

1. Innovation content
2. Sustainability
3. Creativity / originality
4. Social relevance
5. Quality / functionality of the presented prototype
6. Quality of the presentation

Ties inside the top three → the jury debates separately.

→ Practical consequence: **only 2 of 6 criteria are about the build.** Sustainability
and social relevance are worth as much as functionality, and presentation quality
equals prototype quality. The pitch and the framing deserve real time, not the last
30 minutes.

## Challenge pitch constraint

A challenge/topic must be pitchable in **under 3 minutes** and presentable within the
event duration.

## Code of Conduct

Three principles (bilingual DE/EN), aspirational rather than enforcement-heavy:

- **Open** — open to collaboration, receptive to constructive comment and criticism.
- **Considerate** — thoughtful toward peers, attentive in communication, in person and online.
- **Respectful** — respect others, their positions, skills, commitments and efforts.

Underlying value: "We contribute to this community not because we have to, but because
we want to."

## Expected repo structure (BaselHack template)

The org publishes `baselhack_repo_template`, which mandates three top-level folders:

| Folder          | Contents                                  |
| --------------- | ----------------------------------------- |
| `code`          | all code                                  |
| `documentation` | UML diagrams, readmes, technical writeups |
| `assets`        | videos, presentation, supplementary media |

Plus an **MIT licence** template (copyright line to be filled with all team member
names; a different licence may be chosen by team consensus). Guidance: "Adjust to your
needs - but keep the dir structure :)"

→ Decision needed: adopt this structure for our repo, or keep a normal layout and
reorganise before submission.

## Still unknown / to confirm with organisers

- Exact venue.
- Whether a 2026 team repo will be created for us under the BaselHack org (and when).
- Pitch length for the **final** presentation on Sunday (the 3-minute figure is for
  _challenge_ pitches on Friday).
- Official stance on pre-event work and on AI coding tools.
- Team size hard cap (only "suggest less than 8" is documented).

## Sources

- [Challenge: Find my Bike Slot (Endress+Hauser)](https://www.baselhack.ch/challenges/placeholder-endress-hauser)
- [Event page / schedule](https://www.baselhack.ch/event)
- [Rules (wiki)](https://github.com/BaselHack/verein/wiki/Rules)
- [Evaluation Criteria (wiki)](<https://github.com/BaselHack/verein/wiki/Evaluation-Criteria-(Bewertungskriterien)>)
- [Code of Conduct (wiki)](<https://github.com/BaselHack/verein/wiki/Code-of-Conduct-(Verhaltenskodex)>)
- [Wiki home](https://github.com/BaselHack/verein/wiki/)
- [Repo template](https://github.com/BaselHack/baselhack_repo_template)
- [Website T&C (boilerplate, not competition rules)](https://www.baselhack.ch/terms-conditions)
