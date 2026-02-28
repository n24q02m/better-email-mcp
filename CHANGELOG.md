# CHANGELOG

<!-- version list -->

## v1.2.1 (2026-02-28)

### Bug Fixes

- **docker**: Remove bun.lock from .dockerignore to fix COPY in Dockerfile
  ([`90cb1d4`](https://github.com/n24q02m/better-email-mcp/commit/90cb1d445d569d346c37b60541140403c484757f))


## v1.2.0 (2026-02-28)

### Bug Fixes

- Format renovate.json for Biome compatibility
  ([`441342f`](https://github.com/n24q02m/better-email-mcp/commit/441342f15e32caeee1cee8ed7e4f5d37c35f5a45))

- Standardize repo structure with enforce-commit hook and rulesets
  ([`3efd5cb`](https://github.com/n24q02m/better-email-mcp/commit/3efd5cb1e12d39e58ad50acb49dbfd4dace0c51a))

- Update README badges with Codecov, tech stack, and engineering standards
  ([`63f1240`](https://github.com/n24q02m/better-email-mcp/commit/63f1240d18f676c9eda173ed49d27102a2ddfa77))

- **ci**: Fix Qodo Merge env variable dot notation bug
  ([`37d4561`](https://github.com/n24q02m/better-email-mcp/commit/37d4561e41a8a1c075f062b054cb0da8ea4e2c7f))

- **ci**: Fix Qodo model to gemini-3-flash-preview
  ([`b30e190`](https://github.com/n24q02m/better-email-mcp/commit/b30e1906dde5fd9caa8ca84b68815df4be858d23))

- **ci**: Fix syntax errors and correctly configure Qodo + Gemini 3 Flash
  ([`4ad6900`](https://github.com/n24q02m/better-email-mcp/commit/4ad690026b7941e85e94969de43ecafa728f8273))

- **ci**: Move pr-agent config to .pr_agent.toml
  ([`944316f`](https://github.com/n24q02m/better-email-mcp/commit/944316fbedfb36fd2118217c7866b46c4bc0c945))

- **ci**: Update to supported Gemini 3 and 2.5 flash models
  ([`d9f00e5`](https://github.com/n24q02m/better-email-mcp/commit/d9f00e55fa15468c035e66b8d7d7c48946f933e4))

- **deps**: Update @modelcontextprotocol/sdk to 1.27.1
  ([`3a5499e`](https://github.com/n24q02m/better-email-mcp/commit/3a5499ef294080a6c6c28e716795b481077b4390))

### Chores

- Add Gemini Code Assist style guide
  ([`7578c17`](https://github.com/n24q02m/better-email-mcp/commit/7578c17796c6ef0fb0b2d6431c8589a15351da37))

- Change Renovate schedule to daily 5am
  ([`adf41ec`](https://github.com/n24q02m/better-email-mcp/commit/adf41ecdb55a1471be8ce0dbefe76580c964da86))

- Migrate to 2025-2026 tech stack (bun/biome)
  ([`343cf1f`](https://github.com/n24q02m/better-email-mcp/commit/343cf1f6da12908e9eb79f87b237bcad0e0b6d0e))

- Remove CodeRabbit config, migrating to Gemini Code Assist
  ([`9b269e9`](https://github.com/n24q02m/better-email-mcp/commit/9b269e95714f217762d2d3d8f3ab9b2f3b42e58c))

- **config**: Migrate config renovate.json
  ([#25](https://github.com/n24q02m/better-email-mcp/pull/25),
  [`9626c7b`](https://github.com/n24q02m/better-email-mcp/commit/9626c7b69b40ef3959e93dc0481bface249d633c))

### Features

- Add Codecov coverage upload and CodeRabbit config
  ([`68be4b1`](https://github.com/n24q02m/better-email-mcp/commit/68be4b19835ca3d70cf7be5d397a5be09de1ed94))

- Add CONTRIBUTING.md and Contributing section in README
  ([`34dcdba`](https://github.com/n24q02m/better-email-mcp/commit/34dcdba9ed5b456cc0739b524a814aad0816c86f))

- **ci**: Add Renovate config for automated dependency updates
  ([`db3448a`](https://github.com/n24q02m/better-email-mcp/commit/db3448acde1c2475c23201431ecdbe12afe3bf23))

- **ci**: Add StepSecurity Harden-Runner to all workflow jobs (audit mode)
  ([`c0f982e`](https://github.com/n24q02m/better-email-mcp/commit/c0f982e3c45c2d91676e33ee90231bfef164d97e))

- **ci**: Migrate to Qodo Merge AI Review (Gemini 3 Flash)
  ([`1d463f8`](https://github.com/n24q02m/better-email-mcp/commit/1d463f83d7cd32a4fb3878135a5da3c76aa91110))

- **oauth**: Add OAuth XOAUTH2 authentication for Gmail and Outlook
  ([`aa79f8e`](https://github.com/n24q02m/better-email-mcp/commit/aa79f8efc7fe68ea2af2bec210f7ba2464584719))


## v1.1.0 (2026-02-25)

### Features

- Add data encapsulation against indirect prompt injection (XPIA)
  ([`dffa1e1`](https://github.com/n24q02m/better-email-mcp/commit/dffa1e1ef3735cb590dc1165b7a2cadeabc2b73a))


## v1.0.2 (2026-02-24)

### Bug Fixes

- Account resolution should use exact match for email before fallback
  ([`b30cb30`](https://github.com/n24q02m/better-email-mcp/commit/b30cb30f8421273dfafab0e5333e8c99b55c9bf2))


## v1.0.1 (2026-02-24)

### Bug Fixes

- Add outlook app password instructions
  ([`56caed4`](https://github.com/n24q02m/better-email-mcp/commit/56caed4a0144b6e2e5b38ce3527ff1b0edcd86bd))

- Resolve imapflow fetchOne parameter position bug
  ([`473d1a8`](https://github.com/n24q02m/better-email-mcp/commit/473d1a89eac56768d2fe2b6d2f6f7c9984d3fdea))

- Update outlook app password instructions
  ([`4bb2e73`](https://github.com/n24q02m/better-email-mcp/commit/4bb2e733ccc2c7e2470ac0b978346ab8e9c3ab3d))

### Chores

- Exclude test files from npm package via tsconfig.build.json
  ([`a421ffe`](https://github.com/n24q02m/better-email-mcp/commit/a421ffe4911fd0e837982c9d5088f875b73939b3))


## v1.0.0 (2026-02-24)

- Initial Release
