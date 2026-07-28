# Temporary preview contract

## Public path

- HTTPS origin: `https://wg.littleshark.xin`
- Preview prefix: `/preview/c7f19f3e0a3240be9ad9d36ae26f184b/`
- OpenResty proxies this prefix to `127.0.0.1:17610`.
- The SSH reverse tunnel binds port `17610` to server loopback only.
- Public viewers enter through HTTPS port `443`; no additional Tencent Cloud security-group port is open.

## Local path

- The preview script starts a loopback-only HTTP server on a free local port.
- A separate `ssh.exe` process uses the existing `tokyo-server` alias to map server loopback port `17610` to that local port.
- SSH multiplexes concurrent browser resource requests over one authenticated connection. It does not reuse or restart the Orca FRP service.
- Runtime state contains process IDs and paths only and is stored under the Windows temporary directory.

## Content boundary

The local server resolves every request under the Wargame project root and permits only browser runtime extensions:

`html`, `htm`, `js`, `mjs`, `css`, `json`, `wasm`, common raster/vector images, common audio, and web fonts.

It denies hidden path segments, directory listings, paths outside the project, and all other extensions. Frontend source needed by the browser remains temporarily downloadable by design; non-browser project files remain blocked.

## Persistent server data

The cloud server stores only the fixed reverse-proxy infrastructure configuration. It stores no QA HTML, screenshots, game assets, or preview session state. The existing `/t/` telemetry route and its data storage are separate from this workflow.

## Failure semantics

- Local host offline, SSH tunnel stopped, or preview server stopped: the preview content is unavailable.
- Public HTTPS 502 while offline is expected from the fixed gateway.
- Public port `17610` must remain unreachable directly from the internet.
- A stale local state file may be removed only after both recorded processes are confirmed absent.
