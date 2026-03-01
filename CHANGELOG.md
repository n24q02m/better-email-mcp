# CHANGELOG

<!-- version list -->

## v1.2.2 (2026-03-01)

### Bug Fixes

- **ci**: Add coverage/ to gitignore to prevent biome linting generated files
  ([`bb3431f`](https://github.com/n24q02m/better-email-mcp/commit/bb3431f0ae8d3e54f31055cc60be67d502df636a))

- **help**: Add help.md doc and add help to tool_name enum
  ([`22a0549`](https://github.com/n24q02m/better-email-mcp/commit/22a0549e6d36bb5f6e402345eaaedc4b33eb9708))

- **imap**: Remove dead code for recursive folder listing
  ([`eca4233`](https://github.com/n24q02m/better-email-mcp/commit/eca4233a61ea8c928c276af3036ea2bb16057dcd))

- **security**: Prevent sensitive data exposure in config logs
  ([`9f055e6`](https://github.com/n24q02m/better-email-mcp/commit/9f055e65a2b8c1098ce8ad65d9408ba4f3cd5fb4))

- **send**: Remove 'to' from required schema parameters to support replies
  ([`8329045`](https://github.com/n24q02m/better-email-mcp/commit/8329045901c0e0d29e47df9f57082fde4c71de75))

- **windows**: Replace bunx with bun x for cross-platform compatibility
  ([`8232f08`](https://github.com/n24q02m/better-email-mcp/commit/8232f0889e2297a47198681e52d5986f1e2067e3))

### Chores

- Apply manual fixes and resolve all pending issues and PRs
  ([`df5df5d`](https://github.com/n24q02m/better-email-mcp/commit/df5df5d0d86d85ff8bc65297de9784a36ab77fd0))

- **deps**: Update actions/checkout action to v6
  ([`bf95360`](https://github.com/n24q02m/better-email-mcp/commit/bf95360b6f6021d7607a0af2b3422a980101d20f))

### Performance Improvements

- Cache archive folder lookup to avoid repeated IMAP calls
  ([`200d1cd`](https://github.com/n24q02m/better-email-mcp/commit/200d1cdfdd717139e157e2cf911c7e0797781a5b))

### Testing

- Add integration test for missing documentation in help tool
  ([`0a175bf`](https://github.com/n24q02m/better-email-mcp/commit/0a175bf3223e2dc8c7e7746fca781a26a39a19f0))

- Add test case for ambiguous account in send tool
  ([`9f713c6`](https://github.com/n24q02m/better-email-mcp/commit/9f713c649df0f86a1647af146de5bc04370abc3b))

- Add test for missing arguments in tool registry
  ([`61b42e8`](https://github.com/n24q02m/better-email-mcp/commit/61b42e849ba07502baf29c9f014a764d976d3557))

- Add test for missing arguments in tool registry
  ([`615ff39`](https://github.com/n24q02m/better-email-mcp/commit/615ff397bb7fc3d01d1abbdfb7d85d339af3326d))

- **imap**: Fix unit test mocks for search and fetchAll to reflect new optimization logic
  ([`8329045`](https://github.com/n24q02m/better-email-mcp/commit/8329045901c0e0d29e47df9f57082fde4c71de75))

- **init-server**: Add tests for initServer
  ([`c94e843`](https://github.com/n24q02m/better-email-mcp/commit/c94e8430dc78d4ada37a83107c68d70d7b88c22c))

- **registry**: Add test case for unknown tool execution
  ([`59e3e0d`](https://github.com/n24q02m/better-email-mcp/commit/59e3e0de87d00664311527e948003d8a8d448ff1))

- **registry**: Add test case for unknown tool execution
  ([`6dcb97d`](https://github.com/n24q02m/better-email-mcp/commit/6dcb97d55fa3cf9f7baef042736bb66bc88c4c25))


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
