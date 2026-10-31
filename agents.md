# Agents: Using Shared Copilot Sessions

Shared Copilot sessions let teammates view and follow a Copilot coding agent session for this repository.

## Share a session

1. Open the Copilot agent session on GitHub (from the Agents panel at github.com/copilot/agents, or from the pull request the agent created).
2. Click **Share** (or copy the session URL from the browser).
3. Send the link to a teammate. They need read access to `The-Booligans/slotinvaders` to open it.

## View a shared session

1. Open the link you received.
2. Review the session log: prompts, tool calls, file changes and the resulting pull request.
3. Add comments on the linked pull request to steer follow-up work.

## Guidelines

- Never paste secrets or credentials into a session prompt; sessions are visible to everyone with access.
- Keep one task per session and describe the goal clearly in the first prompt.
- Review the agent's pull request like any other before merging.

## How agents should write code

- Write simple, minimal code. No speculative abstractions, no features that weren't asked for.
- Write tests for everything. Aim for high coverage; a change without a test is not done.
- Use the newest dependency versions. Check the registry (`npm view <pkg> version`, `pip index versions <pkg>`, etc.) instead of guessing — a guessed version that 404s wastes a round-trip.
- Follow clean-code rules: small functions, clear names, one responsibility per unit.
- Keep comments short and understandable. Only comment the *why* when it isn't obvious from the code.

## How agents should handle native platforms

- The app in `code/app` is one Capacitor build that ships to both iOS (`code/app/ios`) and Android (`code/app/android`). Every native feature — permissions, plugins, deep links, push, splash, icons, geolocation, camera, background tasks, etc. — must be implemented on **both** platforms in the same PR. A feature that only lands on one platform is not done.
- Prefer official Capacitor plugins over hand-rolled native code. If a plugin requires platform-specific config (`Info.plist` keys on iOS, `AndroidManifest.xml` entries on Android), update both.
- After touching web code, run `pnpm build && pnpm exec cap sync` so both the Android and iOS projects pick up the change.

## How agents should handle documentation

- Always check the `documentation/` directory before starting work, especially `documentation/architecture.md`. The architecture doc is the source of truth for how components fit together — read it so your changes stay consistent with it.
- When your change affects architecture, components, data flow, deployment or any other fact described in the docs, update the relevant documentation in the same PR. A change that drifts from the docs is not done.
- If the docs are silent on something you had to decide, add a short section rather than leaving the next agent to re-derive it.

## How agents should communicate

- Short, understandable, concise. No filler, no restating the task, no closing summaries that repeat the diff.
- State what changed and what's next in one or two sentences.
- When blocked, say what's blocking in one line and ask the specific question.
