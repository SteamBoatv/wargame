---
name: wargame-qa-publish
description: Temporarily expose a local Wargame HTML acceptance page through the project's HTTPS and reverse-SSH preview channel without uploading project content to the cloud server. Use when Codex needs to share a local static QA report, animation review, responsive layout check, or interactive browser-game test page with the user over a short-lived public URL, and when it needs to inspect or stop that preview.
---

# Wargame QA Publish

Publish acceptance pages as temporary local previews. Never upload the HTML or game assets to the cloud server.

## Workflow

1. Confirm the target is an HTML file inside the project.
2. Run a local smoke test before sharing an important page.
3. Start the preview:

   ```powershell
   uv run --isolated --no-project python .agents/skills/wargame-qa-publish/scripts/preview_share.py start <html-path>
   ```

4. Report the returned HTTPS URL and that the link depends on this Windows host remaining online.
5. Keep the preview active while the user is inspecting it.
6. Inspect the current session when needed:

   ```powershell
   uv run --isolated --no-project python .agents/skills/wargame-qa-publish/scripts/preview_share.py status
   ```

7. Stop the preview after the user finishes or before switching to another page:

   ```powershell
   uv run --isolated --no-project python .agents/skills/wargame-qa-publish/scripts/preview_share.py stop
   ```

Use `start --replace` only when replacing an active preview is clearly intended.

## Guardrails

- Expose one project HTML entry at a time.
- Serve browser runtime files from the local project; do not copy them to the server.
- Do not expose hidden directories, Markdown, configuration, Python, logs, credentials, or arbitrary project files.
- Reuse the fixed HTTPS gateway and the `tokyo-server` SSH alias. Do not open a Tencent Cloud security-group port.
- Do not alter the telemetry route under `/t/`.
- Do not modify OpenResty, FRPS, or sshd during normal `start`, `status`, or `stop`.
- Do not stop the preview while the user is actively reviewing it unless asked.
- Treat a 200 public check as network availability only; perform browser/playtest validation separately when layout or animation behavior matters.

Read [references/preview-contract.md](references/preview-contract.md) only when diagnosing infrastructure, changing the preview gateway, or reviewing the security boundary.
