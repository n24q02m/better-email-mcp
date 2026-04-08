# Setup Tool

Manage email credential setup and relay configuration.

### Description
This tool allows you to check the status of your email credentials, manually trigger the interactive relay setup process, reset your configuration, or signal completion of external setup.

### Actions

#### 1. status
Check current credential state.
```json
{
  "action": "status"
}
```

#### 2. start
Trigger the relay setup session and return the setup URL.
```json
{
  "action": "start",
  "force": true
}
```
*   `force`: (Optional) boolean. Set to `true` to force restarting the relay setup even if one is already in progress.

#### 3. reset
Clear all saved credentials and reset to awaiting_setup state.
```json
{
  "action": "reset"
}
```

#### 4. complete
Re-check credential state after external config changes (e.g. relay submission).
```json
{
  "action": "complete"
}
```
