# platform-requirements MCP server

Custom MCP server (stateless streamable HTTP) holding the publishing
requirements we can actually verify, and the pre-flight check that runs a
customer's package against them.

## Why this server exists in this shape

The obvious design — "the agent publishes to KDP/Apple Books/IngramSpark" — is
impossible. None of the three has a public self-publisher submission API, so
there is no endpoint to call and no "platform credentials" to call it with. See
`specs/004-publishing-preflight/research.md`.

That leaves the part that is genuinely useful and genuinely not blocked:
knowing the rules exactly, and checking the package against them so the
customer's one attempt at an upload passes.

So this server is **read-only by construction**. Two tools, neither of which
writes, submits, or makes a network call:

| Tool | Purpose |
|---|---|
| `lookup_platform_requirements(platform, aspect=None)` | Authoritative rules for a platform, each with its source document and the date it was checked |
| `validate_package(platform, package)` | Every rule the declared package breaks, in one call |

There is no `submit_for_publishing`. If one is ever added here, read
`specs/004-publishing-preflight/spec.md` §2 first — it would mean browser
automation, which is a separate decision.

## Design decisions worth knowing

**Rules are data, not prose.** `platforms.py` holds structured literals that
`validate_package` consumes programmatically. Nothing here is model-generated
or scraped at runtime: an LLM inventing a trim size is worse than no answer,
and a test asserts every rule carries a source.

**An unsupported platform is an explicit error, never an empty success.** An
empty list would read as "no requirements" and let a package through unchecked.

**A missing field is `unknown`, not a pass.** `validate_package` returns
`violations`, `unchecked`, and `ok` separately. Silently skipping what it cannot
check is how a validator reports a clean package it never looked at.

**All violations come back at once.** Reporting only the first produces the
one-error-per-upload loop this exists to remove.

**IngramSpark's 1/16" print tolerance is part of the rule data.** A nominal-only
trim check passes files that printing then rejects, because Ingram tolerates
1/16" variance on every book.

**Floats in dimension fields are rejected, not rounded.** Rounding a customer's
dimension would invent a number they never gave us — and with a 1/16" tolerance,
that rounding is exactly what decides a pass or a rejection.

## Known limitation

Validation runs against *declared facts*, not file bytes. There is no artifact
store yet (`cover_assets.image_ref` is a string reference,
`formatting_jobs` records intent only), so this server cannot run EPUBCheck or
measure a real PDF. It says so in every `validate_package` result rather than
implying the files themselves were inspected.

## Running

```bash
uv run platform-requirements        # 127.0.0.1:8082
```

| Variable | Default | Purpose |
|---|---|---|
| `PLATFORM_REQUIREMENTS_HOST` | `127.0.0.1` | Bind address |
| `PLATFORM_REQUIREMENTS_PORT` | `8082` | 8080 is uvicorn, 8081 is ebook-data |

## Tests

```bash
uv run pytest -q
uv run ruff check .
uv run pyright
```