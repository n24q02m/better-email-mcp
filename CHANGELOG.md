# CHANGELOG

<!-- version list -->

## v1.35.0-beta.1 (2026-07-10)

### Bug Fixes

- Reject unauthenticated /mcp at the Worker edge
  ([#992](https://github.com/n24q02m/better-email-mcp/pull/992),
  [`7472c0a`](https://github.com/n24q02m/better-email-mcp/commit/7472c0a6cd874cf3d0977d847945697e09013348))

### Features

- Add opencode github agent (responds to /oc)
  ([`cfaffc4`](https://github.com/n24q02m/better-email-mcp/commit/cfaffc4ede63ce7b389baad84d5b0e140881bdfa))

- Add review-learnings store the automated reviewer must obey
  ([`6510aa0`](https://github.com/n24q02m/better-email-mcp/commit/6510aa06cc369908813f2d3ab065e328aa56c40a))

- Auto-respond only to issues and PRs opened by outside people
  ([`5278628`](https://github.com/n24q02m/better-email-mcp/commit/52786289ae4c0ac79db7d7e1638d1e592a6e5e29))

- Reviewer must obey .github/review-learnings.md
  ([`e68ef9a`](https://github.com/n24q02m/better-email-mcp/commit/e68ef9af5bda8ba2da1e26fd2502a24136a408f6))


## v1.34.2-beta.2 (2026-07-09)

### Bug Fixes

- Point EmailContainer pingEndpoint at /health (core-ts liveness route) so CF health passes
  ([#988](https://github.com/n24q02m/better-email-mcp/pull/988),
  [`f8b5dcc`](https://github.com/n24q02m/better-email-mcp/commit/f8b5dcc70b917be5577a80b14836fef852445e57))


## v1.34.2-beta.1 (2026-07-09)

### Bug Fixes

- Cf container health check ping endpoint override
  ([`1eef180`](https://github.com/n24q02m/better-email-mcp/commit/1eef1808e99f30d802676d1e16f4e6a49329a58a))


## v1.34.1 (2026-07-05)

### Bug Fixes

- Use caret range for mcp-core dep to fix npm/npx install
  ([`3898433`](https://github.com/n24q02m/better-email-mcp/commit/3898433accdfda4870c8afb70e141bc8b411b0ba))


## v1.34.1-beta.1 (2026-07-05)

### Bug Fixes

- Add BYO Deploy to Cloudflare section to README
  ([#968](https://github.com/n24q02m/better-email-mcp/pull/968),
  [`7267521`](https://github.com/n24q02m/better-email-mcp/commit/7267521b5318077b963015e3ac7ac5f2db3d2cd8))

- Add role=group to account cards for screen readers
  ([`ec6216b`](https://github.com/n24q02m/better-email-mcp/commit/ec6216b7bb1ada8915aa2c992eff58de0f83db12))

- Fast-path exact/prefix match before bigram alloc in findClosestMatch
  ([`1d7fd32`](https://github.com/n24q02m/better-email-mcp/commit/1d7fd3254a9d46d0c29e36878f7dc682cdb62cac))

- Manage form focus for keyboard and screen-reader users
  ([`fa7b67e`](https://github.com/n24q02m/better-email-mcp/commit/fa7b67e8ee74418ed3beee7cdc630b541cbf5bdc))

- Note Workers Paid plan is required for Containers in README
  ([#968](https://github.com/n24q02m/better-email-mcp/pull/968),
  [`7267521`](https://github.com/n24q02m/better-email-mcp/commit/7267521b5318077b963015e3ac7ac5f2db3d2cd8))

- Replace innerHTML with safe DOM manipulation in submit button
  ([`913a06e`](https://github.com/n24q02m/better-email-mcp/commit/913a06eafd049de2e0f3378953c37527b9cae4a6))

- Replace redundant regex test with direct replace in imap search
  ([`00a7a41`](https://github.com/n24q02m/better-email-mcp/commit/00a7a419729d2a4d2ed12121636a8eb57201bc7a))

- Substitute PUBLIC_URL and drop routes in cf-deploy.js
  ([#968](https://github.com/n24q02m/better-email-mcp/pull/968),
  [`7267521`](https://github.com/n24q02m/better-email-mcp/commit/7267521b5318077b963015e3ac7ac5f2db3d2cd8))

- Use placeholders for PUBLIC_URL and routes in wrangler.jsonc (BYO-generic)
  ([#968](https://github.com/n24q02m/better-email-mcp/pull/968),
  [`7267521`](https://github.com/n24q02m/better-email-mcp/commit/7267521b5318077b963015e3ac7ac5f2db3d2cd8))

- Validate redirect URL protocol before window.location.replace
  ([`dc1cca3`](https://github.com/n24q02m/better-email-mcp/commit/dc1cca3d4e02a696b3ce09a0cd35b702f5213391))

- **deps**: Lock file maintenance
  ([`70a8607`](https://github.com/n24q02m/better-email-mcp/commit/70a860783a33cb8f14417171101a87bf6eda805c))

- **deps**: Update non-major dependencies
  ([`ce04b01`](https://github.com/n24q02m/better-email-mcp/commit/ce04b01b3c3ca39740aab35d56cabc39ef89da9c))

### Chores

- **deps**: Update docker/build-push-action digest to 53b7df9
  ([#960](https://github.com/n24q02m/better-email-mcp/pull/960),
  [`f625ae1`](https://github.com/n24q02m/better-email-mcp/commit/f625ae13da06a9615eba83ac5cd10d66275266b1))

- **deps**: Update docker/login-action digest to af1e73f
  ([#972](https://github.com/n24q02m/better-email-mcp/pull/972),
  [`0b640ef`](https://github.com/n24q02m/better-email-mcp/commit/0b640ef9884b52e07bfbda0818cf2ce825b02419))

- **deps**: Update docker/setup-buildx-action digest to bb05f3f
  ([#973](https://github.com/n24q02m/better-email-mcp/pull/973),
  [`ab27a32`](https://github.com/n24q02m/better-email-mcp/commit/ab27a32a1d9ed84a0eaf75468b41e8a78d428893))


## v1.34.0 (2026-07-02)

### Bug Fixes

- Align mcp-core pin guard test with 1.18.1 stable
  ([#967](https://github.com/n24q02m/better-email-mcp/pull/967),
  [`e3c3902`](https://github.com/n24q02m/better-email-mcp/commit/e3c39024adec92a29af3b4aff2bee4ec7cffb70d))

- Bump mcp-core to 1.18.1 ([#967](https://github.com/n24q02m/better-email-mcp/pull/967),
  [`e3c3902`](https://github.com/n24q02m/better-email-mcp/commit/e3c39024adec92a29af3b4aff2bee4ec7cffb70d))


## v1.34.0-beta.1 (2026-07-02)

### Features

- Deploy CF Worker+Container on release from cd.yml
  ([#965](https://github.com/n24q02m/better-email-mcp/pull/965),
  [`c83bb0e`](https://github.com/n24q02m/better-email-mcp/commit/c83bb0e10c07d66b5496628e11d23976624788d3))


## v1.33.0 (2026-07-01)


## v1.33.0-beta.7 (2026-07-01)

### Bug Fixes

- Correct HTTP host to email.n24q02m.com and tool count in docs
  ([#958](https://github.com/n24q02m/better-email-mcp/pull/958),
  [`0899d6d`](https://github.com/n24q02m/better-email-mcp/commit/0899d6de5e57a696aee23e509de01d327b8391d9))

- **deps**: Update non-major dependencies
  ([#955](https://github.com/n24q02m/better-email-mcp/pull/955),
  [`599e3de`](https://github.com/n24q02m/better-email-mcp/commit/599e3de996258582257ad33e3454b072e4321a3b))

- **ui**: Prevent unnecessary DOM rebuilds on email input
  ([#957](https://github.com/n24q02m/better-email-mcp/pull/957),
  [`117dcaf`](https://github.com/n24q02m/better-email-mcp/commit/117dcaf80b26487569f8d9c510fc7d55b830b14f))

### Chores

- **deps**: Lock file maintenance ([#956](https://github.com/n24q02m/better-email-mcp/pull/956),
  [`b9386ec`](https://github.com/n24q02m/better-email-mcp/commit/b9386ec56c3f549f239eb8d908caa4db5165a5ff))


## v1.33.0-beta.6 (2026-06-30)

### Bug Fixes

- Add credential-state setSetupUrl edge-case tests
  ([`12b2368`](https://github.com/n24q02m/better-email-mcp/commit/12b2368ad148f5896c606f8131368459b762a442))

- Add imap-client clearSentFolderCache tests
  ([`3cfed48`](https://github.com/n24q02m/better-email-mcp/commit/3cfed485a1a7f983ee6e4b3f44b5a5a89083a81c))

- Add tests for potential flaky test using setTimeout in http.test.ts
  ([`e25715f`](https://github.com/n24q02m/better-email-mcp/commit/e25715fd5f134fb4d7043bc146f6848ad19a9566))

- Add tests for untested public function saveOutlookTokens
  ([`f285abb`](https://github.com/n24q02m/better-email-mcp/commit/f285abbef72af741a00aca359cfc3319165d9790))

- Assert single-DO routing in worker test (default, not per-sub)
  ([#954](https://github.com/n24q02m/better-email-mcp/pull/954),
  [`e611db5`](https://github.com/n24q02m/better-email-mcp/commit/e611db5c86160e17ce89fe7665b63bcf2b6f8fea))

- Canary Gate-A/B settle-retry to avoid false-fail on slow container startup
  ([#949](https://github.com/n24q02m/better-email-mcp/pull/949),
  [`50fbc7d`](https://github.com/n24q02m/better-email-mcp/commit/50fbc7d15b12822988b6850cc03599fb57c3726c))

- Collapse OAuth + per-sub routing to one DO (resolve max_instances=1 deadlock)
  ([#953](https://github.com/n24q02m/better-email-mcp/pull/953),
  [`1fcd641`](https://github.com/n24q02m/better-email-mcp/commit/1fcd641be442240db10d49c09489f21462b7f8f5))

- Exclude arrays from isRecord so sanitizeErrorDetails handles them
  ([`dc9791d`](https://github.com/n24q02m/better-email-mcp/commit/dc9791db9497c3c97b051ea190e6e5ff7d7d0d33))

- Lock file maintenance
  ([`c9fb869`](https://github.com/n24q02m/better-email-mcp/commit/c9fb869fd3442b80ab7e4d69ee8f759e8070ae6d))

- Missing edge case test in oauth2.ts
  ([`124ec45`](https://github.com/n24q02m/better-email-mcp/commit/124ec4528b47723b23feb6e235e86b862b54d4f6))

- Route OAuth /token refresh to the sub's DO to avoid max_instances=1 deadlock
  ([#950](https://github.com/n24q02m/better-email-mcp/pull/950),
  [`e722c7f`](https://github.com/n24q02m/better-email-mcp/commit/e722c7fa3f14e3dee1c45426d381450cca004152))

- Use of 'any' Type: enhanceError
  ([`e0d587e`](https://github.com/n24q02m/better-email-mcp/commit/e0d587e0e7dd98059bc80a08943741ad9692f4bf))

### Features

- Dynamically update account card titles and ARIA labels
  ([`69db920`](https://github.com/n24q02m/better-email-mcp/commit/69db92085373af1f5ba7b67837f5ee8aa5cb1176))


## v1.33.0-beta.5 (2026-06-29)

### Bug Fixes

- Add aria-pressed to password toggle
  ([`9643cd7`](https://github.com/n24q02m/better-email-mcp/commit/9643cd750f21e6df943980d6e3d543aae195eb80))

- Cap max_instances=1 for CF container cost (solo dev default)
  ([`54d6632`](https://github.com/n24q02m/better-email-mcp/commit/54d6632b5bca272aa82de63381d04572a8b7cf20))

- Cover clearSentFolderCache
  ([`bd13d94`](https://github.com/n24q02m/better-email-mcp/commit/bd13d9451d0839574abe598bffb213959894e2f6))

- Cover html-utils edge cases
  ([`628a0a3`](https://github.com/n24q02m/better-email-mcp/commit/628a0a3629620e0bcad2b3b575bbd42866facdef))

- Cover null/undefined email throw
  ([`e8d97d9`](https://github.com/n24q02m/better-email-mcp/commit/e8d97d9fef4f7e2125d72187e4019c832234f1c7))

- Cover registry error path
  ([`4262e93`](https://github.com/n24q02m/better-email-mcp/commit/4262e932de491eaecd40f5d0caa1b93376208d3c))

- Cover setSetupUrl
  ([`83ee339`](https://github.com/n24q02m/better-email-mcp/commit/83ee339889b485d251a76fab186d09409fe95ec9))

- Harden OAuth token-store JSON.parse against prototype pollution
  ([`e7f1c5f`](https://github.com/n24q02m/better-email-mcp/commit/e7f1c5f8bbe79104fa87872a1044a8add5d752cf))

- Iterative tag-strip closes IncompleteHtmlAttributeSanitization
  ([`05a9943`](https://github.com/n24q02m/better-email-mcp/commit/05a9943a04a313fb08f7afd5205dd43748aa978a))

- Mark setup complete after outlook oauth device-code
  ([#903](https://github.com/n24q02m/better-email-mcp/pull/903),
  [`adafd4f`](https://github.com/n24q02m/better-email-mcp/commit/adafd4f22b4758f514666b8a1809a532622b09f7))

- Persist device-code session to KV, reduce sleepAfter 20m→5m
  ([`64de6f8`](https://github.com/n24q02m/better-email-mcp/commit/64de6f87677d07c5eaac7f1caf4ae06d4934f030))

- Resolve outlook token key via id_token subject fallback
  ([#912](https://github.com/n24q02m/better-email-mcp/pull/912),
  [`4d0d710`](https://github.com/n24q02m/better-email-mcp/commit/4d0d7103a90c95f1153cff400106438ba3128554))

- Simplify createFieldGroup via destructuring
  ([`d0c20c9`](https://github.com/n24q02m/better-email-mcp/commit/d0c20c98950395de1fe9892d9e9bd42e03e6aa8b))

- Use 32-bit integer bigrams in findClosestMatch
  ([`91688f7`](https://github.com/n24q02m/better-email-mcp/commit/91688f7202867cfc0eecbdd97f86f35ec4828a57))

- **deps**: Update non-major dependencies
  ([#914](https://github.com/n24q02m/better-email-mcp/pull/914),
  [`55018fb`](https://github.com/n24q02m/better-email-mcp/commit/55018fb50ec19e4c5dc4af0d556cf238951c005a))

### Chores

- **deps**: Lock file maintenance ([#894](https://github.com/n24q02m/better-email-mcp/pull/894),
  [`6b3f2fb`](https://github.com/n24q02m/better-email-mcp/commit/6b3f2fb59f0966806ff9c4275aafebd7a72e3aea))

- **deps**: Update dawidd6/action-send-mail action to v18
  ([#919](https://github.com/n24q02m/better-email-mcp/pull/919),
  [`56ae47a`](https://github.com/n24q02m/better-email-mcp/commit/56ae47a8b5c50ab83e6e4c3eafe9ebe879ebc916))


## v1.33.0-beta.4 (2026-06-22)

### Bug Fixes

- Bump mcp-core to 1.18.0b19 (relay model-search catalog + OAuth refresh-TTL)
  ([#893](https://github.com/n24q02m/better-email-mcp/pull/893),
  [`e6ca8a7`](https://github.com/n24q02m/better-email-mcp/commit/e6ca8a7e84cecf760841fc6eef031e958a2e7268))


## v1.33.0-beta.3 (2026-06-22)

### Bug Fixes

- Pin CF container max_instances to 3 ([#892](https://github.com/n24q02m/better-email-mcp/pull/892),
  [`3601b7d`](https://github.com/n24q02m/better-email-mcp/commit/3601b7d5ccca060fff7c3ea027e9eef8dafe8e79))

- Remove stale README status block and add real install section
  ([#889](https://github.com/n24q02m/better-email-mcp/pull/889),
  [`3d66f02`](https://github.com/n24q02m/better-email-mcp/commit/3d66f02c5ba8b1375fbab0f787e8e1cd42c06211))

### Chores

- **deps**: Lock file maintenance ([#890](https://github.com/n24q02m/better-email-mcp/pull/890),
  [`05b6ca9`](https://github.com/n24q02m/better-email-mcp/commit/05b6ca92e2da9d777a656a1ef29deaa171282bca))


## v1.33.0-beta.2 (2026-06-21)

### Bug Fixes

- Add cf:deploy script for live wrangler deploy
  ([#888](https://github.com/n24q02m/better-email-mcp/pull/888),
  [`dfd7790`](https://github.com/n24q02m/better-email-mcp/commit/dfd779046a40fe49d9853d2cbea207957c2eea34))

- Drop env-derived value from cf_deploy log (CodeQL js/clear-text-logging)
  ([#888](https://github.com/n24q02m/better-email-mcp/pull/888),
  [`dfd7790`](https://github.com/n24q02m/better-email-mcp/commit/dfd779046a40fe49d9853d2cbea207957c2eea34))

- Make canary gate utf-8-safe (decode+encode) and Cloudflare-UA-aware
  ([`d270c4c`](https://github.com/n24q02m/better-email-mcp/commit/d270c4ce8ecc613b60eb93008a05ac108a1a79bb))

- Make canary gate utf-8-safe and Cloudflare-UA-aware
  ([`d270c4c`](https://github.com/n24q02m/better-email-mcp/commit/d270c4ce8ecc613b60eb93008a05ac108a1a79bb))

- Neutral default endpoint + env-first secrets in CF self-host scripts
  ([`4503744`](https://github.com/n24q02m/better-email-mcp/commit/4503744c624b2476c01ea0a09993d6c4b2f9e379))

- Right-size CF container memory to cut GiB-second cost
  ([#887](https://github.com/n24q02m/better-email-mcp/pull/887),
  [`0853495`](https://github.com/n24q02m/better-email-mcp/commit/0853495b3db5679d1420205279f90565bd744ca7))

- Use contextlib.suppress for stdout reconfigure (SIM105)
  ([`d270c4c`](https://github.com/n24q02m/better-email-mcp/commit/d270c4ce8ecc613b60eb93008a05ac108a1a79bb))

- **deps**: Update non-major dependencies
  ([#878](https://github.com/n24q02m/better-email-mcp/pull/878),
  [`0387606`](https://github.com/n24q02m/better-email-mcp/commit/03876069993c07d568edab6a13424c10337dd273))

### Chores

- **deps**: Lock file maintenance ([#880](https://github.com/n24q02m/better-email-mcp/pull/880),
  [`2d08022`](https://github.com/n24q02m/better-email-mcp/commit/2d080227a15762cc0be959be389a0c59afa7c6e6))

- **deps**: Update actions/checkout action to v7
  ([#879](https://github.com/n24q02m/better-email-mcp/pull/879),
  [`c6689de`](https://github.com/n24q02m/better-email-mcp/commit/c6689de1bd36a2e80ef9abe0d320033515d77248))

- **deps**: Update dependency @types/node to v26
  ([#883](https://github.com/n24q02m/better-email-mcp/pull/883),
  [`e052255`](https://github.com/n24q02m/better-email-mcp/commit/e052255bc7124bfcf966d64bd3acbc0fa905355e))


## v1.33.0-beta.1 (2026-06-18)

### Bug Fixes

- Add post-deploy canary gate with auto-rollback to deploy_cf.py
  ([`818cd1d`](https://github.com/n24q02m/better-email-mcp/commit/818cd1de11419b38be40bfb61dfb59a3d54a70eb))

- Correct action count to 21 in Features bullet
  ([#829](https://github.com/n24q02m/better-email-mcp/pull/829),
  [`c472cbb`](https://github.com/n24q02m/better-email-mcp/commit/c472cbb86bce27c029e4ef9b7cc41941c35616c1))

- Correct architecture docs to match runtime behavior
  ([`2ffacda`](https://github.com/n24q02m/better-email-mcp/commit/2ffacda227fe255efaf7b705de8e18aad6911001))

- Forward HOST=0.0.0.0 into the email container (TS-on-CF binding footgun)
  ([#866](https://github.com/n24q02m/better-email-mcp/pull/866),
  [`0dd5eaf`](https://github.com/n24q02m/better-email-mcp/commit/0dd5eaf23e3ce7854a99eb5bb7bfa459600f99a7))

- Prefix unused account var to satisfy RUF059
  ([`818cd1d`](https://github.com/n24q02m/better-email-mcp/commit/818cd1de11419b38be40bfb61dfb59a3d54a70eb))

- Refresh lockfile (renovate maintenance)
  ([`76689c2`](https://github.com/n24q02m/better-email-mcp/commit/76689c2d4d2d0936f4b39b6157431a7b45a8bfcd))

- Remove dead disk-backed per-user credential store
  ([`a562a74`](https://github.com/n24q02m/better-email-mcp/commit/a562a7451cb75a138c26eb970bd7f792f317499a))

- Remove orphaned Qodo pr-agent config
  ([#826](https://github.com/n24q02m/better-email-mcp/pull/826),
  [`48e68df`](https://github.com/n24q02m/better-email-mcp/commit/48e68df78990b382a54cf76ca87f65f0f2354f79))

- Remove stray temp_http_test.ts scratch file from repo root
  ([#866](https://github.com/n24q02m/better-email-mcp/pull/866),
  [`0dd5eaf`](https://github.com/n24q02m/better-email-mcp/commit/0dd5eaf23e3ce7854a99eb5bb7bfa459600f99a7))

- Remove stray temp_http_test.ts scratch file from repo root
  ([#865](https://github.com/n24q02m/better-email-mcp/pull/865),
  [`933fdea`](https://github.com/n24q02m/better-email-mcp/commit/933fdea2ea4b18791e4c85ec514539337a23b506))

- Report per-sub configured state from config(status) in multi-user mode
  ([#866](https://github.com/n24q02m/better-email-mcp/pull/866),
  [`0dd5eaf`](https://github.com/n24q02m/better-email-mcp/commit/0dd5eaf23e3ce7854a99eb5bb7bfa459600f99a7))

- Sync README tagline to current capability description
  ([#831](https://github.com/n24q02m/better-email-mcp/pull/831),
  [`55c49a4`](https://github.com/n24q02m/better-email-mcp/commit/55c49a4c6bb3d4b094c3fedda34dc1c8e6e80279))

- Update node.js base image
  ([`0ee0c10`](https://github.com/n24q02m/better-email-mcp/commit/0ee0c10bd5a29950d766fb8b919b3bae3fab10b0))

- Update nodemailer to v9
  ([`31dedf5`](https://github.com/n24q02m/better-email-mcp/commit/31dedf5244d20b4d97606a0eef5effbce5598e1b))

- Update non-major dependencies
  ([`c748a48`](https://github.com/n24q02m/better-email-mcp/commit/c748a48768f2710146cf88c06d08cdefbe8fb36c))

- **deps**: Update non-major dependencies
  ([#823](https://github.com/n24q02m/better-email-mcp/pull/823),
  [`3d89848`](https://github.com/n24q02m/better-email-mcp/commit/3d898482401a4506aa392019d8ccb02f8115b139))

### Chores

- **deps**: Lock file maintenance ([#824](https://github.com/n24q02m/better-email-mcp/pull/824),
  [`ed1c319`](https://github.com/n24q02m/better-email-mcp/commit/ed1c31992fee2f84f073fe4f11448d03cd17b756))

- **deps**: Update node.js to fb71d01 ([#833](https://github.com/n24q02m/better-email-mcp/pull/833),
  [`3a0f6e7`](https://github.com/n24q02m/better-email-mcp/commit/3a0f6e7ed972bfabaf0e5cc2a1be099bc56c735c))

### Features

- A11y for the email credential form (carryover from closed PRs)
  ([#866](https://github.com/n24q02m/better-email-mcp/pull/866),
  [`0dd5eaf`](https://github.com/n24q02m/better-email-mcp/commit/0dd5eaf23e3ce7854a99eb5bb7bfa459600f99a7))

- Add --tools mode to CF self-test harness for read-only tool coverage
  ([#866](https://github.com/n24q02m/better-email-mcp/pull/866),
  [`0dd5eaf`](https://github.com/n24q02m/better-email-mcp/commit/0dd5eaf23e3ce7854a99eb5bb7bfa459600f99a7))

- Add CF full-flow self-test harness + document Cloudflare KV deploy
  ([#866](https://github.com/n24q02m/better-email-mcp/pull/866),
  [`0dd5eaf`](https://github.com/n24q02m/better-email-mcp/commit/0dd5eaf23e3ce7854a99eb5bb7bfa459600f99a7))

- Add CF-migration test harness + bump mcp-core to 1.18.0-beta.7 storage backends
  ([#866](https://github.com/n24q02m/better-email-mcp/pull/866),
  [`0dd5eaf`](https://github.com/n24q02m/better-email-mcp/commit/0dd5eaf23e3ce7854a99eb5bb7bfa459600f99a7))

- Add Cloudflare Worker (KV-only) + wrangler config + EdDSA contract guard
  ([#866](https://github.com/n24q02m/better-email-mcp/pull/866),
  [`0dd5eaf`](https://github.com/n24q02m/better-email-mcp/commit/0dd5eaf23e3ce7854a99eb5bb7bfa459600f99a7))

- Add copy button + a11y labels to OAuth device-code form
  ([`598dcb6`](https://github.com/n24q02m/better-email-mcp/commit/598dcb6bd95608eeef2c696d47a125405d84eb80))

- Add PerSubCredStore KV write-through credential store (embed + schema-validate)
  ([#866](https://github.com/n24q02m/better-email-mcp/pull/866),
  [`0dd5eaf`](https://github.com/n24q02m/better-email-mcp/commit/0dd5eaf23e3ce7854a99eb5bb7bfa459600f99a7))

- Add post-deploy canary gate with auto-rollback to deploy_cf.py
  ([`818cd1d`](https://github.com/n24q02m/better-email-mcp/commit/818cd1de11419b38be40bfb61dfb59a3d54a70eb))

- Add Python CF full-flow OAuth self-test harness
  ([#866](https://github.com/n24q02m/better-email-mcp/pull/866),
  [`0dd5eaf`](https://github.com/n24q02m/better-email-mcp/commit/0dd5eaf23e3ce7854a99eb5bb7bfa459600f99a7))

- Add show/hide password toggle to credential form
  ([`b462baa`](https://github.com/n24q02m/better-email-mcp/commit/b462baaefa59d2e26930b5bef5043de398fc05f5))

- Embed Outlook OAuth tokens in the per-sub credential blob
  ([#866](https://github.com/n24q02m/better-email-mcp/pull/866),
  [`0dd5eaf`](https://github.com/n24q02m/better-email-mcp/commit/0dd5eaf23e3ce7854a99eb5bb7bfa459600f99a7))

- Expose currentSub() for detached Outlook token writes
  ([#866](https://github.com/n24q02m/better-email-mcp/pull/866),
  [`0dd5eaf`](https://github.com/n24q02m/better-email-mcp/commit/0dd5eaf23e3ce7854a99eb5bb7bfa459600f99a7))

- Migrate better-email-mcp to Cloudflare (per-sub KV, multi-user)
  ([#866](https://github.com/n24q02m/better-email-mcp/pull/866),
  [`0dd5eaf`](https://github.com/n24q02m/better-email-mcp/commit/0dd5eaf23e3ce7854a99eb5bb7bfa459600f99a7))

- Sync cross-promo section ([#832](https://github.com/n24q02m/better-email-mcp/pull/832),
  [`4686a9e`](https://github.com/n24q02m/better-email-mcp/commit/4686a9e3a7f002e9ceebfea3df29c14c923eb2b2))

- Wire PerSubCredStore into http transport + fix cross-user bleed
  ([#866](https://github.com/n24q02m/better-email-mcp/pull/866),
  [`0dd5eaf`](https://github.com/n24q02m/better-email-mcp/commit/0dd5eaf23e3ce7854a99eb5bb7bfa459600f99a7))

### Testing

- **auth**: Enhance test coverage for subject-context.ts
  ([#807](https://github.com/n24q02m/better-email-mcp/pull/807),
  [`460949f`](https://github.com/n24q02m/better-email-mcp/commit/460949fcb84d2192937d8353f93beb4389efdd28))

- **http**: Improve synchronization in runStartHttpAndTriggerShutdown
  ([#839](https://github.com/n24q02m/better-email-mcp/pull/839),
  [`e448ef1`](https://github.com/n24q02m/better-email-mcp/commit/e448ef1205dfd0058aa6bdb45299b5194b025621))

- **tools**: Add missing error path tests in registry.ts
  ([#840](https://github.com/n24q02m/better-email-mcp/pull/840),
  [`e432047`](https://github.com/n24q02m/better-email-mcp/commit/e4320476031ab7461e67c93ea139f479f1e9cc47))


## v1.32.3-beta.2 (2026-06-10)

### Bug Fixes

- Add Comparison section to README capability matrix
  ([#801](https://github.com/n24q02m/better-email-mcp/pull/801),
  [`873b959`](https://github.com/n24q02m/better-email-mcp/commit/873b959933c463dfe842607935a2d6a16fd04602))

- Correct docs drift in tool count, tool name, env vars, and dead links
  ([#799](https://github.com/n24q02m/better-email-mcp/pull/799),
  [`50e0610`](https://github.com/n24q02m/better-email-mcp/commit/50e06104c3f2d5ec6ffca42da717b148ea26b5be))

- Sync registry test tool surface with actual 7-tool registry
  ([#800](https://github.com/n24q02m/better-email-mcp/pull/800),
  [`32a8e9e`](https://github.com/n24q02m/better-email-mcp/commit/32a8e9e42758c3ed1f722ccbdd3cf615b02f0b0d))


## v1.32.3-beta.1 (2026-06-10)

### Bug Fixes

- **deps**: Update non-major dependencies
  ([#795](https://github.com/n24q02m/better-email-mcp/pull/795),
  [`47077a3`](https://github.com/n24q02m/better-email-mcp/commit/47077a3fe1eeb71091c5a9329eff2175200e6707))

### Chores

- **deps**: Lock file maintenance ([#796](https://github.com/n24q02m/better-email-mcp/pull/796),
  [`08d419c`](https://github.com/n24q02m/better-email-mcp/commit/08d419c443bff7a2dc5a66b7834e12b0fa511240))

- **deps**: Update step-security/harden-runner digest to 9af89fc
  ([#794](https://github.com/n24q02m/better-email-mcp/pull/794),
  [`33e8ea4`](https://github.com/n24q02m/better-email-mcp/commit/33e8ea40098f9dea768d563eddaa41e0aea850cf))


## v1.32.2 (2026-06-09)


## v1.32.2-beta.1 (2026-06-09)

### Bug Fixes

- Gitignore bot/merge junk artifacts (*.orig/*.rej/*.patch/*.diff/*.cover/*.bak)
  ([#761](https://github.com/n24q02m/better-email-mcp/pull/761),
  [`f5c657b`](https://github.com/n24q02m/better-email-mcp/commit/f5c657b44910b28596edb46eedf312fa3eb79db7))

- Invoke markSetupCompleteFn after saving Outlook tokens
  ([#788](https://github.com/n24q02m/better-email-mcp/pull/788),
  [`493e54f`](https://github.com/n24q02m/better-email-mcp/commit/493e54f843aca6b1d1f4abc90446f261ac6bddde))

- **deps**: Update non-major dependencies to ^1.3.7
  ([#789](https://github.com/n24q02m/better-email-mcp/pull/789),
  [`48be382`](https://github.com/n24q02m/better-email-mcp/commit/48be3829d57a4333ae3a266ae8ec06dcf9be57f7))

### Chores

- **deps**: Lock file maintenance ([#790](https://github.com/n24q02m/better-email-mcp/pull/790),
  [`64d8923`](https://github.com/n24q02m/better-email-mcp/commit/64d89236beae5d61aa23cfdfbf89bcf1d98a3763))

- **deps**: Update codecov/codecov-action action to v7
  ([#763](https://github.com/n24q02m/better-email-mcp/pull/763),
  [`3749985`](https://github.com/n24q02m/better-email-mcp/commit/3749985b9421210a8a5740937cb27c0045044de1))


## v1.32.1 (2026-06-07)

### Bug Fixes

- Bump @n24q02m/mcp-core to 1.17.3 ([#760](https://github.com/n24q02m/better-email-mcp/pull/760),
  [`69044a9`](https://github.com/n24q02m/better-email-mcp/commit/69044a944e27839215b2ef93ef447b369698e2a0))


## v1.32.0 (2026-06-07)


## v1.32.0-beta.1 (2026-06-07)

### Bug Fixes

- Add setSetupUrl edge-case tests
  ([`7e3980e`](https://github.com/n24q02m/better-email-mcp/commit/7e3980e3a284cdef598233e35686ef4fc524510b))

- Add subject-context store-restoration error tests
  ([`13f6a7d`](https://github.com/n24q02m/better-email-mcp/commit/13f6a7dbcb304fd080a7b904dbc9c83147156f68))

- **deps**: Lock file maintenance
  ([`78f49c9`](https://github.com/n24q02m/better-email-mcp/commit/78f49c9da09210da67a45e71b2baf6842f605dac))

- **deps**: Update actions/checkout digest to df4cb1c
  ([`92efd81`](https://github.com/n24q02m/better-email-mcp/commit/92efd818148fb2829db5bbbbe60d4a3e4771d38b))

- **deps**: Update non-major dependencies
  ([`4114e1a`](https://github.com/n24q02m/better-email-mcp/commit/4114e1a55d88962dd38cfba15753faf79b23e52e))

### Features

- Add registry error-path coverage tests
  ([`232b50a`](https://github.com/n24q02m/better-email-mcp/commit/232b50af66410bf4514d748b16722db16240b5d4))


## v1.31.3 (2026-06-01)

### Bug Fixes

- Pin mcp-core 1.17.2 (stable)
  ([`3a6e2ac`](https://github.com/n24q02m/better-email-mcp/commit/3a6e2ac9d9b3230775419f0a9b91f8dfe626bc94))


## v1.31.3-beta.1 (2026-06-01)

### Bug Fixes

- Bump mcp-core to 1.17.2-beta.1 for beta testing
  ([`a61fb9f`](https://github.com/n24q02m/better-email-mcp/commit/a61fb9f6b5ec5bb68418a58a933e7f8d0964d574))

- Repoint dead docs/setup-manual.md link to hosted setup guide
  ([#676](https://github.com/n24q02m/better-email-mcp/pull/676),
  [`e142882`](https://github.com/n24q02m/better-email-mcp/commit/e14288229a66b887293a88166745aa01c03bd375))

- Sync docs with current code (env vars, modes, file structure)
  ([#675](https://github.com/n24q02m/better-email-mcp/pull/675),
  [`9024d8e`](https://github.com/n24q02m/better-email-mcp/commit/9024d8e9bad686abdbbb86d5014499ecf5c3364f))

- Update non-major dependencies ([#668](https://github.com/n24q02m/better-email-mcp/pull/668),
  [`e66c19e`](https://github.com/n24q02m/better-email-mcp/commit/e66c19e76d0f00d879258930fc69dc13ca5fbf8e))


## v1.31.2 (2026-05-29)

### Bug Fixes

- Pin mcp-core 1.17.1 (BearerMCPApp resource_metadata #260)
  ([`81defe5`](https://github.com/n24q02m/better-email-mcp/commit/81defe5d81ffbac007fe8a00bf7bc59fae4a09ea))


## v1.31.1 (2026-05-29)

### Bug Fixes

- Pin mcp-core 1.17.0 (stable OAuth refresh_token)
  ([`9134e6c`](https://github.com/n24q02m/better-email-mcp/commit/9134e6c46ba60143432921117f4676e7f4a1a745))


## v1.31.1-beta.1 (2026-05-29)

### Bug Fixes

- Add clearSentFolderCache tests for imap-client
  ([#642](https://github.com/n24q02m/better-email-mcp/pull/642),
  [`d6d090b`](https://github.com/n24q02m/better-email-mcp/commit/d6d090b7020a97dd728348e444bdee14c8d0b3e8))

- Add registry coverage tests ([#655](https://github.com/n24q02m/better-email-mcp/pull/655),
  [`ae5df41`](https://github.com/n24q02m/better-email-mcp/commit/ae5df417bdfc286a9f2861f875292be9bc79d860))

- Add saveOutlookTokens tests for oauth2 helper
  ([#647](https://github.com/n24q02m/better-email-mcp/pull/647),
  [`18c3426`](https://github.com/n24q02m/better-email-mcp/commit/18c3426f80891dd4318adece3658dd8eda6bd6db))

- Add setSetupUrl tests for credential-state
  ([#637](https://github.com/n24q02m/better-email-mcp/pull/637),
  [`1dc9717`](https://github.com/n24q02m/better-email-mcp/commit/1dc971787ab1a44d3e38f8f6f3123358fa8341be))

- Add subject-context auth scope tests
  ([#638](https://github.com/n24q02m/better-email-mcp/pull/638),
  [`245f7f7`](https://github.com/n24q02m/better-email-mcp/commit/245f7f76bb625a03f8b518b114687b01f50a4e96))

- Bump mcp-core to 1.17.0-beta.1 for OAuth refresh_token
  ([`4613668`](https://github.com/n24q02m/better-email-mcp/commit/4613668a5a57532a98731048075b5d8f1b19f079))

- Lock file maintenance ([#660](https://github.com/n24q02m/better-email-mcp/pull/660),
  [`7194528`](https://github.com/n24q02m/better-email-mcp/commit/7194528a65431753ad76ff1311f59202b1a7d2cc))

- Replace setTimeout with vi.waitFor in http transport tests
  ([#641](https://github.com/n24q02m/better-email-mcp/pull/641),
  [`3a79624`](https://github.com/n24q02m/better-email-mcp/commit/3a796248dcf953363637236029e0bce1588eac2a))

- Update dependency @n24q02m/mcp-core to v1.16.0
  ([#659](https://github.com/n24q02m/better-email-mcp/pull/659),
  [`3979e33`](https://github.com/n24q02m/better-email-mcp/commit/3979e336f5648bf931e2c102032b04b07563014f))

- Use NODE_ENV check for PBKDF2 test-mode iteration downgrade
  ([#640](https://github.com/n24q02m/better-email-mcp/pull/640),
  [`c6cd4a3`](https://github.com/n24q02m/better-email-mcp/commit/c6cd4a32b1326c1248bf5020c578d0b14a9f299b))

- Validate decrypted credential JSON with type guards
  ([#649](https://github.com/n24q02m/better-email-mcp/pull/649),
  [`11650ae`](https://github.com/n24q02m/better-email-mcp/commit/11650ae15d5c537264d7a95426c7fd251bc151bf))

- Validate OAuth token store structure before caching
  ([#646](https://github.com/n24q02m/better-email-mcp/pull/646),
  [`df8d535`](https://github.com/n24q02m/better-email-mcp/commit/df8d53505182b8e729bce815b88f0268ca3e8dfa))


## v1.31.0 (2026-05-28)


## v1.31.0-beta.1 (2026-05-28)

### Bug Fixes

- **deps**: Update non-major dependencies
  ([#630](https://github.com/n24q02m/better-email-mcp/pull/630),
  [`14b0419`](https://github.com/n24q02m/better-email-mcp/commit/14b0419c4b82c79f2f300dca534d7402e23d7c05))

### Chores

- **deps**: Lock file maintenance ([#631](https://github.com/n24q02m/better-email-mcp/pull/631),
  [`2afb05a`](https://github.com/n24q02m/better-email-mcp/commit/2afb05a9aad210f7fc9f06170dba1c0ae32f37de))

### Features

- Add custom SMTP host/port/security to EMAIL_CREDENTIALS format
  ([`da2bb54`](https://github.com/n24q02m/better-email-mcp/commit/da2bb54dea9fbdbc1c83313026ecee04b78b7dd1))

- Add programmatic focus management to dynamic account form
  ([#632](https://github.com/n24q02m/better-email-mcp/pull/632),
  [`13470f7`](https://github.com/n24q02m/better-email-mcp/commit/13470f751106990f1fb3aba62d6b91a8a230a0ef))

### Performance Improvements

- **errors**: Cache bigrams for valid options in findClosestMatch
  ([#633](https://github.com/n24q02m/better-email-mcp/pull/633),
  [`aad8d78`](https://github.com/n24q02m/better-email-mcp/commit/aad8d781274121ebc66f13c3cfc788b3962ac982))


## v1.30.0 (2026-05-26)

### Chores

- **deps**: Lock file maintenance ([#627](https://github.com/n24q02m/better-email-mcp/pull/627),
  [`b1d309f`](https://github.com/n24q02m/better-email-mcp/commit/b1d309fa691f6d9b394c369c6607b27ed3b21cd5))


## v1.30.0-beta.2 (2026-05-25)

### Bug Fixes

- **deps**: Update dependency nodemailer to ^8.0.8
  ([#623](https://github.com/n24q02m/better-email-mcp/pull/623),
  [`ce57c32`](https://github.com/n24q02m/better-email-mcp/commit/ce57c32092eb0428ad011266f12f14625faa9f9f))

### Chores

- **deps**: Update docker/setup-buildx-action digest to d7f5e7f
  ([#621](https://github.com/n24q02m/better-email-mcp/pull/621),
  [`4df737d`](https://github.com/n24q02m/better-email-mcp/commit/4df737d5dcf46b4a19e8744425e00a53873d090c))

- **deps**: Update step-security/harden-runner digest to ab7a940
  ([#622](https://github.com/n24q02m/better-email-mcp/pull/622),
  [`08f8d44`](https://github.com/n24q02m/better-email-mcp/commit/08f8d4498d349fcc0910ae0dd54e8daf0159ccc9))

### Features

- Add MCP_AUTH_DISABLE env flag for deployments behind external auth boundary
  ([`2856e59`](https://github.com/n24q02m/better-email-mcp/commit/2856e598202f1b08b4556bb38984df306c7a44b2))

- Implement inline form validation with accessible feedback
  ([#625](https://github.com/n24q02m/better-email-mcp/pull/625),
  [`bddd02d`](https://github.com/n24q02m/better-email-mcp/commit/bddd02de62e707a6c6bac77a48c743fcd980e365))


## v1.30.0-beta.1 (2026-05-24)

### Bug Fixes

- **a11y**: Lock entire credential form via fieldset during submission
  ([#611](https://github.com/n24q02m/better-email-mcp/pull/611),
  [`0888049`](https://github.com/n24q02m/better-email-mcp/commit/0888049ae2ea9a979911afc0ea085cbb5a8acb28))

- **deps**: Refresh lock file maintenance
  ([#577](https://github.com/n24q02m/better-email-mcp/pull/577),
  [`235e030`](https://github.com/n24q02m/better-email-mcp/commit/235e0303e4cec0596c4a485b73870a613cf4479b))

- **deps**: Update non-major dependencies
  ([#581](https://github.com/n24q02m/better-email-mcp/pull/581),
  [`f00354a`](https://github.com/n24q02m/better-email-mcp/commit/f00354a08e01215ef72d789c1588c9d327bba0b1))

- **security**: Add Content-Security-Policy to credential form
  ([#612](https://github.com/n24q02m/better-email-mcp/pull/612),
  [`f40b1b0`](https://github.com/n24q02m/better-email-mcp/commit/f40b1b0a5ff2e0fca093dfa8e9884fb45942facf))

- **security**: JSON-encode submitUrl in credential form to prevent script injection
  ([#607](https://github.com/n24q02m/better-email-mcp/pull/607),
  [`f08e627`](https://github.com/n24q02m/better-email-mcp/commit/f08e627baa90cd5d6a1f942fbaba1ecc509c91f1))

### Chores

- **deps**: Update actions/create-github-app-token digest to bcd2ba4
  ([#589](https://github.com/n24q02m/better-email-mcp/pull/589),
  [`35f33cd`](https://github.com/n24q02m/better-email-mcp/commit/35f33cd8144c32de75d82645139c4a10007f4060))

- **deps**: Update actions/dependency-review-action action to v5
  ([#578](https://github.com/n24q02m/better-email-mcp/pull/578),
  [`69c0f88`](https://github.com/n24q02m/better-email-mcp/commit/69c0f88cf06a383a2f92f74bd562fcd3a524e323))

- **deps**: Update codecov/codecov-action digest to e79a696
  ([#616](https://github.com/n24q02m/better-email-mcp/pull/616),
  [`535f405`](https://github.com/n24q02m/better-email-mcp/commit/535f40578efd69f52223d58f9e2a51795e0825ae))

- **deps**: Update docker/build-push-action digest to f9f3042
  ([#617](https://github.com/n24q02m/better-email-mcp/pull/617),
  [`c2a2c46`](https://github.com/n24q02m/better-email-mcp/commit/c2a2c46e1b2dc6a2f3a1b97fac6399526dac8eb0))

- **deps**: Update docker/login-action digest to 650006c
  ([#618](https://github.com/n24q02m/better-email-mcp/pull/618),
  [`11cc711`](https://github.com/n24q02m/better-email-mcp/commit/11cc711a7b58026ffc8df9ee5ba1d6e877680d62))

- **deps**: Update oven/bun:1-alpine docker digest to 5acc90a
  ([#590](https://github.com/n24q02m/better-email-mcp/pull/590),
  [`a915e98`](https://github.com/n24q02m/better-email-mcp/commit/a915e9860f7cb81d2ed28f5a2bb36cc343add00f))

### Features

- Support localhost and custom IMAP port in credentials
  ([#615](https://github.com/n24q02m/better-email-mcp/pull/615),
  [`32952e8`](https://github.com/n24q02m/better-email-mcp/commit/32952e8d022cc941205968f3d6ac339adc0a310c))


## v1.29.0 (2026-05-09)


## v1.29.0-beta.1 (2026-05-08)

### Bug Fixes

- Assert pollIntervalMs in outlook-device-code test
  ([`1a5d36a`](https://github.com/n24q02m/better-email-mcp/commit/1a5d36a857a0a1b99668fdaa3640724c9e4236ad))

- Collapse createFieldGroup positional args into options object
  ([`2868ead`](https://github.com/n24q02m/better-email-mcp/commit/2868ead1d851ab67c9b895be012cb7615e567fe8))

- Cover loadStoredTokens fallback when readFile rejects with non-ENOENT
  ([`a36b9a2`](https://github.com/n24q02m/better-email-mcp/commit/a36b9a20d868c9ff88d0202a59339e8def74e8db))

- Early returns in credential-form fetch handler
  ([`179e12d`](https://github.com/n24q02m/better-email-mcp/commit/179e12da72636008d2e81dd6a2837a584b443c29))

- Extract parseSingleCredential helpers
  ([`4afcfb7`](https://github.com/n24q02m/better-email-mcp/commit/4afcfb7c10ac3826d210eb83652c80169f666c3e))

- Improve password manager support and form semantics
  ([`7c3ef21`](https://github.com/n24q02m/better-email-mcp/commit/7c3ef21534287eca02be2add0fa4ac76b146d03f))

- Limit snippet extraction concurrency to avoid event loop blocking
  ([`c0f5e7a`](https://github.com/n24q02m/better-email-mcp/commit/c0f5e7ab7e4592357f0ff96e6d4592a2a7912938))

- Replace any with unknown in catch blocks
  ([`866e620`](https://github.com/n24q02m/better-email-mcp/commit/866e6201ac23035bb96e7d3607b36f02d8f823d0))

- Replace for-loop with .some() in isArchiveFolder
  ([`9456288`](https://github.com/n24q02m/better-email-mcp/commit/9456288d7902925d25bda2bc14a7c952cef2e439))

- Type buildSearchCriteria with imapflow SearchObject
  ([`d9f7bf8`](https://github.com/n24q02m/better-email-mcp/commit/d9f7bf80aa0ffd7c5b27f90a6b196aa8c36243be))

- Type sanitizeErrorDetails details param as unknown
  ([`7192993`](https://github.com/n24q02m/better-email-mcp/commit/7192993cf4800a69aa870cf0dbd0be52d3037084))

- Update setup-manual.md refs in error messages to mcp.n24q02m.com
  ([`58af370`](https://github.com/n24q02m/better-email-mcp/commit/58af3708355db8eb19c54725fec7c35788f5d6c4))

- **deps**: Lock file maintenance
  ([`3dc4677`](https://github.com/n24q02m/better-email-mcp/commit/3dc467779a1fdbecb3c0e0e34c32ce7acd4fc072))

- **deps**: Update non-major dependencies
  ([`2c3ace5`](https://github.com/n24q02m/better-email-mcp/commit/2c3ace58497c1adb20d30f6a1074a8d21b3bc824))

### Features

- Add Table of contents heading + auto-generated link list (Spec E Wave 2)
  ([`7040ea0`](https://github.com/n24q02m/better-email-mcp/commit/7040ea0e008e09425861f98087d688df4f502740))

- Link to mcp.n24q02m.com unified docs site (Spec F Phase 4)
  ([`aff43c2`](https://github.com/n24q02m/better-email-mcp/commit/aff43c26e5a2bfcd511630b9dba19f932ccc7b0c))

- Sync cross-promo section ([#576](https://github.com/n24q02m/better-email-mcp/pull/576),
  [`f6f3eb2`](https://github.com/n24q02m/better-email-mcp/commit/f6f3eb262c90595c563932e04cc8a8066aedf837))


## v1.28.0 (2026-05-06)

### Bug Fixes

- Remove redundant TRANSPORT_MODE=http baked into Dockerfile http target
  ([`785b93b`](https://github.com/n24q02m/better-email-mcp/commit/785b93b649d70b47f3c3fa3a6a91decda5244624))


## v1.28.0-beta.1 (2026-05-06)

### Bug Fixes

- Consolidate setup docs body to 3 methods (drop legacy Method 4/5)
  ([#548](https://github.com/n24q02m/better-email-mcp/pull/548),
  [`17b4eee`](https://github.com/n24q02m/better-email-mcp/commit/17b4eee26b4323e31dba5fed570834f4b9955e71))

- **deps**: Update non-major dependencies
  ([#535](https://github.com/n24q02m/better-email-mcp/pull/535),
  [`73dada6`](https://github.com/n24q02m/better-email-mcp/commit/73dada6368756a7da397da80c0116494adfc8af6))

### Chores

- **deps**: Lock file maintenance ([#536](https://github.com/n24q02m/better-email-mcp/pull/536),
  [`ff3359d`](https://github.com/n24q02m/better-email-mcp/commit/ff3359d0ae9bdfb9dbd6ea703cc776cf049e4de7))

- **deps**: Update step-security/harden-runner digest to a5ad31d
  ([#534](https://github.com/n24q02m/better-email-mcp/pull/534),
  [`f1ee162`](https://github.com/n24q02m/better-email-mcp/commit/f1ee162782c3a9d71a9ad7e7097531311bfc72a3))

### Features

- Add explicit Method overview section to setup docs
  ([#547](https://github.com/n24q02m/better-email-mcp/pull/547),
  [`645a6be`](https://github.com/n24q02m/better-email-mcp/commit/645a6be5cf84d4796f3bb1ea3a23c461ed4bb628))

- Clarify Method 1/2/3 mutually exclusive (CC scope-by-endpoint)
  ([#552](https://github.com/n24q02m/better-email-mcp/pull/552),
  [`c901beb`](https://github.com/n24q02m/better-email-mcp/commit/c901bebeff8cbbd3f8e95d33e0216ae2f40e63e3))

- Declare userConfig schema and document install prompt
  ([#549](https://github.com/n24q02m/better-email-mcp/pull/549),
  [`64f6d22`](https://github.com/n24q02m/better-email-mcp/commit/64f6d227f6860ae0259b64e7edd3efc7b5b28c01))

- Document userConfig credential prompts per plugin
  ([#551](https://github.com/n24q02m/better-email-mcp/pull/551),
  [`aac3638`](https://github.com/n24q02m/better-email-mcp/commit/aac3638c06d91f1c1de417803a88662b9b2b41c7))


## v1.27.0 (2026-05-04)

### Bug Fixes

- Bump mcp-core to 1.13.0 (STABLE) ([#546](https://github.com/n24q02m/better-email-mcp/pull/546),
  [`e444eab`](https://github.com/n24q02m/better-email-mcp/commit/e444eab0d8180cf74968c274885838718f3af785))


## v1.27.0-beta.7 (2026-05-03)

### Bug Fixes

- Bump mcp-core to 1.13.0-beta.9 for /login form shell refactor
  ([#543](https://github.com/n24q02m/better-email-mcp/pull/543),
  [`2d45c9f`](https://github.com/n24q02m/better-email-mcp/commit/2d45c9f90dff763ce8171f8919312a84689c411b))


## v1.27.0-beta.6 (2026-05-03)

### Bug Fixes

- Wire setup_complete_hook for outlook device-code OAuth
  ([#542](https://github.com/n24q02m/better-email-mcp/pull/542),
  [`be37f3f`](https://github.com/n24q02m/better-email-mcp/commit/be37f3fc5a7060d3b15d1c5683a6050d5e927c15))


## v1.27.0-beta.5 (2026-05-03)

### Features

- Bump mcp-core to 1.13.0-beta.7 ([#541](https://github.com/n24q02m/better-email-mcp/pull/541),
  [`6274bae`](https://github.com/n24q02m/better-email-mcp/commit/6274baedeb913b52efbc47afdc9cdcf8f51f5f4d))

- Document MCP_RELAY_PASSWORD edge auth gate
  ([#540](https://github.com/n24q02m/better-email-mcp/pull/540),
  [`10aad3d`](https://github.com/n24q02m/better-email-mcp/commit/10aad3d2b74c1cf8775bc56921c572f391ca68df))

- Pass MCP_RELAY_PASSWORD env to HTTP container
  ([#539](https://github.com/n24q02m/better-email-mcp/pull/539),
  [`c7d61ac`](https://github.com/n24q02m/better-email-mcp/commit/c7d61ac090748cc9faf1b77a6c9915dfc1bc2f6c))


## v1.27.0-beta.4 (2026-05-02)

### Bug Fixes

- Trigger PSR to publish em's stdio missing-cred handler fix
  ([`77a7ebf`](https://github.com/n24q02m/better-email-mcp/commit/77a7ebf33bfae75a82efd04106c44d0b3bc28b00))


## v1.27.0-beta.3 (2026-05-02)

### Bug Fixes

- Setup docs + README reflect stdio-pure architecture
  ([#532](https://github.com/n24q02m/better-email-mcp/pull/532),
  [`e378ad5`](https://github.com/n24q02m/better-email-mcp/commit/e378ad503a9df9070f4b67e04d093eb995edaf4f))

- **deps**: Update dependency html-to-text to v10
  ([#525](https://github.com/n24q02m/better-email-mcp/pull/525),
  [`d504be9`](https://github.com/n24q02m/better-email-mcp/commit/d504be927069a0d078ef775e6146e1f0dd1f6ead))

### Chores

- **deps**: Lock file maintenance ([#519](https://github.com/n24q02m/better-email-mcp/pull/519),
  [`f1a94dd`](https://github.com/n24q02m/better-email-mcp/commit/f1a94ddacff010f8993601ce09077d255dbd250a))

- **deps**: Update dawidd6/action-send-mail action to v17
  ([#518](https://github.com/n24q02m/better-email-mcp/pull/518),
  [`279fdb7`](https://github.com/n24q02m/better-email-mcp/commit/279fdb76c70231906977da92df5da3bff50e2f71))

### Features

- Stdio-pure + http-multi-user (drop daemon-bridge)
  ([#531](https://github.com/n24q02m/better-email-mcp/pull/531),
  [`ba6bb5a`](https://github.com/n24q02m/better-email-mcp/commit/ba6bb5a1ac764e9346f26c1ab0fd9e28a8c3afbc))


## v1.27.0-beta.2 (2026-04-30)

### Bug Fixes

- Move stdio-direct test to tests/live (requires build artifact)
  ([#523](https://github.com/n24q02m/better-email-mcp/pull/523),
  [`a5e50f8`](https://github.com/n24q02m/better-email-mcp/commit/a5e50f8996d6a9da162e98f29615c0c3a0f20989))

### Features

- Route stdio mode to MCP SDK direct + multi-target Dockerfile
  ([#523](https://github.com/n24q02m/better-email-mcp/pull/523),
  [`a5e50f8`](https://github.com/n24q02m/better-email-mcp/commit/a5e50f8996d6a9da162e98f29615c0c3a0f20989))

- **auth**: Migrate to in-memory cred store (TC-NearZK)
  ([#524](https://github.com/n24q02m/better-email-mcp/pull/524),
  [`b30e645`](https://github.com/n24q02m/better-email-mcp/commit/b30e6458fb794c3441b37005cb99bd2b91dc8bf3))

- **docs**: Add trust model section to README
  ([#523](https://github.com/n24q02m/better-email-mcp/pull/523),
  [`a5e50f8`](https://github.com/n24q02m/better-email-mcp/commit/a5e50f8996d6a9da162e98f29615c0c3a0f20989))


## v1.27.0-beta.1 (2026-04-30)

### Bug Fixes

- Move stdio-direct test to tests/live (requires build artifact)
  ([#521](https://github.com/n24q02m/better-email-mcp/pull/521),
  [`b269ec7`](https://github.com/n24q02m/better-email-mcp/commit/b269ec7d69c2d2112043cb0c792f623748076c23))

### Features

- Route stdio mode to FastMCP/MCP SDK direct + multi-target Dockerfile
  ([#521](https://github.com/n24q02m/better-email-mcp/pull/521),
  [`b269ec7`](https://github.com/n24q02m/better-email-mcp/commit/b269ec7d69c2d2112043cb0c792f623748076c23))

- Route stdio mode to MCP SDK direct + multi-target Dockerfile
  ([#521](https://github.com/n24q02m/better-email-mcp/pull/521),
  [`b269ec7`](https://github.com/n24q02m/better-email-mcp/commit/b269ec7d69c2d2112043cb0c792f623748076c23))


## v1.26.3 (2026-04-29)

### Bug Fixes

- Rebuild against mcp-core 1.11.5 fork-bomb fix
  ([#514](https://github.com/n24q02m/better-email-mcp/pull/514),
  [`a6a7020`](https://github.com/n24q02m/better-email-mcp/commit/a6a70206156c7cab1e4b20a977d98f2e306cb032))


## v1.26.2 (2026-04-29)


## v1.26.2-beta.1 (2026-04-29)

### Bug Fixes

- Revert eagerRelaySchema usage (D18 rollback)
  ([#511](https://github.com/n24q02m/better-email-mcp/pull/511),
  [`ea99137`](https://github.com/n24q02m/better-email-mcp/commit/ea99137f232aea53f0aa6f2420b75dd0d412251d))


## v1.26.1 (2026-04-29)

### Bug Fixes

- Pass RELAY_SCHEMA as eagerRelaySchema for stdio mode + bump mcp-core to 1.11.3
  ([#510](https://github.com/n24q02m/better-email-mcp/pull/510),
  [`3b930e7`](https://github.com/n24q02m/better-email-mcp/commit/3b930e7df458e6af722f526f7ffc9835ef66fbd6))

- Pin @latest in plugin.json to bypass npx cache stale versions
  ([#508](https://github.com/n24q02m/better-email-mcp/pull/508),
  [`a81adb6`](https://github.com/n24q02m/better-email-mcp/commit/a81adb6de758ee843dcebcf20aada739d9373afb))

- Register config__open_relay tool (Transparent Bridge Wave 3)
  ([#508](https://github.com/n24q02m/better-email-mcp/pull/508),
  [`a81adb6`](https://github.com/n24q02m/better-email-mcp/commit/a81adb6de758ee843dcebcf20aada739d9373afb))


## v1.26.0 (2026-04-29)

### Bug Fixes

- Prevent event loop blocking during IMAP snippet parsing
  ([#501](https://github.com/n24q02m/better-email-mcp/pull/501),
  [`09bb1d8`](https://github.com/n24q02m/better-email-mcp/commit/09bb1d8c92edd827d390fdae01e4b1d9a1af99e1))

- Register config__open_relay tool (Transparent Bridge Wave 3)
  ([#506](https://github.com/n24q02m/better-email-mcp/pull/506),
  [`06a5a1e`](https://github.com/n24q02m/better-email-mcp/commit/06a5a1e6b2113c43b9ff6d1af7a9cbc1d0184f8b))

- Switch plugin.json to stdio proxy for local relay testing
  ([#503](https://github.com/n24q02m/better-email-mcp/pull/503),
  [`f91461b`](https://github.com/n24q02m/better-email-mcp/commit/f91461bac873cbf1f51505e6b1c9d6359f526237))

- **deps**: Bump @n24q02m/mcp-core to 1.10.0 — Transparent Bridge waves 1-3
  ([#503](https://github.com/n24q02m/better-email-mcp/pull/503),
  [`f91461b`](https://github.com/n24q02m/better-email-mcp/commit/f91461bac873cbf1f51505e6b1c9d6359f526237))

### Features

- Add spinner to Connect button ([#502](https://github.com/n24q02m/better-email-mcp/pull/502),
  [`ab82cf3`](https://github.com/n24q02m/better-email-mcp/commit/ab82cf334b6ebf39c5b42f5be73f8452130805d4))


## v1.25.2 (2026-04-28)

### Bug Fixes

- Document MCP_MODE remote-relay vs local-relay in setup docs
  ([#497](https://github.com/n24q02m/better-email-mcp/pull/497),
  [`c688b75`](https://github.com/n24q02m/better-email-mcp/commit/c688b75c4abc9b162b0d34fac5b5d35e6d26beb0))

- Migrate plugin.json to deployed HTTP remote endpoint
  ([#498](https://github.com/n24q02m/better-email-mcp/pull/498),
  [`bac8c05`](https://github.com/n24q02m/better-email-mcp/commit/bac8c05d1842d9493c2e8499ea915b5a16b0f106))

- **deps**: Bump @n24q02m/mcp-core to 1.10.0 — Transparent Bridge waves 1-3
  ([#500](https://github.com/n24q02m/better-email-mcp/pull/500),
  [`922897a`](https://github.com/n24q02m/better-email-mcp/commit/922897acc868a03389799f386aea9075d054d9f5))


## v1.25.1 (2026-04-28)

### Bug Fixes

- Bump @n24q02m/mcp-core to 1.9.0 ([#496](https://github.com/n24q02m/better-email-mcp/pull/496),
  [`1fa7b85`](https://github.com/n24q02m/better-email-mcp/commit/1fa7b851362f8b7cd3956deb0513b1d7e956b901))

- **deps**: Update non-major dependencies
  ([#491](https://github.com/n24q02m/better-email-mcp/pull/491),
  [`a5840c0`](https://github.com/n24q02m/better-email-mcp/commit/a5840c0172dba2894bce3669d5b212739d3285a0))

### Chores

- **deps**: Lock file maintenance ([#492](https://github.com/n24q02m/better-email-mcp/pull/492),
  [`9fc95c4`](https://github.com/n24q02m/better-email-mcp/commit/9fc95c4bbdf3601b373f5dd2cc6d3d031af2bb8a))


## v1.25.0 (2026-04-27)

### Bug Fixes

- Bump @n24q02m/mcp-core to 1.8.0 ([#489](https://github.com/n24q02m/better-email-mcp/pull/489),
  [`26a4f53`](https://github.com/n24q02m/better-email-mcp/commit/26a4f53110ca1daf99d06efe0a07ad98b47d3972))

- **deps**: Update non-major dependencies
  ([#481](https://github.com/n24q02m/better-email-mcp/pull/481),
  [`e8baad0`](https://github.com/n24q02m/better-email-mcp/commit/e8baad035680e9d72d63718848b4597bae6e4a63))

### Chores

- **deps**: Lock file maintenance ([#482](https://github.com/n24q02m/better-email-mcp/pull/482),
  [`496b33e`](https://github.com/n24q02m/better-email-mcp/commit/496b33ecf0a476adf2bb834229a893ce75b118fc))

### Features

- Accept optional prefill kwarg in renderEmailCredentialForm
  ([#487](https://github.com/n24q02m/better-email-mcp/pull/487),
  [`a16b456`](https://github.com/n24q02m/better-email-mcp/commit/a16b4565744aa043c6f224b7f0397e4689a17015))

- Add ## E2E section to CLAUDE.md per Task 21 docs rollout
  ([#487](https://github.com/n24q02m/better-email-mcp/pull/487),
  [`a16b456`](https://github.com/n24q02m/better-email-mcp/commit/a16b4565744aa043c6f224b7f0397e4689a17015))

- Add ## E2E section to CLAUDE.md per Task 21 docs rollout
  ([#486](https://github.com/n24q02m/better-email-mcp/pull/486),
  [`ce09662`](https://github.com/n24q02m/better-email-mcp/commit/ce09662b0b81c4ec9da0974b6c8b3c54013a2df1))


## v1.24.1-beta.1 (2026-04-27)

### Bug Fixes

- Bump @n24q02m/mcp-core to 1.8.0-beta.1 for /mcp session-routing fix
  ([`f2cab0f`](https://github.com/n24q02m/better-email-mcp/commit/f2cab0f094c056fee422f22b26082e8083e01cd0))

- Sweep doppler/infisical refs to skret SSM
  ([`dcaaddf`](https://github.com/n24q02m/better-email-mcp/commit/dcaaddfe7b778b24ca014d69b2268d9d22b4fba4))


## v1.24.0 (2026-04-24)

### Bug Fixes

- Bump @n24q02m/mcp-core to 1.7.5 ([#477](https://github.com/n24q02m/better-email-mcp/pull/477),
  [`9d6e46c`](https://github.com/n24q02m/better-email-mcp/commit/9d6e46c8e9b8dc284d98b0462de47e05c832e042))

- Bump @n24q02m/mcp-core to 1.7.6 ([#480](https://github.com/n24q02m/better-email-mcp/pull/480),
  [`142e05d`](https://github.com/n24q02m/better-email-mcp/commit/142e05da618d203f3029cd45770169d46839adf8))

- Bump @n24q02m/mcp-core to ^1.7.0 for transport subpath export
  ([#471](https://github.com/n24q02m/better-email-mcp/pull/471),
  [`7f7fa66`](https://github.com/n24q02m/better-email-mcp/commit/7f7fa6679aa3497c176e3ee70214f27fe0070ba0))

- Force fresh device-code flow on every form submit (ignore cached tokens)
  ([#478](https://github.com/n24q02m/better-email-mcp/pull/478),
  [`4d622dd`](https://github.com/n24q02m/better-email-mcp/commit/4d622dd464241b0905860e150174d5d348247936))

### Chores

- **deps**: Lock file maintenance ([#465](https://github.com/n24q02m/better-email-mcp/pull/465),
  [`381fec1`](https://github.com/n24q02m/better-email-mcp/commit/381fec1d5b877c901ff0035200ce7e59a46e38e9))

### Features

- Migrate stdio transport to 1-Daemon architecture (runSmartStdioProxy)
  ([`3934df4`](https://github.com/n24q02m/better-email-mcp/commit/3934df43c4fd0ba44c539a323bb81e37858dc104))

### Performance Improvements

- Optimize fuzzy matching loop invariant
  ([#468](https://github.com/n24q02m/better-email-mcp/pull/468),
  [`eacdbfd`](https://github.com/n24q02m/better-email-mcp/commit/eacdbfd2e0690214d2f4bb8b0f6385492d428b3d))


## v1.23.9 (2026-04-22)

### Bug Fixes

- Follow redirect_url after async device-code completion
  ([#464](https://github.com/n24q02m/better-email-mcp/pull/464),
  [`39417fd`](https://github.com/n24q02m/better-email-mcp/commit/39417fd95d1ebaea8e8cf0ebee62bc2b16755bc9))


## v1.23.8 (2026-04-22)

### Bug Fixes

- Bump @n24q02m/mcp-core to 1.6.3 (relay form follow redirect_url)
  ([#463](https://github.com/n24q02m/better-email-mcp/pull/463),
  [`81732f3`](https://github.com/n24q02m/better-email-mcp/commit/81732f30c40b539013b54fa440b17b13bca64f33))


## v1.23.7 (2026-04-22)

### Bug Fixes

- Bump mcp-core to 1.6.2 ([#461](https://github.com/n24q02m/better-email-mcp/pull/461),
  [`92c90bb`](https://github.com/n24q02m/better-email-mcp/commit/92c90bb50fbf70d6db38b4a7a0e6c36e11ff664c))


## v1.23.6 (2026-04-22)

### Bug Fixes

- Bump @n24q02m/mcp-core to 1.5.1
  ([`4502912`](https://github.com/n24q02m/better-email-mcp/commit/450291227428327a27ccd9baaad56fe77fc1bfee))

- Bump @n24q02m/mcp-core to 1.6.1 ([#459](https://github.com/n24q02m/better-email-mcp/pull/459),
  [`bcb101f`](https://github.com/n24q02m/better-email-mcp/commit/bcb101f5588b2ba813c5afb380e38f40d9f8a567))

- Refresh bun.lock for mcp-core 1.5.1 bump
  ([`8d406dd`](https://github.com/n24q02m/better-email-mcp/commit/8d406dd3da5292a3782d920dc0eb2eb1fe2d65e8))

- Remove stale package-lock.json blocking frozen bun install
  ([#459](https://github.com/n24q02m/better-email-mcp/pull/459),
  [`bcb101f`](https://github.com/n24q02m/better-email-mcp/commit/bcb101f5588b2ba813c5afb380e38f40d9f8a567))

### Chores

- **deps**: Lock file maintenance ([#455](https://github.com/n24q02m/better-email-mcp/pull/455),
  [`718c78b`](https://github.com/n24q02m/better-email-mcp/commit/718c78b305fa66d8e50ba4e84e8e90d8b53e3937))

- **deps**: Update non-major dependencies to ^4.1.5
  ([#454](https://github.com/n24q02m/better-email-mcp/pull/454),
  [`cbdc837`](https://github.com/n24q02m/better-email-mcp/commit/cbdc837bba8ea9e0699736a6a67731ed323908d3))


## v1.23.5 (2026-04-21)

### Bug Fixes

- Bump actions/setup-node digest to 48b55a0
  ([`e8cc103`](https://github.com/n24q02m/better-email-mcp/commit/e8cc103a306fd3de079ad0bed61de41b8bf098c3))

- Bump oven/bun:1-alpine docker digest to 4de4753
  ([`dadc5c6`](https://github.com/n24q02m/better-email-mcp/commit/dadc5c676232e070a8baaa048b8b7daa20359b97))

- Bump step-security/harden-runner digest to 8d3c67d
  ([`164c855`](https://github.com/n24q02m/better-email-mcp/commit/164c855e6659ed73f76ea5bebb4f421fad145e88))


## v1.23.4 (2026-04-21)

### Bug Fixes

- **deps**: Bump @n24q02m/mcp-core to ^1.5.0 for SubjectContext export
  ([`47d9a11`](https://github.com/n24q02m/better-email-mcp/commit/47d9a1170bebd0e3c4b2cfdbbf325427fc7f4c87))


## v1.23.3 (2026-04-21)

### Bug Fixes

- Improve credential form a11y (focus-visible + h2/h3 semantics + aria-busy)
  ([`378f410`](https://github.com/n24q02m/better-email-mcp/commit/378f410a44ecf31e5af618cdf4eecf1cea62eb3e))

- Isolate remote-relay credentials per JWT sub (prevents public-URL leak)
  ([`5355c34`](https://github.com/n24q02m/better-email-mcp/commit/5355c340e74b0e4aecf54a0424d0aa4c0dd2053d))

- Remove AI traces (.jules / superpowers content — belongs in private n24q02m/.superpower repo)
  ([`002ec18`](https://github.com/n24q02m/better-email-mcp/commit/002ec18893cf2757bdf6ccb929e5fa74acc1d788))

- Stdio fallback renders multi-account credential form (UI parity)
  ([`6e099c1`](https://github.com/n24q02m/better-email-mcp/commit/6e099c17c84f03ba23719cc4fa1a5fbcc8eb6141))

- Stdio fallback spawns local HTTP, never hits remote URL
  ([`ecaf207`](https://github.com/n24q02m/better-email-mcp/commit/ecaf207c27b8913cc7a1fa570695873b38dd5d01))

- Use notifyComplete helper to avoid relay DELETE race
  ([`018630e`](https://github.com/n24q02m/better-email-mcp/commit/018630e2386ab50d1f2ca0c90da46d02c06ee9e1))

- **deps**: Bump mcp-core to 1.4.3
  ([`7c8df7b`](https://github.com/n24q02m/better-email-mcp/commit/7c8df7bbe5ddd32b4429879dd83d078e7a272521))

- **deps**: Lock file maintenance (eventsource-parser 3.0.7->3.0.8)
  ([`3b21de4`](https://github.com/n24q02m/better-email-mcp/commit/3b21de41ffafb6ae9fc831559f7dd5ef01975346))


## v1.23.2 (2026-04-20)

### Bug Fixes

- Unify local-relay + remote-relay UI/flow parity
  ([#444](https://github.com/n24q02m/better-email-mcp/pull/444),
  [`174b0d7`](https://github.com/n24q02m/better-email-mcp/commit/174b0d7802b3fb451d2e49345906747dac85af86))


## v1.23.1 (2026-04-20)

### Bug Fixes

- Bump @n24q02m/mcp-core to ^1.4.1 ([#442](https://github.com/n24q02m/better-email-mcp/pull/442),
  [`7ac9125`](https://github.com/n24q02m/better-email-mcp/commit/7ac9125670210c19687e4e1f0950c70cf3bce666))


## v1.23.0 (2026-04-19)

### Bug Fixes

- Achieve 100% coverage for per-user-credential-store.ts
  ([#384](https://github.com/n24q02m/better-email-mcp/pull/384),
  [`837d59f`](https://github.com/n24q02m/better-email-mcp/commit/837d59f83efc6f43660edf2a55817fcdadbee28e))

- Add explicit type annotation for setupCompleteHook
  ([#438](https://github.com/n24q02m/better-email-mcp/pull/438),
  [`6f538e1`](https://github.com/n24q02m/better-email-mcp/commit/6f538e1dccf418e75000d36c8eb8de4c269544bf))

- Bump n24q02m-mcp-core to 1.4.0 ([#438](https://github.com/n24q02m/better-email-mcp/pull/438),
  [`6f538e1`](https://github.com/n24q02m/better-email-mcp/commit/6f538e1dccf418e75000d36c8eb8de4c269544bf))

- Mask credential inputs in relay schema
  ([#398](https://github.com/n24q02m/better-email-mcp/pull/398),
  [`37deda1`](https://github.com/n24q02m/better-email-mcp/commit/37deda1a490fd9ff29a14dff7b89973348d1974f))

- Refactor long function startHttp into helpers
  ([#411](https://github.com/n24q02m/better-email-mcp/pull/411),
  [`73a51c7`](https://github.com/n24q02m/better-email-mcp/commit/73a51c7342cd97eb8769209869d48827dc9b4dd6))

- **deps**: Update non-major dependencies
  ([#429](https://github.com/n24q02m/better-email-mcp/pull/429),
  [`69ca279`](https://github.com/n24q02m/better-email-mcp/commit/69ca279db646cfdf161f37d5261209a6f8d94e1a))

### Chores

- **deps**: Lock file maintenance ([#435](https://github.com/n24q02m/better-email-mcp/pull/435),
  [`792f12d`](https://github.com/n24q02m/better-email-mcp/commit/792f12d86455df0090e10a6bf1a0f8408896a637))

- **deps**: Lock file maintenance ([#430](https://github.com/n24q02m/better-email-mcp/pull/430),
  [`710e8c7`](https://github.com/n24q02m/better-email-mcp/commit/710e8c7012c50ef4ee2d25589b05e6c1514ab5c1))

### Performance Improvements

- **http**: Parallelize IMAP connection validations
  ([#416](https://github.com/n24q02m/better-email-mcp/pull/416),
  [`fc838e5`](https://github.com/n24q02m/better-email-mcp/commit/fc838e526cf66e4d4f0ac39341550ea1f9c1b549))

### Refactoring

- **config**: Extract parseSingleCredential and fix lint
  ([#413](https://github.com/n24q02m/better-email-mcp/pull/413),
  [`a778c5b`](https://github.com/n24q02m/better-email-mcp/commit/a778c5bf8218d3abc0fe1865828ba0a28172849f))

- **config**: Extract parseSingleCredential from parseCredentials
  ([#413](https://github.com/n24q02m/better-email-mcp/pull/413),
  [`a778c5b`](https://github.com/n24q02m/better-email-mcp/commit/a778c5bf8218d3abc0fe1865828ba0a28172849f))


## v1.23.0-beta.1 (2026-04-18)

### Bug Fixes

- Bump @n24q02m/mcp-core to ^1.3.0 (delegated OAuth primitives released)
  ([#433](https://github.com/n24q02m/better-email-mcp/pull/433),
  [`c900c95`](https://github.com/n24q02m/better-email-mcp/commit/c900c95ba449241973f4365fa6659fc36da7a0d0))

- Document Phase L2 mode restoration in email CLAUDE.md
  ([#433](https://github.com/n24q02m/better-email-mcp/pull/433),
  [`c900c95`](https://github.com/n24q02m/better-email-mcp/commit/c900c95ba449241973f4365fa6659fc36da7a0d0))

- Pin mcp-core to file: for Phase L2 delegated OAuth development
  ([#433](https://github.com/n24q02m/better-email-mcp/pull/433),
  [`c900c95`](https://github.com/n24q02m/better-email-mcp/commit/c900c95ba449241973f4365fa6659fc36da7a0d0))

- Remove dead setup.ts after rename to config.ts
  ([#433](https://github.com/n24q02m/better-email-mcp/pull/433),
  [`c900c95`](https://github.com/n24q02m/better-email-mcp/commit/c900c95ba449241973f4365fa6659fc36da7a0d0))

- Remove outdated comment referencing mcp-relay-core
  ([#412](https://github.com/n24q02m/better-email-mcp/pull/412),
  [`a518aa0`](https://github.com/n24q02m/better-email-mcp/commit/a518aa0ca2713b8d03e2e81786f2fb14eeeee8dd))

- Use bundled Outlook client ID by default (OUTLOOK_CLIENT_ID optional)
  ([#433](https://github.com/n24q02m/better-email-mcp/pull/433),
  [`c900c95`](https://github.com/n24q02m/better-email-mcp/commit/c900c95ba449241973f4365fa6659fc36da7a0d0))

- **oauth2**: Update deprecated basic auth comment
  ([#417](https://github.com/n24q02m/better-email-mcp/pull/417),
  [`0ca461a`](https://github.com/n24q02m/better-email-mcp/commit/0ca461a46acb394d2289c45d8e00f9113ebdcb05))

### Documentation

- **credential-form**: Replace dummy nonce placeholder
  ([#410](https://github.com/n24q02m/better-email-mcp/pull/410),
  [`2feb430`](https://github.com/n24q02m/better-email-mcp/commit/2feb430c855f1876e38d8a403195f10e487d2c1d))

### Features

- Rename setup tool to config with unified action set
  ([#433](https://github.com/n24q02m/better-email-mcp/pull/433),
  [`c900c95`](https://github.com/n24q02m/better-email-mcp/commit/c900c95ba449241973f4365fa6659fc36da7a0d0))

- Restore email remote-relay default with Outlook delegated device code
  ([#433](https://github.com/n24q02m/better-email-mcp/pull/433),
  [`c900c95`](https://github.com/n24q02m/better-email-mcp/commit/c900c95ba449241973f4365fa6659fc36da7a0d0))

- Restore http remote-relay default with Outlook delegated device code
  ([#433](https://github.com/n24q02m/better-email-mcp/pull/433),
  [`c900c95`](https://github.com/n24q02m/better-email-mcp/commit/c900c95ba449241973f4365fa6659fc36da7a0d0))

### Testing

- Add coverage for auth CLI and improve robustness
  ([#421](https://github.com/n24q02m/better-email-mcp/pull/421),
  [`955e632`](https://github.com/n24q02m/better-email-mcp/commit/955e6322b7493b7a2bb2736b7be294563f730d57))


## v1.22.6 (2026-04-17)

### Bug Fixes

- Bump @n24q02m/mcp-core to 1.2.0 (authlib CVE + auto-issue CD)
  ([`a1ac231`](https://github.com/n24q02m/better-email-mcp/commit/a1ac231b664fdd9352f4d5d2f36e036c45a78d61))


## v1.22.5 (2026-04-17)

### Bug Fixes

- Bump @n24q02m/mcp-core to 1.1.1 for OAuth issuer fix
  ([`3a28aa9`](https://github.com/n24q02m/better-email-mcp/commit/3a28aa9c24cc9119ff1a12baf15c1713098d55e1))


## v1.22.4 (2026-04-17)

### Bug Fixes

- Allow HOST env override for container bind address
  ([`47f97ff`](https://github.com/n24q02m/better-email-mcp/commit/47f97ff7fc6752885ad60ec6b91a5ae66af7729e))

- Remove direct better-sqlite3 dep; add trustedDependencies for Bun script skip
  ([`1f895e0`](https://github.com/n24q02m/better-email-mcp/commit/1f895e04284be3210a668b02b96b81c8466cf30f))

- Sync version files to match v1.22.4 tag for PSR compatibility
  ([`1170e6f`](https://github.com/n24q02m/better-email-mcp/commit/1170e6fe7bc1c1a5431395da6585518174d297d5))


## v1.22.3 (2026-04-13)

### Bug Fixes

- Install python3+make+g++ for better-sqlite3 source build
  ([`2065fd5`](https://github.com/n24q02m/better-email-mcp/commit/2065fd5cc859ec4bdca1419dd3b9f4d1e079b94b))


## v1.22.2 (2026-04-13)

### Bug Fixes

- Pin Bun image to alpine 7ed9f74 for better-sqlite3 compat
  ([`2566e7d`](https://github.com/n24q02m/better-email-mcp/commit/2566e7d3f715a437574dc8415c2f2aeea6e233d6))


## v1.22.1 (2026-04-13)

### Bug Fixes

- Pin better-sqlite3 to ^12.9.0 for Bun prebuild support
  ([`5fec291`](https://github.com/n24q02m/better-email-mcp/commit/5fec291c3a499b28c9556a8138d01ef9b67f2594))


## v1.22.0 (2026-04-13)

### Bug Fixes

- Add tests for isSafeUrl ([#378](https://github.com/n24q02m/better-email-mcp/pull/378),
  [`01e316a`](https://github.com/n24q02m/better-email-mcp/commit/01e316ae1847d121586d66ad79a3baae5e201b56))

- Add tests for relay schema ([#377](https://github.com/n24q02m/better-email-mcp/pull/377),
  [`c23d27a`](https://github.com/n24q02m/better-email-mcp/commit/c23d27a20ef15b69daa017e792990a2fae2f4e14))

- Bump @n24q02m/mcp-core to 1.0.0-beta.4
  ([`0638f72`](https://github.com/n24q02m/better-email-mcp/commit/0638f7283c982dc69fd5139118f7147bc93dfce9))

- Bump @n24q02m/mcp-core to ^1.0.0 stable
  ([`5d38bad`](https://github.com/n24q02m/better-email-mcp/commit/5d38bade04981e78af72dd8e41e7b2f528812476))

- Correct README tool count to 6 and add missing setup tool
  ([`c4e8f6b`](https://github.com/n24q02m/better-email-mcp/commit/c4e8f6b35b9b5bb888028e48742b172e0df23cd8))

- Dedupe repeat openBrowser calls in Outlook OAuth retry path
  ([`139663e`](https://github.com/n24q02m/better-email-mcp/commit/139663ef5838ccc685ee7de55588ea6341096665))

- Force LF line endings in .gitattributes to unblock Windows CI
  ([`07f976b`](https://github.com/n24q02m/better-email-mcp/commit/07f976bc3ef6cdde20d4f6da35b815ddc795010c))

- Only mark Outlook setup complete once OAuth2 poll finishes
  ([`9078f88`](https://github.com/n24q02m/better-email-mcp/commit/9078f88cae0772029c52aef8e65cbec6d8654585))

- Pin @n24q02m/mcp-core to published 1.0.0-beta.3 instead of local editable path
  ([`6f02c16`](https://github.com/n24q02m/better-email-mcp/commit/6f02c16c113ab82638d0dfb0c5bed4446db54ecb))

- Update actions/upload-artifact digest to 043fb46
  ([`242d88d`](https://github.com/n24q02m/better-email-mcp/commit/242d88db8ec9b884b891485adfd970310e89a2c5))

- Update comment reference from mcp-relay-core to mcp-core
  ([`92d2f76`](https://github.com/n24q02m/better-email-mcp/commit/92d2f76bb360c7d1885c3569cb32d308272ca66a))

- Update oven/bun:1 docker digest to 8956c76
  ([`512cb92`](https://github.com/n24q02m/better-email-mcp/commit/512cb929d4a26f36da1b2774aa49f4b10d7ba75e))

- Use optional chaining on RELAY_SCHEMA.fields in test
  ([`59ceda3`](https://github.com/n24q02m/better-email-mcp/commit/59ceda37cd4c118e958733790a2ae7a674b331de))

- **deps**: Update non-major dependencies
  ([#318](https://github.com/n24q02m/better-email-mcp/pull/318),
  [`026037c`](https://github.com/n24q02m/better-email-mcp/commit/026037cfee8361f8e6acde6e469432ebbc57286b))

- **security**: Update dependencies to fix npm audit vulnerabilities
  ([`d6a2a3f`](https://github.com/n24q02m/better-email-mcp/commit/d6a2a3fe7b37679c9a788563775f2b1f17b651a5))

### Chores

- **deps**: Lock file maintenance ([#368](https://github.com/n24q02m/better-email-mcp/pull/368),
  [`ebf3d23`](https://github.com/n24q02m/better-email-mcp/commit/ebf3d23427d72f8302ccd0fae61e03b1588adbf5))

- **deps**: Lock file maintenance ([#320](https://github.com/n24q02m/better-email-mcp/pull/320),
  [`d91b532`](https://github.com/n24q02m/better-email-mcp/commit/d91b532aa30c898910b150729cad349267379a9f))

- **deps**: Update non-major dependencies
  ([#389](https://github.com/n24q02m/better-email-mcp/pull/389),
  [`3b3d091`](https://github.com/n24q02m/better-email-mcp/commit/3b3d0914db2bc3bb254bbdf6278fe64b6021862e))

### Features

- Add cross-OS CI matrix (ubuntu/windows/macos)
  ([`f47de38`](https://github.com/n24q02m/better-email-mcp/commit/f47de38330c6c66c6b3e7016fe3c6230aad5e55e))

- Add setup tool for credential management via relay
  ([`ffd451a`](https://github.com/n24q02m/better-email-mcp/commit/ffd451a223930853bec0047caa2e2d49ca4002bb))

- Auto-open browser when relay setup is triggered
  ([`49f8cf6`](https://github.com/n24q02m/better-email-mcp/commit/49f8cf60f770cfe1765dfbe1c66dcf53e6add01c))

- Default to HTTP transport, --stdio for backward compat
  ([`ad862ba`](https://github.com/n24q02m/better-email-mcp/commit/ad862ba216a917048780a34846f921047557c8f7))

- Hot-reload accounts after relay credentials are configured
  ([`7a1b0c4`](https://github.com/n24q02m/better-email-mcp/commit/7a1b0c4157b2edab8963d50b1b7a38601503d72d))

- Implement Outlook device code OAuth flow in local HTTP mode
  ([`39f6dc7`](https://github.com/n24q02m/better-email-mcp/commit/39f6dc7cb351f40e268a1d8a5fd3dc1a2dc21ae3))

- Migrate from mcp-relay-core to mcp-core
  ([`ddd8cf7`](https://github.com/n24q02m/better-email-mcp/commit/ddd8cf71e23fd7fdb5a3ae72bf59583edb3e1a86))

- Migrate to mcp-core local OAuth with IMAP connection test
  ([`1f0e7ed`](https://github.com/n24q02m/better-email-mcp/commit/1f0e7ed9dceb6a02bb0a60a2aae64ee73666b7e0))

- Restore multi-account email form with domain auto-detect
  ([`c97dfdc`](https://github.com/n24q02m/better-email-mcp/commit/c97dfdcb018bea0d0b8203ef1904d85d3caa8687))

- Sync local changes from workspace
  ([`f17b529`](https://github.com/n24q02m/better-email-mcp/commit/f17b529c9318468f05204a41bf79a9aaec7f6cb6))

### Performance Improvements

- Replace synchronous I/O with asynchronous in resolveCredentialState
  ([#341](https://github.com/n24q02m/better-email-mcp/pull/341),
  [`65cc2ee`](https://github.com/n24q02m/better-email-mcp/commit/65cc2ee36db62dd62a6f8f5c027d53a91d5da211))


## v1.21.0 (2026-04-07)

### Bug Fixes

- Add credential state tests for coverage improvement
  ([`e6fa95c`](https://github.com/n24q02m/better-email-mcp/commit/e6fa95c0fe0152ff562a82749e0025cecec6d2b9))

- Per-user encryption key derivation and PBKDF2 600k iterations
  ([`56e0bcb`](https://github.com/n24q02m/better-email-mcp/commit/56e0bcba8c4b6624fd3d11a4eaf049523b8b35d5))

- Remove BETA markers and promote relay as primary setup method
  ([`f7b8a49`](https://github.com/n24q02m/better-email-mcp/commit/f7b8a49d397f5835f92df58232f94846f54aaae9))

- Resolve biome formatting errors across project
  ([`17291a7`](https://github.com/n24q02m/better-email-mcp/commit/17291a74db403f24f807beed8fd580b03f5ebd10))

### Features

- Migrate code review from Qodo to CodeRabbit
  ([#337](https://github.com/n24q02m/better-email-mcp/pull/337),
  [`a97bb14`](https://github.com/n24q02m/better-email-mcp/commit/a97bb147cf1cb8faf339f201d700f11ddd5b13a9))


## v1.20.0 (2026-04-06)

### Bug Fixes

- Mark relay as BETA, promote env vars as primary setup method
  ([`286a4aa`](https://github.com/n24q02m/better-email-mcp/commit/286a4aaae5038b148ee68d49b5063186b679ca7b))

### Features

- Non-blocking relay with credential state machine and lazy trigger
  ([`49b336e`](https://github.com/n24q02m/better-email-mcp/commit/49b336e2b85583938e38b1cb475a8fe81667fe46))


## v1.19.0 (2026-04-04)

### Bug Fixes

- Consolidated improvements from Jules PR review
  ([#317](https://github.com/n24q02m/better-email-mcp/pull/317),
  [`f847467`](https://github.com/n24q02m/better-email-mcp/commit/f8474673fd5e53b4a788358333b0348861558fcc))

- Scope marketplace sync token to claude-plugins repo
  ([`5d8ba6f`](https://github.com/n24q02m/better-email-mcp/commit/5d8ba6fdf11be9c3cdcd84ee7a2e2cd9bfff9e2e))

### Features

- Add agent/manual setup guides, simplify README, cleanup root
  ([`23e1b91`](https://github.com/n24q02m/better-email-mcp/commit/23e1b91ae10d7f6d0a9bbc74e1ed2f0ce27ec8fc))


## v1.18.0 (2026-04-03)

### Features

- Remove deprecated Gemini CLI extension support
  ([`064755f`](https://github.com/n24q02m/better-email-mcp/commit/064755f206d8ec4a07d0e03dba81082be6657299))


## v1.18.0-beta.1 (2026-04-03)

### Bug Fixes

- Support compound IMAP search queries
  ([#299](https://github.com/n24q02m/better-email-mcp/pull/299),
  [`31954c4`](https://github.com/n24q02m/better-email-mcp/commit/31954c4972a21a7f3917b400bd4272ced36dc4b0))

- **deps**: Update non-major dependencies
  ([#270](https://github.com/n24q02m/better-email-mcp/pull/270),
  [`8a4094d`](https://github.com/n24q02m/better-email-mcp/commit/8a4094d5c5f42de79050b8c1e1e1973d44ea57ee))

### Chores

- **deps**: Lock file maintenance ([#258](https://github.com/n24q02m/better-email-mcp/pull/258),
  [`78fd570`](https://github.com/n24q02m/better-email-mcp/commit/78fd570501933eded69fd131c4663f3672bc316f))

- **deps**: Update qodo-ai/pr-agent digest to d82f7d3
  ([#269](https://github.com/n24q02m/better-email-mcp/pull/269),
  [`58c9f59`](https://github.com/n24q02m/better-email-mcp/commit/58c9f59e82437e96dea79976b992ecf97c0bd6ff))

### Features

- Replace inline HTML relay with mcp-relay-core in HTTP mode
  ([#301](https://github.com/n24q02m/better-email-mcp/pull/301),
  [`332e31e`](https://github.com/n24q02m/better-email-mcp/commit/332e31e3a240e339c78e9923b42ee936825cb63f))

### Performance Improvements

- Extract regular expressions to module-scoped constants in messages.ts
  ([#268](https://github.com/n24q02m/better-email-mcp/pull/268),
  [`aa702f3`](https://github.com/n24q02m/better-email-mcp/commit/aa702f3e0aae0055283eecdb16e139ee7c069d91))

- Optimize user credentials loading with concurrent async I/O
  ([#278](https://github.com/n24q02m/better-email-mcp/pull/278),
  [`bb268f6`](https://github.com/n24q02m/better-email-mcp/commit/bb268f656a8e03b0d802f5cd40ab23a200dc6fd6))

- Parallelize OAuth token validation in relay setup
  ([#279](https://github.com/n24q02m/better-email-mcp/pull/279),
  [`dd233bf`](https://github.com/n24q02m/better-email-mcp/commit/dd233bf5619dd29e38c4d75a844b8136fe4b4f30))

### Testing

- Add error test for CallToolRequestSchema handler
  ([#281](https://github.com/n24q02m/better-email-mcp/pull/281),
  [`c56c367`](https://github.com/n24q02m/better-email-mcp/commit/c56c3679b1c2262fafaed84ce9f97642b7735538))


## v1.17.0 (2026-03-31)

### Bug Fixes

- Send relay complete message after OAuth device code flow
  ([#267](https://github.com/n24q02m/better-email-mcp/pull/267),
  [`cbf7fb7`](https://github.com/n24q02m/better-email-mcp/commit/cbf7fb7af89e0a1cb992f0f9c440194ebea38736))

- **deps**: Update non-major dependencies
  ([#257](https://github.com/n24q02m/better-email-mcp/pull/257),
  [`c41e2e2`](https://github.com/n24q02m/better-email-mcp/commit/c41e2e2a93b0b2e59daba46552dcea16989fee16))

- **security**: Mitigate XSS vulnerability in HTTP relay authentication form
  ([#264](https://github.com/n24q02m/better-email-mcp/pull/264),
  [`a667c62`](https://github.com/n24q02m/better-email-mcp/commit/a667c62201ac9e45cdbd123c17f80d53555321d7))

- **test**: Make OAuth2 browser test platform-aware
  ([#265](https://github.com/n24q02m/better-email-mcp/pull/265),
  [`443e004`](https://github.com/n24q02m/better-email-mcp/commit/443e004e20e82f12f3a3a57407a23ea732b3221d))

### Continuous Integration

- Fix Qodo vertex_ai config and VERTEXAI_LOCATION
  ([`707dd0b`](https://github.com/n24q02m/better-email-mcp/commit/707dd0bc3c38a59c23d174a960db8b406c688f1f))

- **cd**: Add plugin marketplace sync on stable release
  ([`d0c2940`](https://github.com/n24q02m/better-email-mcp/commit/d0c2940359a9bc1bbd8c28650a70ab2d93a04d69))

### Performance Improvements

- Add case-insensitive fast-paths to html snippet extraction
  ([#263](https://github.com/n24q02m/better-email-mcp/pull/263),
  [`ea7375c`](https://github.com/n24q02m/better-email-mcp/commit/ea7375cf202d64de406adf29300c6982c98b9492))

### Testing

- Improve coverage to 96.47% statements (+62 tests)
  ([#266](https://github.com/n24q02m/better-email-mcp/pull/266),
  [`5732af8`](https://github.com/n24q02m/better-email-mcp/commit/5732af861e57c37ab0b8166e41821e448d5a35ac))


## v1.17.0-beta.2 (2026-03-30)

### Performance Improvements

- Pre-compute PROVIDER_MAP entries in config
  ([#259](https://github.com/n24q02m/better-email-mcp/pull/259),
  [`7981b6c`](https://github.com/n24q02m/better-email-mcp/commit/7981b6c3975eaeade38d249475826309331596dd))


## v1.17.0-beta.1 (2026-03-30)

### Features

- Add multi-user HTTP mode with OAuth 2.1 auth
  ([#261](https://github.com/n24q02m/better-email-mcp/pull/261),
  [`ea03e43`](https://github.com/n24q02m/better-email-mcp/commit/ea03e43fca719909401555a54d77aa933669febc))


## v1.16.0 (2026-03-28)

### Bug Fixes

- Check saved OAuth tokens after relay skip
  ([`405f56a`](https://github.com/n24q02m/better-email-mcp/commit/405f56afe8a3f5cbbf2cc2bc0bf7c5ea435f1f11))

- Credential resolution order -- relay only when no local credentials
  ([`9ca07e7`](https://github.com/n24q02m/better-email-mcp/commit/9ca07e736295c8d3c7137749b6455705a4db225c))

- Don't send complete message when OAuth is pending
  ([`d2eda2a`](https://github.com/n24q02m/better-email-mcp/commit/d2eda2a9d79e23a33e1c87a2a33558ae26642e98))

- Handle Outlook email-only entries in parseCredentials
  ([`34997d4`](https://github.com/n24q02m/better-email-mcp/commit/34997d4d31e79c64f7248193aff8f9a176c17c12))

- Pin Docker base images to SHA digests
  ([`9da817b`](https://github.com/n24q02m/better-email-mcp/commit/9da817bcd6d0251762f44dc69a2e3c9f166c5386))

- Pin pre-commit hooks to commit SHA
  ([`c6a7132`](https://github.com/n24q02m/better-email-mcp/commit/c6a7132f41dab8c7209f15209b40ad259a3ed415))

- Replace sendMessage with inline fetch, fix TS errors
  ([`1f18cb2`](https://github.com/n24q02m/better-email-mcp/commit/1f18cb2031c3f01d0aa2ac61c6a1040ec80ad40e))

- Update relay-setup tests and apply biome lint fixes
  ([`f148ddc`](https://github.com/n24q02m/better-email-mcp/commit/f148ddcd829152ea680b895337a85740faad611a))

- **cd**: Remove empty env blocks from OIDC migration
  ([`49c0470`](https://github.com/n24q02m/better-email-mcp/commit/49c0470a95e1393fb7474138b578b958605a7743))

- **cd**: Replace GH_PAT with GitHub App installation token
  ([`b3e0235`](https://github.com/n24q02m/better-email-mcp/commit/b3e02357aa73f0bd65612da7e88c8c1f44b894bd))

- **cd**: Use npm OIDC provenance instead of NPM_TOKEN
  ([`dbe28a3`](https://github.com/n24q02m/better-email-mcp/commit/dbe28a33193bbb5b3e40efd529ef142f06728361))

- **ci**: Consolidate SMTP_USERNAME and NOTIFY_EMAIL into one secret
  ([`1c46f45`](https://github.com/n24q02m/better-email-mcp/commit/1c46f4520ca020198fe36b2a553ad00725588e63))

- **ci**: Consolidate SMTP_USERNAME+PASSWORD into SMTP_CREDENTIAL
  ([`a9b527c`](https://github.com/n24q02m/better-email-mcp/commit/a9b527cf5e6eae7dcc785b7f3120693bc53c508e))

- **ci**: Remove CODECOV_TOKEN, use tokenless upload
  ([`2fa032f`](https://github.com/n24q02m/better-email-mcp/commit/2fa032f6ca6f18792dc1d3ab785f4e93480540fe))

- **ci**: Use Vertex AI WIF instead of GEMINI_API_KEY for code review
  ([`4960c8f`](https://github.com/n24q02m/better-email-mcp/commit/4960c8f4ed503dc61ad0e026f9ed468d065b4ac4))

- **deps**: Update dependency @n24q02m/mcp-relay-core to v1
  ([`6decbc8`](https://github.com/n24q02m/better-email-mcp/commit/6decbc8bdfa7368a08647ba5e45f98955bda361b))

- **deps**: Update non-major dependencies
  ([#225](https://github.com/n24q02m/better-email-mcp/pull/225),
  [`e2231d4`](https://github.com/n24q02m/better-email-mcp/commit/e2231d411eb6d2fa0069c4a597342d73fee35acf))

### Chores

- **deps**: Lock file maintenance ([#255](https://github.com/n24q02m/better-email-mcp/pull/255),
  [`6606c55`](https://github.com/n24q02m/better-email-mcp/commit/6606c55f59a0b0684dfecd3daa2dd1cbecc43452))

- **deps**: Lock file maintenance ([#249](https://github.com/n24q02m/better-email-mcp/pull/249),
  [`a6012ec`](https://github.com/n24q02m/better-email-mcp/commit/a6012ec9d039735a22d380077f027ed197b529fc))

- **deps**: Update actions/create-github-app-token action to v3
  ([#251](https://github.com/n24q02m/better-email-mcp/pull/251),
  [`64d761f`](https://github.com/n24q02m/better-email-mcp/commit/64d761f527d11fcab697e19f83709a3aa684c753))

- **deps**: Update codecov/codecov-action action to v6
  ([#247](https://github.com/n24q02m/better-email-mcp/pull/247),
  [`1a5c27a`](https://github.com/n24q02m/better-email-mcp/commit/1a5c27ad25f605ae735c5e5ebdc73a6aab1bd781))

- **deps**: Update google-github-actions/auth action to v3
  ([#252](https://github.com/n24q02m/better-email-mcp/pull/252),
  [`3ad603b`](https://github.com/n24q02m/better-email-mcp/commit/3ad603b4952654ba022f44dd3ff2dfbad17fb412))

### Code Style

- Fix Biome formatting in plugin/extension JSON files
  ([`64a9f75`](https://github.com/n24q02m/better-email-mcp/commit/64a9f75618bc9e4775c4a79739d1d2ea763de026))

### Features

- Relay-first startup — always show relay URL
  ([`f8f90f5`](https://github.com/n24q02m/better-email-mcp/commit/f8f90f56b212c081730778085b7c37247ffaec8e))

- Send OAuth device code via relay messaging
  ([`e3a7323`](https://github.com/n24q02m/better-email-mcp/commit/e3a7323ebd3f1b94bf190619f1fa94105422488b))

- **relay**: Support multi-account setup via relay page
  ([`fe9e3f8`](https://github.com/n24q02m/better-email-mcp/commit/fe9e3f8c77bfe4aed79789181f3c53ab3ed58588))

### Performance Improvements

- **registry**: Pre-compute static arrays and strings in request handlers
  ([#250](https://github.com/n24q02m/better-email-mcp/pull/250),
  [`57970d4`](https://github.com/n24q02m/better-email-mcp/commit/57970d4023e85695cba8fe3fe075b0f29497ad1b))


## v1.15.0 (2026-03-26)

### Chores

- Add server.json to PSR version_variables, sync version
  ([`bbeba81`](https://github.com/n24q02m/better-email-mcp/commit/bbeba81e0d6131e8f91e498c1160513a83d7aa71))

- Clean up plugin manifest for best practices
  ([`563bd8c`](https://github.com/n24q02m/better-email-mcp/commit/563bd8cc481928d7ed0b90610c3f1f258a3bac21))

### Documentation

- Fix marketplace references, improve Gemini CLI extension config
  ([`ff1f4d7`](https://github.com/n24q02m/better-email-mcp/commit/ff1f4d7d2cfc00f6b0839bc7a77c035031ce7fa4))

- Standardize README structure
  ([`092ef71`](https://github.com/n24q02m/better-email-mcp/commit/092ef71ac3888003842f8ec45064a700293c30a3))


## v1.15.0-beta.1 (2026-03-25)

### Bug Fixes

- Add mcp-name line to README
  ([`41db999`](https://github.com/n24q02m/better-email-mcp/commit/41db999ba517d8ef7b7399a402aa12ab6caa971a))

- Align gemini-extension.json mcpServers key with plugin.json
  ([`c5fdd4e`](https://github.com/n24q02m/better-email-mcp/commit/c5fdd4e5c7357c43ed21715fa10b77884a7d427d))

- Auto-sync plugin.json version via PSR
  ([`8d26349`](https://github.com/n24q02m/better-email-mcp/commit/8d2634925950bbe1685143c5a05f8d457a1714a9))

- Correct plugin install commands per official docs
  ([`c30302b`](https://github.com/n24q02m/better-email-mcp/commit/c30302b9b60a8a2cc66837ebd7ddf092a3e80418))

- Format gemini-extension.json for biome
  ([`e5795f6`](https://github.com/n24q02m/better-email-mcp/commit/e5795f6f8b0e61d49a065ecfe149f6ccedc5cd8c))

- Pin third-party GitHub Actions to SHA hashes
  ([`1ff3533`](https://github.com/n24q02m/better-email-mcp/commit/1ff3533dbb12afe068314a0285a590ed59008b58))

- Remove empty env vars from plugin configs to prevent empty-string bugs
  ([`2582043`](https://github.com/n24q02m/better-email-mcp/commit/25820431641c48a92cd709579be8dda3b2aceb8b))

- Remove env from README MCP config examples
  ([`f05681d`](https://github.com/n24q02m/better-email-mcp/commit/f05681d10131b045729f7e60db50db8f28cb3a6f))

- Remove env vars from plugin.json to prevent overwriting user config
  ([`d9374a0`](https://github.com/n24q02m/better-email-mcp/commit/d9374a036b77d41435ecf59733e0a21ae79dffb2))

- Remove pr-title-check job from CI
  ([`3f040c0`](https://github.com/n24q02m/better-email-mcp/commit/3f040c0458c1c7017f23252704fa420222b87d9c))

- Resolve biome lint errors
  ([`73454f8`](https://github.com/n24q02m/better-email-mcp/commit/73454f8d6d946c63bef71ee85587ce5b3bab001a))

- Resolve TypeScript strict null check in init-server test
  ([#243](https://github.com/n24q02m/better-email-mcp/pull/243),
  [`9887ea6`](https://github.com/n24q02m/better-email-mcp/commit/9887ea6689a4b5d5db8b5eafce6e161b94dd6512))

- Switch mcp-relay-core from file dep to published npm package
  ([#243](https://github.com/n24q02m/better-email-mcp/pull/243),
  [`9887ea6`](https://github.com/n24q02m/better-email-mcp/commit/9887ea6689a4b5d5db8b5eafce6e161b94dd6512))

- Sync plugin.json version and add skills/hooks references
  ([`89a301e`](https://github.com/n24q02m/better-email-mcp/commit/89a301e00ba78566f99670f436a29457cfe1eca2))

- Unify Plugin install section with marketplace + individual options
  ([`8872dad`](https://github.com/n24q02m/better-email-mcp/commit/8872dad1dd45bd24657e4135a4110b831ba9135b))

### Chores

- Add docker-compose overlay for HTTP mode deployment
  ([#243](https://github.com/n24q02m/better-email-mcp/pull/243),
  [`9887ea6`](https://github.com/n24q02m/better-email-mcp/commit/9887ea6689a4b5d5db8b5eafce6e161b94dd6512))

### Documentation

- Add relay files to CLAUDE.md file structure
  ([`529dcf1`](https://github.com/n24q02m/better-email-mcp/commit/529dcf1417ba66b4cf8b8bd52dac580c1ef19595))

- Add zero-config relay setup section to README
  ([`1b40ec0`](https://github.com/n24q02m/better-email-mcp/commit/1b40ec04f1292aca9097dc750e69d3b90f8e8cbf))

### Features

- Add EMAIL_CREDENTIALS env var and bunx mode to plugin config
  ([`4946a2f`](https://github.com/n24q02m/better-email-mcp/commit/4946a2f6d3092c7530d8df16ca8c981d6c0eb5be))

- Add Gemini CLI extension config with PSR version sync
  ([`5e24293`](https://github.com/n24q02m/better-email-mcp/commit/5e2429301d8b2572ca3dd3819163eed463e3fe5c))

- Add HTTP transport mode with encrypted credential store
  ([#243](https://github.com/n24q02m/better-email-mcp/pull/243),
  [`9887ea6`](https://github.com/n24q02m/better-email-mcp/commit/9887ea6689a4b5d5db8b5eafce6e161b94dd6512))

- Add pnpx and yarn dlx modes to plugin config
  ([`46f909d`](https://github.com/n24q02m/better-email-mcp/commit/46f909d1f74ec85cd044c59ec2be07afc567bc3f))

- Add zero-env-config relay setup via mcp-relay-core
  ([#243](https://github.com/n24q02m/better-email-mcp/pull/243),
  [`9887ea6`](https://github.com/n24q02m/better-email-mcp/commit/9887ea6689a4b5d5db8b5eafce6e161b94dd6512))

- Multi-mode plugin config (stdio + docker + http)
  ([`b17be43`](https://github.com/n24q02m/better-email-mcp/commit/b17be4363cd7b61b78adcc012c1507d498744694))

- Standardize README with MCP Resources, Security, collapsible clients
  ([`7fe433c`](https://github.com/n24q02m/better-email-mcp/commit/7fe433c1e31dd6054c34c917f7670c2ea0b31bd7))

- Zero-env-config relay setup + HTTP transport mode
  ([#243](https://github.com/n24q02m/better-email-mcp/pull/243),
  [`9887ea6`](https://github.com/n24q02m/better-email-mcp/commit/9887ea6689a4b5d5db8b5eafce6e161b94dd6512))


## v1.14.0 (2026-03-24)

### Bug Fixes

- Correct plugin packaging paths and marketplace schema
  ([`cca9bba`](https://github.com/n24q02m/better-email-mcp/commit/cca9bba208d7ed75c39783197b5db32456f59c5c))

- Exclude live tests from default vitest run
  ([`067e1a9`](https://github.com/n24q02m/better-email-mcp/commit/067e1a92ef815782fd046ea4e938691e533565dc))

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
