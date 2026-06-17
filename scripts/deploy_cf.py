#!/usr/bin/env python3
"""Build + push + deploy this MCP server's Cloudflare Worker+Container.

Turns the manual CF redeploy recipe into one repeatable command. Reads the
gitignored ``wrangler.deploy.jsonc`` (real account/KV/D1/Vectorize IDs) for the
container image name + account, builds the ``http`` target, pushes to the CF
managed registry, deploys, and waits for the container rollout to finish
(STATE=ready) so you never verify against a half-rolled old image.

Run from the repo root, with the CF dev token injected by skret:

    MSYS_NO_PATHCONV=1 skret run -e dev --path=/n24q02m/dev -- \\
        python scripts/deploy_cf.py            # tag defaults to b-<short-sha>
    ... python scripts/deploy_cf.py --tag b10-abc1234   # explicit tag
    ... python scripts/deploy_cf.py --skip-build         # reuse a built image
    ... python scripts/deploy_cf.py --dry-run            # print the plan only

Requires: CLOUDFLARE_API_TOKEN in env (skret /n24q02m/dev CF_DEV_TOKEN ->
export CLOUDFLARE_API_TOKEN), docker, and ``bunx wrangler``. The CF container
registry only pulls from registry.cloudflare.com/<account>/... (not ghcr), so the
local image is tagged to that path before ``wrangler containers push``.

Why the rollout wait: a heavy image (wet ~6GB) keeps serving OLD Durable Object
instances for minutes after deploy (``containers list`` STATE=provisioning);
verifying during that window shows stale behaviour. See docs/cf-deploy.md.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

DEPLOY_CONFIG = "wrangler.deploy.jsonc"


def _strip_jsonc(text: str) -> str:
    """Strip full-line // comments + trailing commas so json.loads accepts our
    deploy.jsonc. Inline // after values is intentionally NOT stripped (would
    corrupt https:// URLs); our deploy.jsonc keeps comments on their own lines."""
    lines = [ln for ln in text.splitlines() if not re.match(r"\s*//", ln)]
    body = "\n".join(lines)
    body = re.sub(r",(\s*[}\]])", r"\1", body)  # trailing commas
    return body


def _load_deploy_config(repo: Path) -> dict:
    path = repo / DEPLOY_CONFIG
    if not path.exists():
        sys.exit(
            f"{DEPLOY_CONFIG} not found in {repo}. It is gitignored (real IDs); "
            "reconstruct it from the committed wrangler.jsonc + CF resource IDs first."
        )
    return json.loads(_strip_jsonc(path.read_text(encoding="utf-8")))


def _short_sha(repo: Path) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "--short", "HEAD"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()


def _run(cmd: list[str], *, dry: bool, cwd: Path | None = None) -> None:
    print(f"  $ {' '.join(cmd)}")
    if dry:
        return
    subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=True)


def _image_parts(cfg: dict) -> tuple[str, str, str]:
    """Return (registry_base_without_tag, account_id, image_name) from the
    deploy config's first container image ref
    registry.cloudflare.com/<account>/<name>:<tag>."""
    ref = cfg["containers"][0]["image"]
    base = ref.rsplit(":", 1)[0]  # drop existing tag
    m = re.match(r"registry\.cloudflare\.com/([0-9a-f]+)/(.+)$", base)
    if not m:
        sys.exit(
            f"unexpected image ref (need registry.cloudflare.com/<acct>/<name>): {ref}"
        )
    return base, m.group(1), m.group(2)


def _set_image_tag(repo: Path, full_ref: str) -> None:
    """Rewrite the deploy.jsonc image line in place so `wrangler deploy` ships the
    tag we just pushed (gitignored file, safe to edit)."""
    path = repo / DEPLOY_CONFIG
    text = path.read_text(encoding="utf-8")
    new = re.sub(
        r'("image":\s*")registry\.cloudflare\.com/[^"]+(")',
        rf"\g<1>{full_ref}\g<2>",
        text,
        count=1,
    )
    path.write_text(new, encoding="utf-8")


def _wait_ready(worker: str, *, dry: bool, timeout_s: int = 600) -> None:
    """Poll `wrangler containers list` until the worker leaves provisioning."""
    if dry:
        print(f"  (dry-run) would poll containers list until {worker} STATE=ready")
        return
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        out = subprocess.run(
            ["bunx", "wrangler", "containers", "list"],
            capture_output=True,
            text=True,
        ).stdout
        line = next((ln for ln in out.splitlines() if worker in ln), "")
        print(f"  [rollout] {line.strip() or '(no row yet)'}")
        if line and "provisioning" not in line.lower():
            print(f"  rollout complete: {worker} is no longer provisioning.")
            return
        time.sleep(25)
    print(f"  WARNING: {worker} still provisioning after {timeout_s}s — verify later.")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Deploy this MCP server's CF Worker+Container."
    )
    p.add_argument("--tag", default="", help="image tag (default: b-<short-sha>)")
    p.add_argument(
        "--skip-build", action="store_true", help="reuse an already-built local image"
    )
    p.add_argument("--dry-run", action="store_true", help="print the plan, run nothing")
    args = p.parse_args(argv)

    repo = Path(__file__).resolve().parent.parent
    cfg = _load_deploy_config(repo)
    worker = cfg["name"]
    base, account, name = _image_parts(cfg)
    tag = args.tag or f"b-{_short_sha(repo)}"
    local = f"{name}:{tag}"
    full = f"{base}:{tag}"

    print(f"Deploy {worker}: image {local} -> {full}")
    if not args.skip_build:
        print("[1/4] docker build --target http")
        _run(
            ["docker", "build", "--target", "http", "-t", local, "."],
            dry=args.dry_run,
            cwd=repo,
        )
    print("[2/4] docker tag -> CF registry")
    _run(["docker", "tag", local, full], dry=args.dry_run)
    print("[3/4] wrangler containers push")
    _run(["bunx", "wrangler", "containers", "push", full], dry=args.dry_run, cwd=repo)
    print(f"[4/4] wrangler deploy --config {DEPLOY_CONFIG}")
    if not args.dry_run:
        _set_image_tag(repo, full)
    _run(
        ["bunx", "wrangler", "deploy", "--config", DEPLOY_CONFIG],
        dry=args.dry_run,
        cwd=repo,
    )

    print("Waiting for container rollout (avoid verifying a half-rolled old image)...")
    _wait_ready(worker, dry=args.dry_run)
    print(
        f"DONE: {worker} deployed at tag {tag}. Verify with scripts/cf_full_flow*.py."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
