from __future__ import annotations

import argparse
import ctypes
import http.server
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any


SCRIPT_PATH = Path(__file__).resolve()
PROJECT_ROOT = SCRIPT_PATH.parents[4]
RUNTIME_DIR = Path(tempfile.gettempdir()) / "wargame-preview-share"
STATE_FILE = RUNTIME_DIR / "state.json"
SSH_EXE = shutil.which("ssh.exe")
SSH_ALIAS = "tokyo-server"

PUBLIC_BASE = (
    "https://wg.littleshark.xin/"
    "preview/c7f19f3e0a3240be9ad9d36ae26f184b/"
)
REMOTE_PORT = 17610

ALLOWED_EXTENSIONS = {
    ".html",
    ".htm",
    ".js",
    ".mjs",
    ".css",
    ".json",
    ".wasm",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".svg",
    ".ico",
    ".wav",
    ".mp3",
    ".ogg",
    ".flac",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
}

DETACHED_PROCESS = 0x00000008
CREATE_NEW_PROCESS_GROUP = 0x00000200
CREATE_NO_WINDOW = 0x08000000


class PreviewError(RuntimeError):
    pass


def emit(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def ensure_windows() -> None:
    if os.name != "nt":
        raise PreviewError("This project preview launcher currently supports Windows only.")


def resolve_entry(raw_path: str) -> tuple[Path, Path]:
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        candidate = (Path.cwd() / candidate).resolve()
    else:
        candidate = candidate.resolve()

    try:
        relative = candidate.relative_to(PROJECT_ROOT)
    except ValueError as exc:
        raise PreviewError("The preview HTML must be inside the Wargame project.") from exc

    if not candidate.is_file() or candidate.suffix.lower() not in {".html", ".htm"}:
        raise PreviewError(f"HTML entry does not exist: {candidate}")
    if any(part.startswith(".") for part in relative.parts):
        raise PreviewError("HTML entries inside hidden directories cannot be exposed.")
    return candidate, relative


def load_state() -> dict[str, Any] | None:
    if not STATE_FILE.exists():
        return None
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PreviewError(f"Preview state is unreadable: {STATE_FILE}") from exc


def save_state(state: dict[str, Any]) -> None:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    temporary = STATE_FILE.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temporary.replace(STATE_FILE)


def remove_runtime_files() -> None:
    STATE_FILE.unlink(missing_ok=True)
    try:
        RUNTIME_DIR.rmdir()
    except OSError:
        pass


def process_exists(pid: int) -> bool:
    if pid <= 0:
        return False
    process_query_limited_information = 0x1000
    handle = ctypes.windll.kernel32.OpenProcess(
        process_query_limited_information, False, pid
    )
    if not handle:
        return False
    ctypes.windll.kernel32.CloseHandle(handle)
    return True


def command_line_for(pid: int) -> str:
    command = (
        "$p = Get-CimInstance Win32_Process "
        f"-Filter \"ProcessId = {int(pid)}\"; "
        "if ($p) { $p.CommandLine }"
    )
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command", command],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=10,
        check=False,
    )
    return result.stdout.strip()


def terminate_recorded_process(pid: int, expected_fragment: str) -> bool:
    if not process_exists(pid):
        return False
    command_line = command_line_for(pid).lower()
    if expected_fragment.lower() not in command_line:
        raise PreviewError(
            f"Refusing to stop PID {pid}: it no longer matches the preview session."
        )
    subprocess.run(
        ["taskkill.exe", "/PID", str(pid), "/T", "/F"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=10,
        check=False,
    )
    return True


def stop_from_state(state: dict[str, Any]) -> dict[str, Any]:
    stopped: list[str] = []
    tunnel_pid = int(state.get("tunnel_pid", 0))
    server_pid = int(state.get("server_pid", 0))

    tunnel_signature = str(
        state.get(
            "tunnel_signature",
            f"127.0.0.1:{REMOTE_PORT}:127.0.0.1:{state.get('local_port', 0)}",
        )
    )
    if terminate_recorded_process(tunnel_pid, tunnel_signature):
        stopped.append("ssh_tunnel")
    if terminate_recorded_process(server_pid, f"{SCRIPT_PATH} _serve"):
        stopped.append("local_server")

    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        if not process_exists(tunnel_pid) and not process_exists(server_pid):
            break
        time.sleep(0.1)

    remove_runtime_files()
    return {"status": "stopped", "stopped": stopped}


def find_free_loopback_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def detached_popen(
    command: list[str],
    *,
    env: dict[str, str] | None = None,
) -> subprocess.Popen[bytes]:
    return subprocess.Popen(
        command,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=env,
        close_fds=True,
        creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW,
    )


def direct_opener() -> urllib.request.OpenerDirector:
    return urllib.request.build_opener(urllib.request.ProxyHandler({}))


def wait_for_url(url: str, timeout: float) -> int:
    opener = direct_opener()
    deadline = time.monotonic() + timeout
    last_status = 0
    while time.monotonic() < deadline:
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "wargame-preview-check/1.0"},
            )
            with opener.open(request, timeout=3) as response:
                last_status = int(response.status)
                if last_status == 200:
                    return last_status
        except urllib.error.HTTPError as exc:
            last_status = int(exc.code)
        except (urllib.error.URLError, TimeoutError, OSError):
            last_status = 0
        time.sleep(0.25)
    return last_status


def public_url_for(relative_entry: Path) -> str:
    quoted = urllib.parse.quote(relative_entry.as_posix(), safe="/")
    return urllib.parse.urljoin(PUBLIC_BASE, quoted)


def start_preview(raw_entry: str, replace: bool) -> dict[str, Any]:
    ensure_windows()
    entry, relative_entry = resolve_entry(raw_entry)

    existing = load_state()
    if existing:
        live = process_exists(int(existing.get("tunnel_pid", 0))) or process_exists(
            int(existing.get("server_pid", 0))
        )
        if live and not replace:
            raise PreviewError(
                "A preview is already active. Run status, stop it, or use start --replace."
            )
        if live:
            stop_from_state(existing)
        else:
            remove_runtime_files()

    if not SSH_EXE:
        raise PreviewError("OpenSSH client ssh.exe was not found.")
    local_port = find_free_loopback_port()
    url = public_url_for(relative_entry)
    tunnel_signature = f"127.0.0.1:{REMOTE_PORT}:127.0.0.1:{local_port}"

    server_process: subprocess.Popen[bytes] | None = None
    tunnel_process: subprocess.Popen[bytes] | None = None
    try:
        server_process = detached_popen(
            [
                sys.executable,
                str(SCRIPT_PATH),
                "_serve",
                "--port",
                str(local_port),
            ]
        )
        local_url = (
            f"http://127.0.0.1:{local_port}/"
            + urllib.parse.quote(relative_entry.as_posix(), safe="/")
        )
        local_status = wait_for_url(local_url, timeout=10)
        if local_status != 200:
            raise PreviewError(
                f"Local preview failed its readiness check (status {local_status})."
            )

        tunnel_process = detached_popen(
            [
                SSH_EXE,
                "-o",
                "BatchMode=yes",
                "-o",
                "ConnectTimeout=10",
                "-o",
                "ExitOnForwardFailure=yes",
                "-o",
                "ServerAliveInterval=30",
                "-o",
                "ServerAliveCountMax=3",
                "-N",
                "-T",
                "-R",
                tunnel_signature,
                SSH_ALIAS,
            ],
        )
        time.sleep(0.5)
        if tunnel_process.poll() is not None:
            raise PreviewError("The SSH reverse tunnel exited before becoming ready.")

        state = {
            "status": "starting",
            "entry": str(entry),
            "entry_relative": relative_entry.as_posix(),
            "url": url,
            "local_port": local_port,
            "remote_port": REMOTE_PORT,
            "server_pid": server_process.pid,
            "tunnel_pid": tunnel_process.pid,
            "tunnel_signature": tunnel_signature,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        save_state(state)

        public_status = wait_for_url(url, timeout=20)
        if public_status != 200:
            raise PreviewError(
                f"Public preview failed its readiness check (status {public_status})."
            )

        state["status"] = "active"
        state["public_status"] = public_status
        save_state(state)
        return state
    except Exception:
        if tunnel_process and tunnel_process.poll() is None:
            tunnel_process.terminate()
        if server_process and server_process.poll() is None:
            server_process.terminate()
        remove_runtime_files()
        raise


def preview_status() -> dict[str, Any]:
    state = load_state()
    if not state:
        return {"status": "inactive"}

    server_live = process_exists(int(state.get("server_pid", 0)))
    tunnel_live = process_exists(int(state.get("tunnel_pid", 0)))
    public_status = wait_for_url(str(state.get("url", "")), timeout=5)
    result = dict(state)
    result.update(
        {
            "status": (
                "active"
                if server_live and tunnel_live and public_status == 200
                else "degraded"
            ),
            "server_live": server_live,
            "tunnel_live": tunnel_live,
            "public_status": public_status,
        }
    )
    return result


def is_allowed_request(raw_path: str) -> bool:
    parsed = urllib.parse.urlsplit(raw_path)
    decoded = urllib.parse.unquote(parsed.path)
    relative = PurePosixPath(decoded.lstrip("/"))
    if not relative.parts or relative.is_absolute():
        return False
    if ".." in relative.parts or any(part.startswith(".") for part in relative.parts):
        return False
    if relative.suffix.lower() not in ALLOWED_EXTENSIONS:
        return False

    target = (PROJECT_ROOT / Path(*relative.parts)).resolve()
    try:
        target.relative_to(PROJECT_ROOT)
    except ValueError:
        return False
    return target.is_file()


class RestrictedProjectHandler(http.server.SimpleHTTPRequestHandler):
    server_version = "WargamePreview/1.0"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def _serve_allowed(self, head_only: bool = False) -> None:
        if not is_allowed_request(self.path):
            self.send_error(404)
            return
        if head_only:
            super().do_HEAD()
        else:
            super().do_GET()

    def do_GET(self) -> None:
        self._serve_allowed()

    def do_HEAD(self) -> None:
        self._serve_allowed(head_only=True)

    def list_directory(self, path: str) -> None:
        self.send_error(403)
        return None

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, format: str, *args: Any) -> None:
        return


def serve(local_port: int) -> None:
    ensure_windows()
    server = http.server.ThreadingHTTPServer(
        ("127.0.0.1", local_port),
        RestrictedProjectHandler,
    )
    signal.signal(signal.SIGINT, lambda *_: server.shutdown())
    try:
        server.serve_forever(poll_interval=0.25)
    finally:
        server.server_close()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Share a local Wargame HTML page through a temporary SSH reverse tunnel.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    start_parser = subparsers.add_parser("start")
    start_parser.add_argument("entry", help="HTML file inside the Wargame project")
    start_parser.add_argument(
        "--replace",
        action="store_true",
        help="stop an active preview before starting this one",
    )

    subparsers.add_parser("status")
    subparsers.add_parser("stop")

    serve_parser = subparsers.add_parser("_serve")
    serve_parser.add_argument("--port", type=int, required=True)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        if args.command == "start":
            emit(start_preview(args.entry, args.replace))
        elif args.command == "status":
            emit(preview_status())
        elif args.command == "stop":
            state = load_state()
            emit(stop_from_state(state) if state else {"status": "inactive"})
        elif args.command == "_serve":
            serve(args.port)
        return 0
    except PreviewError as exc:
        emit({"status": "error", "message": str(exc)})
        return 1
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
