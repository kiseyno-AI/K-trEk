# Git, pull requests and previews

`origin` is the public GitHub repository [kiseyno-AI/K-trEk](https://github.com/kiseyno-AI/K-trEk). `sites-origin` preserves the original Sites repository reference; it is not the review or release destination.

Create `codex/<change>` (or another descriptive feature branch), commit the change, push that branch to `origin`, then open a PR against `main`. Review behavior, screenshots and checks before merging. Avoid direct `main` edits and pushes. The initial import PR preserves the existing Git history and puts the accumulated Korea travel application under review.

The `Verify` workflow runs lint, TypeScript, tests and the component registry on pull requests. It has read-only repository permissions and performs no build, deployment, database migration or public-service restart. A merge is separate from deployment. Public release requires an explicit request and the reviewed release procedure in [PUBLIC_DEPLOYMENT.md](PUBLIC_DEPLOYMENT.md).

The original local checkout also contains ignored production `dist/` assets and `.wrangler/state`. Do not rebuild that directory to test a PR: the public Worker serves those files. Development uses separate `.wrangler/local-state` data. API keys, participant data and runtime state stay outside Git.

After opening a PR, return the original checkout to `main`. When a local feature preview must remain available, keep it in its own worktree with its own dependency/cache directory and local D1 state. A worktree's source, preview port and state location should be explicit in the handoff. Do not symlink its `.wrangler` directory to production state. A separate ignored `.dev.vars` may reference the owner's existing private server configuration; never commit it.
