# Config Tool

Manage email credential setup and runtime configuration.

### Description
This tool allows you to check the status of your email credentials, manually trigger the interactive relay setup process, reset your configuration, signal completion of external setup, and manage runtime caches.

### Actions

#### 1. status
Check current credential state.
```json
{
  "action": "status"
}
```

#### 2. setup_start
Trigger the relay setup session and return the setup URL.
```json
{
  "action": "setup_start",
  "force": true
}
```
*   `force`: (Optional) boolean. Set to `true` to force restarting the relay setup even if one is already in progress.

#### 3. setup_reset
Clear all saved credentials and reset to awaiting_setup state.
```json
{
  "action": "setup_reset"
}
```

#### 4. setup_complete
Re-check credential state after external config changes (e.g. relay submission).
```json
{
  "action": "setup_complete"
}
```

#### 5. set
Update a runtime setting. Email MCP has no runtime settings; always returns `ok: false`.
```json
{
  "action": "set"
}
```

#### 6. cache_clear
Clear all in-memory caches (sent folder paths, archive folder paths, OAuth token cache).
Returns the number of cache entries cleared.
```json
{
  "action": "cache_clear"
}
```
