## 2025-02-18 - [Add loading spinner to async submit button]
**Learning:** Found that when configuring multi-account email integrations, users may click "Connect" and receive no visual feedback that verification is in progress (especially if Microsoft OAuth needs to establish a session in the background). Added an explicit loading spinner and text swap.
**Action:** Replaced static text button with dynamic aria-busy disabled state and inline animated CSS spinner for improved visual indication of async progress.
