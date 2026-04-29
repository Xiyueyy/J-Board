<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repository Notes For Coding Agents

This file is for agents working in this repository. Product, deployment, API, and operations documentation belongs in `README.md`, `docs/API.md`, and `agent/jboard-agent/README.md`.

## Project Shape

J-Board is a Next.js App Router application backed by Prisma/PostgreSQL and Redis. It integrates with 3x-ui rather than replacing it:

- J-Board owns users, orders, plans, subscriptions, payments, support, notifications, audit logs, settings, and risk review.
- 3x-ui owns actual inbound runtime configuration and Xray clients.
- `agent/jboard-agent` is a read-only sidecar for latency, route trace, and optional Xray access log telemetry.

Do not add a new node control plane or Xray process manager unless the user explicitly changes the product direction.

## Next.js Work

Before editing App Router files, route handlers, server actions, metadata, or caching behavior, read the relevant docs from `node_modules/next/dist/docs/` for the installed Next.js version.

Common areas to check:

- App Router file conventions.
- Route Handler request/response behavior.
- Server Actions and `use server` requirements.
- Caching, `revalidatePath`, and dynamic rendering rules.

## Version And Release Policy

Panel and Agent versions are not forced to move together.

- Website/admin/UI/docs/server-only changes can be committed and pushed to `main` without creating a GitHub Release.
- Only create a new Agent tag and GitHub Release when Agent code, Agent install/upgrade behavior, or Agent release artifacts change.
- Agent releases must include `jboard-agent-linux-amd64`, `jboard-agent-linux-arm64`, and `SHA256SUMS`.
- Agent runtime version is in `agent/jboard-agent/cmd/agent/main.go`.
- Agent build version is in `agent/jboard-agent/Makefile`.
- Panel package version is in `package.json` and does not need to match the Agent version.

## Documentation Policy

When changing behavior, update docs in the same change:

- User/deployment/admin docs: `README.md`.
- HTTP API and Server Actions: `docs/API.md` and, for public HTTP changes, `docs/openapi.yaml`.
- Agent install, runtime, logs, and release behavior: `agent/jboard-agent/README.md`.
- Agent-facing repository rules: this file.

Keep docs factual and operational. Avoid promising features that are not implemented.

## Risk And Privacy Notes

Subscription risk and node access telemetry contain sensitive evidence: user IPs, locations, Xray client email, target hosts, timestamps, and admin review decisions. Treat these as sensitive data in logs, docs, screenshots, and tests.

Agent Xray log telemetry must remain read-only. It may read access logs and post aggregates to J-Board; it must not mutate 3x-ui or Xray runtime configuration.
