/**
 * Custom credential form for better-email-mcp.
 *
 * Renders a dark-themed multi-account email form with:
 *  - Dynamic account cards (Add/Remove)
 *  - Domain auto-detect: gmail/googlemail/yahoo/icloud => App Password label
 *    + provider help URL; outlook/hotmail/live => OAuth2 notice (handled
 *    automatically by the server via Microsoft Device Code flow); custom
 *    domain => password + optional IMAP host.
 *  - Final EMAIL_CREDENTIALS string format:
 *      email1:pass1,email2:pass2:imap_host,outlook_email
 *    Comma-separated between accounts, colon-separated within. Outlook
 *    accounts have no password/colon -- the server detects them and runs
 *    Microsoft's OAuth Device Code flow, surfacing the verification URL +
 *    user code back into this form.
 *
 * This form POSTs plain JSON `{ EMAIL_CREDENTIALS: "..." }` to the
 * mcp-core OAuth `/authorize?nonce=<nonce>` endpoint.
 *
 * All dynamic DOM content is built with createElement + textContent +
 * setAttribute. No innerHTML with user-provided values anywhere.
 */

import type { RelayConfigSchema } from '@n24q02m/mcp-core'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Render the custom email credential form: multi-account cards with
 * domain auto-detect + Add/Remove buttons + Outlook OAuth notice.
 *
 * Submits EMAIL_CREDENTIALS to mcp-core OAuth /authorize endpoint as
 * comma-separated `email1:pass1,email2:pass2:imap_host` format. The
 * server-side onCredentialsSaved callback parses this back into accounts.
 */
export function renderEmailCredentialForm(
  _schema: RelayConfigSchema,
  options: { submitUrl: string; prefill?: Record<string, string> }
): string {
  const displayName = escapeHtml(_schema.displayName ?? _schema.server ?? 'Email MCP')
  const server = escapeHtml(_schema.server ?? 'better-email-mcp')
  const description = escapeHtml(
    _schema.description ??
      'Configure one or more email accounts (Gmail, Yahoo, iCloud, Outlook/Hotmail/Live, or custom IMAP). Outlook accounts use OAuth2 and are handled automatically by the server.'
  )
  const submitUrl = escapeHtml(options.submitUrl)

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${displayName}</title>
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: #0f0f0f;
            color: #e8e8e8;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 15px;
            line-height: 1.6;
            min-height: 100vh;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            padding: 2rem 1rem;
        }
        .container { width: 100%; max-width: 520px; }
        .card {
            background-color: #1a1a1a;
            border: 1px solid #2a2a2a;
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 1.25rem;
        }
        .server-header { margin-bottom: 1.5rem; }
        .server-name { font-size: 1.375rem; font-weight: 600; color: #fff; margin-bottom: 0.375rem; }
        .server-id {
            font-size: 0.8125rem;
            color: #9ca3af;
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
            margin-bottom: 0.5rem;
        }
        .server-description { font-size: 0.9rem; color: #9ca3af; margin-top: 0.5rem; }
        .form-title {
            font-size: 0.875rem;
            font-weight: 500;
            color: #aaa;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 1.25rem;
        }
        .account-card {
            border: 1px solid #2a2a2a;
            border-radius: 10px;
            padding: 1rem;
            margin-bottom: 0.875rem;
            background-color: #121212;
        }
        .account-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.75rem;
        }
        .account-title { font-size: 0.95rem; font-weight: 600; color: #ddd; }
        .remove-btn {
            background: transparent;
            color: #f87171;
            border: 1px solid rgba(248, 113, 113, 0.3);
            border-radius: 6px;
            padding: 0.25rem 0.6rem;
            cursor: pointer;
            font-size: 0.75rem;
        }
        .remove-btn:hover { background-color: rgba(248, 113, 113, 0.08); }
        .remove-btn:focus-visible { outline: 2px solid #f87171; outline-offset: 2px; }
        .field-group { margin-bottom: 0.875rem; }
        .field-label {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.8125rem;
            font-weight: 500;
            color: #ccc;
            margin-bottom: 0.375rem;
        }
        .optional-badge {
            font-size: 0.6875rem;
            font-weight: 400;
            color: #9ca3af;
            background-color: rgba(255, 255, 255, 0.04);
            border: 1px solid #4b5563;
            border-radius: 4px;
            padding: 0.1rem 0.4rem;
        }
        .required-indicator {
            color: #f87171;
            margin-left: 0.25rem;
        }
        .field-input {
            width: 100%;
            background-color: #0d0d0d;
            border: 1px solid #2e2e2e;
            border-radius: 8px;
            color: #e8e8e8;
            font-size: 0.9375rem;
            padding: 0.55rem 0.8rem;
            outline: none;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .field-input:focus {
            border-color: #4a6fa5;
            box-shadow: 0 0 0 3px rgba(74, 111, 165, 0.2);
        }
        .field-input::placeholder { color: #9ca3af; }
        .help-text { font-size: 0.8125rem; color: #9ca3af; margin-top: 0.375rem; }
        .help-text a { color: #6c9bd2; text-decoration: none; }
        .help-text a:hover { text-decoration: underline; }
        .notice {
            font-size: 0.85rem;
            color: #fbbf24;
            background-color: rgba(251, 191, 36, 0.08);
            border: 1px solid rgba(251, 191, 36, 0.25);
            border-radius: 8px;
            padding: 0.625rem 0.75rem;
            margin-top: 0.5rem;
        }
        .add-btn {
            width: 100%;
            background-color: transparent;
            color: #6c9bd2;
            border: 1px dashed #3a5a8a;
            border-radius: 8px;
            padding: 0.625rem 1rem;
            cursor: pointer;
            font-size: 0.875rem;
            margin-bottom: 1rem;
            transition: background-color 0.15s ease, border-color 0.15s ease;
        }
        .add-btn:hover { background-color: rgba(108, 155, 210, 0.08); border-color: #4a6fa5; }
        .add-btn:focus-visible { outline: 2px solid #6c9bd2; outline-offset: 2px; }
        .submit-btn {
            width: 100%;
            background-color: #4a6fa5;
            border: none;
            border-radius: 8px;
            color: #fff;
            cursor: pointer;
            font-size: 0.9375rem;
            font-weight: 500;
            padding: 0.75rem 1.5rem;
            margin-top: 0.5rem;
        }
        .submit-btn:hover { background-color: #5a7fb5; }
        .submit-btn:focus-visible { outline: 2px solid #4a6fa5; outline-offset: 2px; }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .status-box {
            display: none;
            border-radius: 8px;
            font-size: 0.875rem;
            margin-top: 1rem;
            padding: 0.75rem 1rem;
        }
        .status-box.success {
            background-color: rgba(52, 199, 89, 0.1);
            border: 1px solid rgba(52, 199, 89, 0.3);
            color: #34c759;
        }
        .status-box.error {
            background-color: rgba(248, 113, 113, 0.1);
            border: 1px solid rgba(248, 113, 113, 0.3);
            color: #f87171;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
            display: inline-block;
            width: 1.125rem;
            height: 1.125rem;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-right: 0.5rem;
            vertical-align: text-bottom;
        }

    </style>
</head>
<body>
    <main class="container">
        <div class="card">
            <div class="server-header">
                <h1 class="server-name">${displayName}</h1>
                <div class="server-id">${server}</div>
                <p class="server-description">${description}</p>
            </div>

            <h2 class="form-title">Email Accounts</h2>

            <form id="credential-form" novalidate>
                <fieldset id="form-fieldset" style="border: none; padding: 0; margin: 0; min-width: 0;">
                    <div id="accounts-container"></div>

                    <button type="button" class="add-btn" id="add-account-btn">+ Add Another Account</button>

                    <button type="submit" class="submit-btn" id="submit-btn">Connect</button>
                </fieldset>
                <div class="status-box" id="status-box" role="alert"></div>
            </form>
        </div>
    </main>

    <script>
        (function () {
            var submitUrl = "${submitUrl}";

            var OAUTH_DOMAINS = ["outlook.com", "hotmail.com", "live.com"];
            var APP_PASSWORD_DOMAINS = {
                "gmail.com": {
                    label: "App Password",
                    helpUrl: "https://myaccount.google.com/apppasswords",
                    helpText: "Generate an App Password in your Google Account settings"
                },
                "googlemail.com": {
                    label: "App Password",
                    helpUrl: "https://myaccount.google.com/apppasswords",
                    helpText: "Generate an App Password in your Google Account settings"
                },
                "yahoo.com": {
                    label: "App Password",
                    helpUrl: "https://login.yahoo.com/account/security",
                    helpText: "Generate an App Password in Yahoo Account Security settings"
                },
                "icloud.com": {
                    label: "App Password",
                    helpUrl: "https://appleid.apple.com",
                    helpText: "Generate an App Password at appleid.apple.com"
                }
            };

            var container = document.getElementById("accounts-container");
            var addBtn = document.getElementById("add-account-btn");
            var form = document.getElementById("credential-form");
            var formFieldset = document.getElementById("form-fieldset");
            var submitBtn = document.getElementById("submit-btn");
            var statusBox = document.getElementById("status-box");

            var accountIndex = 0;

            function showStatus(type, message) {
                statusBox.className = "status-box " + type;
                statusBox.textContent = message;
                statusBox.style.display = "block";
            }

            function clearChildren(el) {
                while (el.firstChild) el.removeChild(el.firstChild);
            }

            function createFieldGroup(opts) {
                var idx = opts.idx;
                var key = opts.key;
                var label = opts.label;
                var type = opts.type;
                var placeholder = opts.placeholder;
                var required = opts.required;
                var helpText = opts.helpText;
                var helpUrl = opts.helpUrl;

                var group = document.createElement("div");
                group.className = "field-group";

                var labelEl = document.createElement("label");
                labelEl.className = "field-label";
                labelEl.setAttribute("for", "field-" + key + "_" + idx);
                labelEl.textContent = label;
                if (!required) {
                    var badge = document.createElement("span");
                    badge.className = "optional-badge";
                    badge.textContent = "Optional";
                    labelEl.appendChild(document.createTextNode(" "));
                    labelEl.appendChild(badge);
                } else {
                    var reqInd = document.createElement("span");
                    reqInd.className = "required-indicator";
                    reqInd.setAttribute("aria-hidden", "true");
                    reqInd.textContent = "*";
                    labelEl.appendChild(reqInd);
                }
                group.appendChild(labelEl);

                var input = document.createElement("input");
                input.id = "field-" + key + "_" + idx;
                input.className = "field-input";
                input.setAttribute("type", type);
                input.setAttribute("name", key + "_" + idx);
                input.setAttribute("autocomplete", type === "email" ? "email" : (type === "password" ? "current-password" : "off"));
                input.setAttribute("autocorrect", "off");
                input.setAttribute("autocapitalize", "off");
                input.setAttribute("spellcheck", "false");
                input.dataset.role = key;
                if (placeholder) input.setAttribute("placeholder", placeholder);
                if (required) input.setAttribute("required", "required");
                group.appendChild(input);

                if (helpText) {
                    var help = document.createElement("p");
                    help.id = "help-" + key + "_" + idx;
                    help.className = "help-text";
                    input.setAttribute("aria-describedby", help.id);
                    if (helpUrl) {
                        var a = document.createElement("a");
                        a.setAttribute("href", helpUrl);
                        a.setAttribute("target", "_blank");
                        a.setAttribute("rel", "noopener noreferrer");
                        a.textContent = helpText;
                        help.appendChild(a);
                    } else {
                        help.textContent = helpText;
                    }
                    group.appendChild(help);
                }

                return { group: group, input: input };
            }

            function updateAccountNumbers() {
                var cards = container.querySelectorAll(".account-card");
                for (var i = 0; i < cards.length; i++) {
                    var titleEl = cards[i].querySelector(".account-title");
                    if (titleEl) titleEl.textContent = "Account " + (i + 1);
                    var removeBtn = cards[i].querySelector(".remove-btn");
                    if (removeBtn) {
                        removeBtn.style.display = i === 0 ? "none" : "";
                        removeBtn.setAttribute("aria-label", "Remove Account " + (i + 1));
                    }
                }
            }

            function renderDomainSpecificFields(extraContainer, idx, domain, state) {
                clearChildren(extraContainer);
                if (!domain) return;

                if (OAUTH_DOMAINS.indexOf(domain) !== -1) {
                    var notice = document.createElement("div");
                    notice.className = "notice";
                    notice.dataset.role = "oauth-notice";
                    notice.setAttribute("role", "status");
                    notice.setAttribute("aria-live", "polite");
                    notice.textContent =
                        "Outlook/Hotmail/Live requires OAuth2. This will be handled automatically by the server after you submit -- a Microsoft sign-in URL + code will appear here.";
                    extraContainer.appendChild(notice);
                    return;
                }

                if (Object.prototype.hasOwnProperty.call(APP_PASSWORD_DOMAINS, domain)) {
                    var info = APP_PASSWORD_DOMAINS[domain];
                    var pw = createFieldGroup({
                        idx: idx,
                        key: "password",
                        label: info.label,
                        type: "password",
                        placeholder: "",
                        required: true,
                        helpText: info.helpText,
                        helpUrl: info.helpUrl
                    });
                    if (state && state.password) pw.input.value = state.password;
                    extraContainer.appendChild(pw.group);
                    return;
                }

                var pwCustom = createFieldGroup({
                    idx: idx,
                    key: "password",
                    label: "Password",
                    type: "password",
                    placeholder: "",
                    required: true,
                    helpText: "",
                    helpUrl: ""
                });
                if (state && state.password) pwCustom.input.value = state.password;
                extraContainer.appendChild(pwCustom.group);

                var imap = createFieldGroup({
                    idx: idx,
                    key: "imap",
                    label: "IMAP Host",
                    type: "text",
                    placeholder: "imap.example.com",
                    required: false,
                    helpText: "Optional. Leave empty for auto-detection.",
                    helpUrl: ""
                });
                if (state && state.imap) imap.input.value = state.imap;
                extraContainer.appendChild(imap.group);
            }

            function createAccountCard(idx) {
                var card = document.createElement("div");
                card.className = "account-card";
                card.dataset.idx = String(idx);

                var header = document.createElement("div");
                header.className = "account-card-header";
                var title = document.createElement("h3");
                title.className = "account-title";
                title.textContent = "Account " + (idx + 1);
                header.appendChild(title);

                var removeBtn = document.createElement("button");
                removeBtn.type = "button";
                removeBtn.className = "remove-btn";
                removeBtn.textContent = "Remove";
                removeBtn.setAttribute("aria-label", "Remove Account " + (idx + 1));
                removeBtn.addEventListener("click", function () {
                    var inputs = card.querySelectorAll("input");
                    var hasData = false;
                    for (var i = 0; i < inputs.length; i++) {
                        if (inputs[i].value.trim() !== "") {
                            hasData = true;
                            break;
                        }
                    }
                    if (hasData && !window.confirm("This account has unsaved data. Are you sure you want to remove it?")) {
                        return;
                    }
                    card.remove();
                    updateAccountNumbers();
                });
                header.appendChild(removeBtn);
                card.appendChild(header);

                var emailField = createFieldGroup({
                    idx: idx,
                    key: "email",
                    label: "Email Address",
                    type: "email",
                    placeholder: "you@example.com",
                    required: true,
                    helpText: "",
                    helpUrl: ""
                });
                card.appendChild(emailField.group);

                var extra = document.createElement("div");
                extra.className = "extra-container";
                extra.dataset.role = "extra";
                card.appendChild(extra);

                var state = { password: "", imap: "" };

                emailField.input.addEventListener("input", function () {
                    var pwNode = extra.querySelector('input[data-role="password"]');
                    if (pwNode) state.password = pwNode.value;
                    var imapNode = extra.querySelector('input[data-role="imap"]');
                    if (imapNode) state.imap = imapNode.value;

                    var val = emailField.input.value;
                    var at = val.indexOf("@");
                    var domain = at >= 0 ? val.slice(at + 1).trim().toLowerCase() : "";
                    renderDomainSpecificFields(extra, idx, domain, state);
                });

                return card;
            }

            function collectAccounts() {
                var cards = container.querySelectorAll(".account-card");
                var accounts = [];
                var hasOauth = false;
                for (var i = 0; i < cards.length; i++) {
                    var card = cards[i];
                    var emailInput = card.querySelector('input[data-role="email"]');
                    var email = emailInput && emailInput.value ? emailInput.value.trim() : "";
                    if (!email) continue;

                    var at = email.indexOf("@");
                    var domain = at >= 0 ? email.slice(at + 1).toLowerCase() : "";

                    if (OAUTH_DOMAINS.indexOf(domain) !== -1) {
                        hasOauth = true;
                        // Outlook/Hotmail/Live: no password field. Server detects
                        // email-only entries and runs Device Code OAuth2.
                        accounts.push({ email: email, oauth: true });
                        continue;
                    }

                    var pwInput = card.querySelector('input[data-role="password"]');
                    var password = pwInput ? pwInput.value : "";
                    if (!password) continue;

                    var imapInput = card.querySelector('input[data-role="imap"]');
                    var imapHost = imapInput && imapInput.value ? imapInput.value.trim() : "";

                    accounts.push({ email: email, password: password, imapHost: imapHost });
                }
                return { accounts: accounts, hasOauth: hasOauth };
            }

            // Stashed from initial POST /authorize response so the device-code
            // completion poller can follow the OAuth redirect (external test
            // harness, Claude Code CLI, etc.) instead of leaving the browser
            // parked on a "close tab" message.
            var pendingRedirectUrl = null;

            function renderOAuthDeviceCode(nextStep) {
                statusBox.className = "status-box";
                statusBox.style.display = "block";
                while (statusBox.firstChild) statusBox.removeChild(statusBox.firstChild);

                var title = document.createElement("strong");
                title.textContent = "Finish Outlook sign-in";
                statusBox.appendChild(title);
                statusBox.appendChild(document.createElement("br"));
                statusBox.appendChild(document.createElement("br"));

                var label = document.createTextNode("Your browser should have opened the Microsoft sign-in page. If not, visit:");
                statusBox.appendChild(label);
                statusBox.appendChild(document.createElement("br"));

                var link = document.createElement("a");
                link.setAttribute("href", nextStep.verification_url);
                link.setAttribute("target", "_blank");
                link.setAttribute("rel", "noopener noreferrer");
                link.style.color = "#6c9bd2";
                link.style.fontWeight = "bold";
                link.textContent = nextStep.verification_url;
                statusBox.appendChild(link);
                statusBox.appendChild(document.createElement("br"));
                statusBox.appendChild(document.createElement("br"));

                statusBox.appendChild(document.createTextNode("Enter code: "));
                var codeEl = document.createElement("strong");
                codeEl.style.fontSize = "1.2em";
                codeEl.style.letterSpacing = "0.1em";
                codeEl.textContent = nextStep.user_code;
                statusBox.appendChild(codeEl);
                statusBox.appendChild(document.createElement("br"));
                statusBox.appendChild(document.createElement("br"));

                var waiting = document.createElement("span");
                waiting.id = "outlook-waiting";
                waiting.className = "pulse";
                waiting.style.color = "#9ca3af";
                waiting.textContent = "Waiting for Microsoft authorization...";
                statusBox.appendChild(waiting);

                // Poll /setup-status until outlook === "complete"
                var statusUrl = submitUrl.replace(/\\/authorize.*$/, "/setup-status");
                var pollId = setInterval(function () {
                    fetch(statusUrl)
                        .then(function (r) { return r.json(); })
                        .then(function (s) {
                            if (s && s.outlook === "complete") {
                                clearInterval(pollId);
                                statusBox.className = "status-box success";
                                while (statusBox.firstChild) statusBox.removeChild(statusBox.firstChild);
                                var done = document.createElement("strong");
                                done.textContent = "Setup complete!";
                                statusBox.appendChild(done);
                                statusBox.appendChild(document.createElement("br"));
                                statusBox.appendChild(document.createElement("br"));
                                submitBtn.textContent = "Connected";
                                if (typeof pendingRedirectUrl === "string" && pendingRedirectUrl.length > 0) {
                                    // Follow the OAuth redirect so external clients receive the
                                    // auth code. Without this the form stalls on "close tab" and
                                    // the client callback server hangs forever.
                                    statusBox.appendChild(document.createTextNode("Outlook authorized. Redirecting..."));
                                    window.location.replace(pendingRedirectUrl);
                                } else {
                                    statusBox.appendChild(document.createTextNode("Outlook authorized. You can close this tab."));
                                }
                            }
                        })
                        .catch(function () {});
                }, 3000);
            }

            // Seed first account card.
            container.appendChild(createAccountCard(accountIndex++));
            updateAccountNumbers();

            addBtn.addEventListener("click", function () {
                container.appendChild(createAccountCard(accountIndex++));
                updateAccountNumbers();
            });

            form.addEventListener("submit", function (evt) {
                evt.preventDefault();
                statusBox.style.display = "none";

                var collected = collectAccounts();

                if (collected.accounts.length === 0) {
                    showStatus(
                        "error",
                        "Please add at least one email account (Outlook email, or email + password for other providers)."
                    );
                    return;
                }

                var parts = [];
                for (var i = 0; i < collected.accounts.length; i++) {
                    var a = collected.accounts[i];
                    if (a.oauth) {
                        // Outlook/Hotmail/Live: just the email, server triggers
                        // Microsoft Device Code OAuth2 on receipt.
                        parts.push(a.email);
                    } else if (a.imapHost) {
                        parts.push(a.email + ":" + a.password + ":" + a.imapHost);
                    } else {
                        parts.push(a.email + ":" + a.password);
                    }
                }
                var payload = { EMAIL_CREDENTIALS: parts.join(",") };

                formFieldset.disabled = true;
                submitBtn.setAttribute("aria-busy", "true");
                submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Connecting...';

                fetch(submitUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                })
                    .then(function (resp) {
                        return resp.json().then(function (data) {
                            if (!data.ok) {
                                showStatus("error", data.error || data.error_description || "Request failed.");
                                formFieldset.disabled = false;
                                submitBtn.removeAttribute("aria-busy");
                                submitBtn.textContent = "Connect";
                                return;
                            }

                            // Stash the OAuth redirect target so follow-up async steps
                            // (device code poll, future OTP) can navigate to it when
                            // they complete instead of orphaning the client callback.
                            if (typeof data.redirect_url === "string" && data.redirect_url.length > 0) {
                                pendingRedirectUrl = data.redirect_url;
                            }

                            if (data.next_step && data.next_step.type === "oauth_device_code") {
                                submitBtn.innerHTML =
                                    '<span class="spinner" aria-hidden="true"></span> Awaiting Microsoft...';
                                submitBtn.removeAttribute("aria-busy");
                                renderOAuthDeviceCode(data.next_step);
                                return;
                            }

                            if (pendingRedirectUrl) {
                                // No interactive next step — follow the OAuth redirect now.
                                showStatus("success", "Credentials saved. Redirecting...");
                                submitBtn.textContent = "Connected";
                                submitBtn.removeAttribute("aria-busy");
                                window.location.replace(pendingRedirectUrl);
                                return;
                            }

                            showStatus("success", data.message || "Setup complete! You can close this tab.");
                            submitBtn.textContent = "Connected";
                            submitBtn.removeAttribute("aria-busy");
                        });
                    })
                    .catch(function (err) {
                        showStatus("error", "Network error: " + err.message);
                        formFieldset.disabled = false;
                        submitBtn.removeAttribute("aria-busy");
                        submitBtn.textContent = "Connect";
                    });
            });
        })();
    </script>
</body>
</html>`
}
