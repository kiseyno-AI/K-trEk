# K-trEk repository workflow

- Work on a feature branch and open a pull request against `main`. Do not implement changes directly on `main`, push directly to `main`, or merge a pull request without an explicit request.
- GitHub remote `origin` is `https://github.com/kiseyno-AI/K-trEk.git`. The original `sites-origin` is a legacy remote; do not publish or push there unless explicitly requested.
- A commit, push or PR is not deployment authorization. Do not build, release, restart a public service or modify the production database without a separate explicit deployment request.
- The original checkout's ignored `dist/` is used by the live public Worker. Running a build there changes production assets even without a deployment command. Use isolated local previews for implementation and testing.
- Keep environment files, API keys, credentials, local D1 state, SQLite files, member data, reports, sessions, logs and generated source indexes out of Git. Preserve `.env.example` with placeholders only.
- Keep existing photo provenance and rights labels. An official image reference does not imply permission to redistribute it; do not apply a blanket license to third-party assets.

## Before a PR

1. Use the existing local Graphify graph to locate affected code; confirm it against source and tests. Keep the graph local and refresh it after source changes.
2. Make the smallest complete change. Reuse current components, tokens, camera and request owners. Add focused coverage for nontrivial behavior and preserve unrelated work.
3. Run `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run ui:check` and `git diff --check`. Do not use a production build as a verification gate in the live checkout.
4. For UI changes, update `ui-components.json` and its generated report, verify desktop/mobile behavior, and record animation ownership/performance limits where relevant.
5. Write a concise PR with the problem, resulting behavior, verification and material limits. Follow the PR template. Commit messages should explain intent and use Git-native Lore trailers such as `Tested:`, `Not-tested:` and `Scope-risk:` when useful.
6. After opening a PR, return the original checkout to `main`. Keep an active feature preview in its own worktree when returning would replace a running development server's source.

See [README.md](README.md) for setup and [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) for the Git/preview arrangement.
