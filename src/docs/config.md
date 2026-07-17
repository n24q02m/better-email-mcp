# Config Tool

Manage email credential setup and runtime configuration.

### Description
This tool allows you to check the status of your email credentials, return the setup URL, reset your configuration, signal completion of external setup, and manage runtime caches. In HTTP mode the credential form is already served at `/authorize` (use `config__open_relay` to open it); in stdio mode credentials come from env vars and there is no setup URL.

### Actions

#### 1. status
Check current credential state.
```json
{
  "action": "status"
}
```

#### 2. setup_status
Credential/setup state only -- `state` and `setup_url`, without the `accounts` list `status` also returns. Cross-server parity action (matches wet/mnemo/telegram's `config(action="setup_status")`).
```json
{
  "action": "setup_status"
}
```

#### 3. setup_start
Return the current setup URL (the credential form on `/authorize` in HTTP mode). Does not spawn a separate relay session; in stdio mode the URL is `null` (credentials come from env vars).
```json
{
  "action": "setup_start",
  "force": true
}
```
*   `force`: (Optional) boolean. Accepted for compatibility; the current implementation does not restart a relay session.

#### 4. setup_reset
Clear all saved credentials and reset to awaiting_setup state.
```json
{
  "action": "setup_reset"
}
```

#### 5. setup_complete
Re-check credential state after external config changes (e.g. relay submission).
```json
{
  "action": "setup_complete"
}
```

#### 6. set
Update a runtime setting. Email MCP has no runtime settings; always returns `ok: false`.
```json
{
  "action": "set"
}
```

#### 7. cache_clear
Clear all in-memory caches (sent folder paths, archive folder paths, OAuth token cache).
Returns the number of cache entries cleared.
```json
{
  "action": "cache_clear"
}
```
