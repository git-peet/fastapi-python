# Baseline source and sanitization

This repository is staged from the clean local snapshot at `full-stack-fastapi-template-master/`.

- **Upstream project:** [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)
- **License:** MIT. The upstream `LICENSE` file and its copyright notice are retained unchanged.
- **Snapshot provenance:** The supplied directory contains no `.git` metadata, so its exact upstream commit cannot be verified locally. Its directory/file timestamps show 2026-10-26, but that is filesystem metadata, not proof of the source commit. The directory name indicates a `master` archive, not a pinned revision.
- **Upstream reference:** `master` was observed at `aabb90126964a164e02aff39e7c385bb0598236d` on 2026-11-04. This is recorded for reference only; the snapshot has not been verified as byte-identical to that commit.
- **Sanitization:** Root `.env` and `frontend/.env` were excluded without reading their values. The repository keeps the upstream baseline's runtime files and license, with reviewed local-development additions tracked separately. The root `.gitignore` ignores `.env`/`.env.*` files (while allowing sanitized `.env.example` templates), local Python environments/caches, generated frontend build output, and workspace-local AgenticLab/`.pi`/knowledge state. No project database or AgenticLab workspace state was copied.

This file records the origin and limits of the staged baseline; it does not claim authorship of the upstream template or an exact upstream commit match.
