# CHANGELOG

<!-- version list -->

## v1.14.0-beta.1 (2026-03-23)

### Bug Fixes

- Correct plugin packaging paths and marketplace schema
  ([`cca9bba`](https://github.com/n24q02m/better-email-mcp/commit/cca9bba208d7ed75c39783197b5db32456f59c5c))

- Improve tool descriptions and corrective errors for LLM call pass rate
  ([`fccfc2f`](https://github.com/n24q02m/better-email-mcp/commit/fccfc2f551fca0dc5fc5864706194c1a8a1015fd))

- Redesign skills/hooks per approved spec
  ([`89f224f`](https://github.com/n24q02m/better-email-mcp/commit/89f224f7efed7f434b9bfcfa3b75ab89e7cadbb8))

- Standardize README structure with plugin-first Quick Start
  ([`a3454b1`](https://github.com/n24q02m/better-email-mcp/commit/a3454b17cfcbebb341bfd67053265c70aa554640))

- Sync plugin.json and server.json versions
  ([`b730c31`](https://github.com/n24q02m/better-email-mcp/commit/b730c311b88cfe2a6bcfea2e3935674d85ced7c7))

- **deps**: Update non-major dependencies
  ([#217](https://github.com/n24q02m/better-email-mcp/pull/217),
  [`19f6fbb`](https://github.com/n24q02m/better-email-mcp/commit/19f6fbb5231c44922c449cdc6ce00307247ee30c))

### Chores

- **deps**: Lock file maintenance ([#218](https://github.com/n24q02m/better-email-mcp/pull/218),
  [`aa9e567`](https://github.com/n24q02m/better-email-mcp/commit/aa9e56789780e6378d5bb531f188abb9526de331))

### Features

- Add EMAIL_CREDENTIALS env to plugin.json and setup guide
  ([`a37c0a2`](https://github.com/n24q02m/better-email-mcp/commit/a37c0a2ba9ff387fc83605be19c66abfa4983aaa))

- Add live MCP protocol tests
  ([`7b82f26`](https://github.com/n24q02m/better-email-mcp/commit/7b82f261f11000096aaf61f03a3016ae446d0ec1))

- Add plugin packaging with skills, hooks, and marketplace config
  ([`920c5b2`](https://github.com/n24q02m/better-email-mcp/commit/920c5b25a556497619c6a5bd3ef9256d749e4bfc))

- Improve tool descriptions and error messages for better LLM pass rate
  ([`3ed51d3`](https://github.com/n24q02m/better-email-mcp/commit/3ed51d3e4e8e493376d7835a506d4fc9a3800c37))

- Standardize README sections and sync Also by table
  ([`87c68ee`](https://github.com/n24q02m/better-email-mcp/commit/87c68ee720b27f0ee2140e1105be89635d668bc4))

### Performance Improvements

- Execute CPU-bound parsing outside of IMAP lock scope
  ([#219](https://github.com/n24q02m/better-email-mcp/pull/219),
  [`6e14905`](https://github.com/n24q02m/better-email-mcp/commit/6e149055e0ffb1c95a7e5acd982184f19c890757))

- **html-utils**: Optimize escapeHtml by using a single regex pass
  ([#224](https://github.com/n24q02m/better-email-mcp/pull/224),
  [`d9cc14a`](https://github.com/n24q02m/better-email-mcp/commit/d9cc14aa5ae7dfb9daca7e71d5d212a9576e6e59))


## v1.13.0 (2026-03-20)

### Bug Fixes

- Resolve version 0.0.0 by walking up directories to find package.json
  ([`f488912`](https://github.com/n24q02m/better-email-mcp/commit/f48891232cdf6368f1d575dd81a13cfa674ed7ba))

- Testing improvement] Add tests for createUnknownActionError
  ([#203](https://github.com/n24q02m/better-email-mcp/pull/203),
  [`413a58f`](https://github.com/n24q02m/better-email-mcp/commit/413a58f37057bf799596fc227f33dabd3b699024))

### Chores

- **deps**: Lock file maintenance ([#196](https://github.com/n24q02m/better-email-mcp/pull/196),
  [`df3edf9`](https://github.com/n24q02m/better-email-mcp/commit/df3edf97e74a4569e895f0a40d3b6b9d5dc33618))

- **deps**: Update codecov/codecov-action digest to 1af5884
  ([#200](https://github.com/n24q02m/better-email-mcp/pull/200),
  [`261d1bf`](https://github.com/n24q02m/better-email-mcp/commit/261d1bf8e766a3eff5b52d577db02371f86f8a54))

- **deps**: Update dawidd6/action-send-mail action to v16
  ([#199](https://github.com/n24q02m/better-email-mcp/pull/199),
  [`b469ea3`](https://github.com/n24q02m/better-email-mcp/commit/b469ea3485a39d77b5ae79cb2ece03417241996f))

### Features

- Optimize loadStoredTokens by removing synchronous file I/O
  ([#214](https://github.com/n24q02m/better-email-mcp/pull/214),
  [`d3dbc69`](https://github.com/n24q02m/better-email-mcp/commit/d3dbc6904998b327cbd126e5ff041777df204add))

### Performance Improvements

- Extract html-to-text options into module constant
  ([#201](https://github.com/n24q02m/better-email-mcp/pull/201),
  [`6576142`](https://github.com/n24q02m/better-email-mcp/commit/657614224f4fffde58b82d25840122aae4ed443f))


## v1.12.0 (2026-03-17)

### Bug Fixes

- Allow server startup without configured email accounts
  ([`f4b3715`](https://github.com/n24q02m/better-email-mcp/commit/f4b3715bda73e225f018d3ef7f33478c5594d5f2))

- Correct Glama.ai badge URL format
  ([`b0bc7e7`](https://github.com/n24q02m/better-email-mcp/commit/b0bc7e78655c0892e183a90e9eb4dbdf7cbfd680))

- Migrate biome config schema to 2.4.7
  ([`2c3597a`](https://github.com/n24q02m/better-email-mcp/commit/2c3597a00f718fd637ed07341b9a24b3be4e91a4))

- Remove junk pr_desc.txt file
  ([`739fb8b`](https://github.com/n24q02m/better-email-mcp/commit/739fb8bc9f28f1e4586c1d3b1b2aff1e54706bec))

- Remove junk pr_description.md file
  ([`4e86c7a`](https://github.com/n24q02m/better-email-mcp/commit/4e86c7a641c4c9ccac26d1b3ddd2a9fd6c1312a2))

- Standardize repo files across MCP server portfolio
  ([`f332c94`](https://github.com/n24q02m/better-email-mcp/commit/f332c94719a4cfa7cae2de8a56021554d9884aa4))

- Use exact domain matching for email account filtering
  ([`2486b92`](https://github.com/n24q02m/better-email-mcp/commit/2486b928248cc3f487f049bd5e675220aa8d2f68))

- **ci**: Use pull_request_target for jobs requiring secrets
  ([`f586a1e`](https://github.com/n24q02m/better-email-mcp/commit/f586a1e6076b6bc4eac1db64e1aabdeb09ebfb62))

- **deps**: Update non-major dependencies
  ([`8392653`](https://github.com/n24q02m/better-email-mcp/commit/83926534af205f56a4439e1e356add4b8a5b3422))

### Chores

- **deps**: Update dawidd6/action-send-mail action to v15
  ([`6a29247`](https://github.com/n24q02m/better-email-mcp/commit/6a292472158be00d97f189d864ab51d6db684bcb))

- **deps**: Update oven-sh/setup-bun digest to 0c5077e
  ([`effee64`](https://github.com/n24q02m/better-email-mcp/commit/effee64501fe4796705d14a9d24dc5d1df8dc1a5))

- **deps**: Update step-security/harden-runner digest to fa2e9d6
  ([`153baa8`](https://github.com/n24q02m/better-email-mcp/commit/153baa824466c9960d2b987aa92fa119f1cb9721))

### Features

- Add better-telegram-mcp to Also by section
  ([`ef0dcfe`](https://github.com/n24q02m/better-email-mcp/commit/ef0dcfeb72ad552a66e18e42d25f9b6f89fd6fd7))

- Add glama.json for Glama directory listing
  ([`7df3a7c`](https://github.com/n24q02m/better-email-mcp/commit/7df3a7c4a64020e734b582176187f5cff0be6222))

### Performance Improvements

- **html**: Optimize fastExtractSnippet regex and memory usage
  ([`0966e59`](https://github.com/n24q02m/better-email-mcp/commit/0966e59dcd2dc1abe31ff715171bdc7be37c4a31))

### Testing

- Add tests for scripts/start-server.ts
  ([`a20a9e6`](https://github.com/n24q02m/better-email-mcp/commit/a20a9e69a971bc6a13af2491a32f8add73409393))

- Fix typescript compilation errors in start-server.test.ts
  ([`ff6bc64`](https://github.com/n24q02m/better-email-mcp/commit/ff6bc6473fd005767231c574fe2627e6e2975f49))


## v1.11.0 (2026-03-12)


## v1.11.0-beta.2 (2026-03-12)

### Bug Fixes

- Require EMAIL_CREDENTIALS in live test, remove crash-prone fallback
  ([`8d51455`](https://github.com/n24q02m/better-email-mcp/commit/8d514554eecfc55a3d1dbfb8087d5c5f89916ba2))


## v1.11.0-beta.1 (2026-03-12)

### Bug Fixes

- Add tests for MCP tool registration and docs error handling]
  ([#154](https://github.com/n24q02m/better-email-mcp/pull/154),
  [`4290ce1`](https://github.com/n24q02m/better-email-mcp/commit/4290ce185ad4eca254f7d26a4b13db3643d6b1e9))

- Fix Command Injection in openBrowser
  ([#149](https://github.com/n24q02m/better-email-mcp/pull/149),
  [`3fdcb89`](https://github.com/n24q02m/better-email-mcp/commit/3fdcb89848e18bb7b7e006a26dfadc1b980614f9))

- Improve send tool description accuracy for LLM calling
  ([`f84a842`](https://github.com/n24q02m/better-email-mcp/commit/f84a8424c235081a81945d038a9d25a98704df77))

- Pin runtime versions with allowedVersions, revert Python to 3.13
  ([`35e8892`](https://github.com/n24q02m/better-email-mcp/commit/35e8892e5862e4531c11d4958a619ebaab5d32b5))

- Remove patch scripts and junk files from PR merges
  ([`bf34cf3`](https://github.com/n24q02m/better-email-mcp/commit/bf34cf35a940fae1c8918876d67a52b67e14d0dc))

- Revert Python to 3.13, disable mise runtime updates in Renovate
  ([`5a431ab`](https://github.com/n24q02m/better-email-mcp/commit/5a431ab7910431238559b025bcbeedd766fb4d6f))

### Chores

- **deps**: Lock file maintenance ([#144](https://github.com/n24q02m/better-email-mcp/pull/144),
  [`6565ce8`](https://github.com/n24q02m/better-email-mcp/commit/6565ce8a31977a1453d4a21003e5a90255fa6ae9))

- **deps**: Update actions/download-artifact digest to 3e5f45b
  ([#155](https://github.com/n24q02m/better-email-mcp/pull/155),
  [`96888c4`](https://github.com/n24q02m/better-email-mcp/commit/96888c44635d603818593f3d16227bae69143cee))

- **deps**: Update dawidd6/action-send-mail action to v13
  ([#157](https://github.com/n24q02m/better-email-mcp/pull/157),
  [`25c2ecf`](https://github.com/n24q02m/better-email-mcp/commit/25c2ecfeff4e5db76d3cc6c0aac0fa0085d47370))

- **deps**: Update non-major dependencies
  ([#156](https://github.com/n24q02m/better-email-mcp/pull/156),
  [`b05165b`](https://github.com/n24q02m/better-email-mcp/commit/b05165be702bd6b40142052cab5f9cb949ca614d))

### Features

- Add live MCP test script for all email tools and accounts
  ([`17ffce4`](https://github.com/n24q02m/better-email-mcp/commit/17ffce45cb1bbc6473abb63de394a6f4c5ec0d4d))

- Testing improvement] Add unit tests for OAuth2 CLI entry point
  ([#150](https://github.com/n24q02m/better-email-mcp/pull/150),
  [`35323c5`](https://github.com/n24q02m/better-email-mcp/commit/35323c558332faf760a78da6e4cb1d0caef840da))

### Performance Improvements

- Extract HTML entity map to module scope to avoid reallocation
  ([#152](https://github.com/n24q02m/better-email-mcp/pull/152),
  [`1ca53ef`](https://github.com/n24q02m/better-email-mcp/commit/1ca53efc65ad7d4d3bb4ec4035b3b024cb9a4c05))

### Testing

- Add unit tests for OAuth2 CLI entry point
  ([#150](https://github.com/n24q02m/better-email-mcp/pull/150),
  [`35323c5`](https://github.com/n24q02m/better-email-mcp/commit/35323c558332faf760a78da6e4cb1d0caef840da))


## v1.10.1 (2026-03-10)

### Bug Fixes

- Add .jules/ and JULES.md to gitignore
  ([`09a688d`](https://github.com/n24q02m/better-email-mcp/commit/09a688da22297962e76d8120697473df3589d0df))

- Remove commit-message-check job
  ([`87b247a`](https://github.com/n24q02m/better-email-mcp/commit/87b247a9a4011f3641143189b311e5c09cfd643b))

- Sync CI/CD configs and standardize templates
  ([`36b8df3`](https://github.com/n24q02m/better-email-mcp/commit/36b8df3592331bf44968eaa3d4f96ca2a2f1031f))

- ⚡ Bolt async cache race conditions in folder resolution
  ([`690bd95`](https://github.com/n24q02m/better-email-mcp/commit/690bd9522b405e38c795b4fc8333e17f4639ada5))

- **ci**: Pin PSR v10, Python 3.13, Node 24, Java 21 in Renovate
  ([`ee0e6c2`](https://github.com/n24q02m/better-email-mcp/commit/ee0e6c2e2441623215f7f576f9713b20acb46081))

- **deps**: Update non-major dependencies
  ([#142](https://github.com/n24q02m/better-email-mcp/pull/142),
  [`36e9daf`](https://github.com/n24q02m/better-email-mcp/commit/36e9daf44646eb8374fbe4ffc42bd2f82ed880ba))

### Chores

- **deps**: Lock file maintenance ([#131](https://github.com/n24q02m/better-email-mcp/pull/131),
  [`fe7af9a`](https://github.com/n24q02m/better-email-mcp/commit/fe7af9a41826091598458a9b97652d294b625f68))

- **deps**: Update actions/dependency-review-action digest to 3c4e3dc
  ([#141](https://github.com/n24q02m/better-email-mcp/pull/141),
  [`26e0d1e`](https://github.com/n24q02m/better-email-mcp/commit/26e0d1e290817b2b1d00e489a86f7eb5cb7b8fb6))

- **deps**: Update dawidd6/action-send-mail action to v11
  ([#138](https://github.com/n24q02m/better-email-mcp/pull/138),
  [`f6ea2a8`](https://github.com/n24q02m/better-email-mcp/commit/f6ea2a834f07123d623b4e29efefab70a5bb7612))

### Continuous Integration

- Improve PR checks and Qodo filtering
  ([#140](https://github.com/n24q02m/better-email-mcp/pull/140),
  [`79ae514`](https://github.com/n24q02m/better-email-mcp/commit/79ae5148802736ee61daaea6ef1c7d5286277960))


## v1.10.0 (2026-03-09)

### Bug Fixes

- Standardize CI with PR title check, email notify, and templates
  ([`ee735d7`](https://github.com/n24q02m/better-email-mcp/commit/ee735d73f88639b399ac40a139f9a27f84c09fee))

### Features

- Proactive OAuth2 auth at startup with auto browser open
  ([`d8fe48f`](https://github.com/n24q02m/better-email-mcp/commit/d8fe48f0def977277c28f038b3a98eedf654be73))


## v1.9.0 (2026-03-08)

### Bug Fixes

- Update send.md to reflect auto-auth flow
  ([`adba331`](https://github.com/n24q02m/better-email-mcp/commit/adba331b0da9bfff9604112791c9b4a01a4e1c9f))

### Features

- **security**: Add URL validation, path traversal protection, and PR template
  ([`aec4bd9`](https://github.com/n24q02m/better-email-mcp/commit/aec4bd9632773c00434dcd533f14883edd74823c))


## v1.8.0 (2026-03-08)

### Features

- Auto-initiate OAuth2 Device Code flow from MCP tool calls
  ([`07c2661`](https://github.com/n24q02m/better-email-mcp/commit/07c2661145094d4cf34e3946ce2216a71c073234))


## v1.7.0 (2026-03-08)

### Features

- Add OAuth2 Device Code flow for Outlook/Hotmail/Live accounts
  ([`24af5a7`](https://github.com/n24q02m/better-email-mcp/commit/24af5a79211c08d7a68fcb11641e7f1c88b3f4c6))


## v1.6.0 (2026-03-08)

### Bug Fixes

- Remove hardcoded credentials from test files
  ([`67a6273`](https://github.com/n24q02m/better-email-mcp/commit/67a62732317ce59d8360e33a9b6eb0fe60f0e502))

### Features

- Skip save-to-sent for Yahoo/iCloud, update provider docs
  ([`4a8927a`](https://github.com/n24q02m/better-email-mcp/commit/4a8927a37b92d2fd3447f7f6efba9be48af8ad52))


## v1.5.0 (2026-03-08)

### Bug Fixes

- Align repo with skill audit findings
  ([`85c6d5c`](https://github.com/n24q02m/better-email-mcp/commit/85c6d5c614be98f5f2a2f5209b2485cec7bcae15))

- Correct Qodo PR Agent ignore_pr_authors config
  ([`eb0861a`](https://github.com/n24q02m/better-email-mcp/commit/eb0861ade72af46322f872169b497ecf24e263e3))

- **ci**: Fix Qodo PR review for external contributors
  ([`e98bed7`](https://github.com/n24q02m/better-email-mcp/commit/e98bed70ae3923f19217710dfdf082ea3fa66c2a))

### Chores

- **deps**: Update dependency @types/node to ^25.3.5
  ([#127](https://github.com/n24q02m/better-email-mcp/pull/127),
  [`df01f4f`](https://github.com/n24q02m/better-email-mcp/commit/df01f4fe0b3b234820e6044a713900ead860e706))

- **deps**: Update docker/build-push-action action to v7
  ([#128](https://github.com/n24q02m/better-email-mcp/pull/128),
  [`a802bed`](https://github.com/n24q02m/better-email-mcp/commit/a802bed9d4cc7ad2d726c995c285123f22108a22))

- **deps**: Update docker/setup-buildx-action action to v4
  ([#130](https://github.com/n24q02m/better-email-mcp/pull/130),
  [`961dcb4`](https://github.com/n24q02m/better-email-mcp/commit/961dcb4d62f577a9117edae9f9c16a0c7d4a0edf))

- **deps**: Update step-security/harden-runner digest to 58077d3
  ([#126](https://github.com/n24q02m/better-email-mcp/pull/126),
  [`19699bd`](https://github.com/n24q02m/better-email-mcp/commit/19699bd8fcb54b334860b03aee10015dd8fe721f))

### Features

- Save sent emails to IMAP Sent folder
  ([#129](https://github.com/n24q02m/better-email-mcp/pull/129),
  [`858a401`](https://github.com/n24q02m/better-email-mcp/commit/858a401f79588af01e5effe53ca00ddf8424a25a))


## v1.4.7 (2026-03-06)

### Bug Fixes

- Add Docker LABEL and re-add OCI package for MCP Registry
  ([`0258f61`](https://github.com/n24q02m/better-email-mcp/commit/0258f61e4e83b14f0e5f992f0ff90588a4c38b9b))


## v1.4.6 (2026-03-06)

### Bug Fixes

- Remove OCI package from server.json until Docker LABEL annotation added
  ([`593ac6e`](https://github.com/n24q02m/better-email-mcp/commit/593ac6e9c253d40b75b90e7c0d192249823adfb6))


## v1.4.5 (2026-03-06)

### Bug Fixes

- Keep OCI identifier as latest in MCP Registry publish
  ([`4216b30`](https://github.com/n24q02m/better-email-mcp/commit/4216b300a75bb556c5d4b57942e38a9990ebdc26))

- **ci**: Skip Qodo AI review for bot-created PRs
  ([`7c8f05f`](https://github.com/n24q02m/better-email-mcp/commit/7c8f05ff9159e2d577c6d16c74427e3c82c14512))


## v1.4.4 (2026-03-06)

### Bug Fixes

- Handle OCI package version in MCP Registry publish
  ([`5274ca7`](https://github.com/n24q02m/better-email-mcp/commit/5274ca732ce666305705d23c68518e6c61a90a66))


## v1.4.3 (2026-03-06)

### Bug Fixes

- Update server.json version dynamically in MCP Registry publish job
  ([`18e15a8`](https://github.com/n24q02m/better-email-mcp/commit/18e15a8c86f5b0a9d80da2f0235425a8d64a7501))


## v1.4.2 (2026-03-06)

### Bug Fixes

- Add mcpName field for MCP Registry ownership validation
  ([`df63a43`](https://github.com/n24q02m/better-email-mcp/commit/df63a43f6a1a6bbded3b1404607bf7dd992620b9))


## v1.4.1 (2026-03-06)

### Bug Fixes

- Shorten server.json description to comply with MCP Registry 100-char limit
  ([`b7a57e6`](https://github.com/n24q02m/better-email-mcp/commit/b7a57e69dff82da2fa4adb260bdb7693c3400b9a))


## v1.4.0 (2026-03-06)

### Features

- Add compatible-with badges and cross-links to sibling MCP servers
  ([`1566da7`](https://github.com/n24q02m/better-email-mcp/commit/1566da71a4c97e2140d897ddd7e2418018eea24c))

- Add MCP client keywords to package.json for npm discoverability
  ([`2615f09`](https://github.com/n24q02m/better-email-mcp/commit/2615f099fbee9230152bc90fc2407d31bed24814))

- Add server.json and MCP Registry publish step to CD workflow
  ([`964b541`](https://github.com/n24q02m/better-email-mcp/commit/964b5410f4a34340780a817a408a8651741e1718))

- Update compatible-with badges - add Antigravity, Gemini CLI, Codex, OpenCode
  ([`25c3b7e`](https://github.com/n24q02m/better-email-mcp/commit/25c3b7e84728b7e243ea5c632a2eb240269aa563))


## v1.3.0 (2026-03-06)

### Bug Fixes

- Fix Codecov badge in README
  ([`317931b`](https://github.com/n24q02m/better-email-mcp/commit/317931b73e8ac07fa8d713552b701398ce800448))

- **deps**: Update dependency nodemailer to v8
  ([#109](https://github.com/n24q02m/better-email-mcp/pull/109),
  [`38c5a6d`](https://github.com/n24q02m/better-email-mcp/commit/38c5a6d0db16527b8b65abff50ef874497868469))

- **deps**: Update non-major dependencies
  ([#114](https://github.com/n24q02m/better-email-mcp/pull/114),
  [`f0770e3`](https://github.com/n24q02m/better-email-mcp/commit/f0770e3929a20b3f0968db1315fe41d0ba2b64fb))

- **security**: Resolve code scanning alerts and XSS in textToHtml
  ([`046ef8f`](https://github.com/n24q02m/better-email-mcp/commit/046ef8f2ca404366a50ea4caf29f2cb604e18773))

### Chores

- **deps**: Lock file maintenance ([#115](https://github.com/n24q02m/better-email-mcp/pull/115),
  [`1097c17`](https://github.com/n24q02m/better-email-mcp/commit/1097c17deef921af94754037d0b403ac40a1ee99))

- **deps**: Update actions/setup-node digest to 53b8394
  ([#118](https://github.com/n24q02m/better-email-mcp/pull/118),
  [`eeed317`](https://github.com/n24q02m/better-email-mcp/commit/eeed3172d27b9971df82e8e6f526047092279724))

- **deps**: Update dependency @types/node to v25
  ([#40](https://github.com/n24q02m/better-email-mcp/pull/40),
  [`2fbd9d9`](https://github.com/n24q02m/better-email-mcp/commit/2fbd9d995d777292ab2a8f477599a40eea347161))

### Features

- Add comprehensive Phase 5 live test via MCP protocol
  ([`95f6af6`](https://github.com/n24q02m/better-email-mcp/commit/95f6af6383bb8ca65759f82063a4399b60da9bcd))


## v1.2.5 (2026-03-03)

### Bug Fixes

- **deps**: Update non-major dependencies
  ([#39](https://github.com/n24q02m/better-email-mcp/pull/39),
  [`062973c`](https://github.com/n24q02m/better-email-mcp/commit/062973c5a38d836ed26623208cee1124d71238a0))

### Chores

- **deps**: Pin dependencies ([#38](https://github.com/n24q02m/better-email-mcp/pull/38),
  [`f6c7644`](https://github.com/n24q02m/better-email-mcp/commit/f6c7644ddcde0a7a61c69e613ff6b9a9d80be642))

- **deps**: Update github artifact actions
  ([#108](https://github.com/n24q02m/better-email-mcp/pull/108),
  [`4ffe9b4`](https://github.com/n24q02m/better-email-mcp/commit/4ffe9b468b32b666b0201b5257b27cdb30dc20f3))


## v1.2.4 (2026-03-03)

### Bug Fixes

- DRY flag handlers, RESOURCES-based help lookup, fast HTML snippets, add missing tests
  ([#113](https://github.com/n24q02m/better-email-mcp/pull/113),
  [`1d520b4`](https://github.com/n24q02m/better-email-mcp/commit/1d520b4c44821815ddf72ed80660c18a7d1763dd))


## v1.2.3 (2026-03-03)

### Bug Fixes

- **security**: Enforce SMTP TLS, prevent XSS, remove unused zod dep, DRY refactor, boost test
  coverage to 98% ([#112](https://github.com/n24q02m/better-email-mcp/pull/112),
  [`42a7011`](https://github.com/n24q02m/better-email-mcp/commit/42a70113d6f0a505813bfe44f526d0493abb1dff))


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
