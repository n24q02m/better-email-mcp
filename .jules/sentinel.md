## 2025-06-08 - Prevent Prototype Pollution in JSON Stores
**Vulnerability:** Insecure JSON deserialization in `tokens.json` parsing.
**Learning:** Raw `JSON.parse()` output used as a dictionary allows attackers to pollute the prototype chain if `__proto__` is injected.
**Prevention:** Always initialize dictionary objects via `Object.assign(Object.create(null), parsedData)` to prevent prototype pollution when parsing user-controlled JSON data.
