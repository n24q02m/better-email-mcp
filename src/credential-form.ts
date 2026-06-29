import type { RelayConfigSchema } from '@n24q02m/mcp-core'
import { escapeHtml } from './tools/helpers/html-utils.js'

/**
 * Renders the CSS styles for the credential form.
 */
function renderStyles(): string {
  return `
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
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1rem;
            padding-bottom: 0.75rem;
            border-bottom: 1px solid #2a2a2a;
        }
        .account-title { font-size: 0.8125rem; font-weight: 600; color: #fff; text-transform: uppercase; letter-spacing: 0.025em; }
        .remove-btn {
            background: transparent;
            border: none;
            color: #ef4444;
            font-size: 0.75rem;
            font-weight: 500;
            cursor: pointer;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            transition: background-color 0.2s;
        }
        .remove-btn:hover { background-color: rgba(239, 68, 68, 0.1); }
        .form-group { margin-bottom: 1.25rem; }
        .form-group:last-child { margin-bottom: 0; }
        label { display: block; font-size: 0.8125rem; font-weight: 500; color: #9ca3af; margin-bottom: 0.5rem; }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        input {
            width: 100%;
            background-color: #0f0f0f;
            border: 1px solid #2a2a2a;
            border-radius: 8px;
            padding: 0.625rem 0.875rem;
            color: #fff;
            font-size: 0.9375rem;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
        input::placeholder { color: #4b5563; }
        input.has-toggle { padding-right: 3.5rem; }
        .toggle-password-btn {
            position: absolute;
            right: 0.5rem;
            background: transparent;
            border: none;
            color: #3b82f6;
            font-size: 0.75rem;
            font-weight: 500;
            cursor: pointer;
            padding: 0.375rem 0.5rem;
            border-radius: 4px;
        }
        .toggle-password-btn:hover { background-color: rgba(59, 130, 246, 0.1); }
        .help-text { font-size: 0.75rem; color: #6b7280; margin-top: 0.375rem; }
        .help-text a { color: #3b82f6; text-decoration: none; }
        .help-text a:hover { text-decoration: underline; }
        .field-error { font-size: 0.75rem; color: #ef4444; margin-top: 0.375rem; display: none; }
        .field-error.active { display: block; }
        .add-btn {
            width: 100%;
            background-color: transparent;
            border: 1px dashed #2a2a2a;
            border-radius: 10px;
            padding: 0.875rem;
            color: #9ca3af;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            margin-bottom: 1.5rem;
            transition: all 0.2s;
        }
        .add-btn:hover { background-color: #121212; border-color: #4b5563; color: #fff; }
        .submit-btn {
            width: 100%;
            background-color: #fff;
            color: #000;
            border: none;
            border-radius: 10px;
            padding: 0.875rem;
            font-size: 0.9375rem;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s, transform 0.1s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        .submit-btn:hover { background-color: #e8e8e8; }
        .submit-btn:active { transform: scale(0.99); }
        .submit-btn:disabled { background-color: #2a2a2a; color: #6b7280; cursor: not-allowed; }
        .status-box {
            margin-top: 1.25rem;
            padding: 1rem;
            border-radius: 10px;
            font-size: 0.875rem;
            display: none;
        }
        .status-box.error { background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #fca5a5; display: block; }
        .status-box.success { background-color: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); color: #86efac; display: block; }
        .notice {
            background-color: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.2);
            border-radius: 8px;
            padding: 0.875rem;
            font-size: 0.8125rem;
            color: #93c5fd;
            margin-bottom: 1.25rem;
        }
        .spinner {
            width: 1rem;
            height: 1rem;
            border: 2px solid rgba(0, 0, 0, 0.1);
            border-top-color: currentColor;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        .copy-btn {
            background: #2a2a2a;
            border: 1px solid #3a3a3a;
            color: #fff;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            margin-left: 10px;
            vertical-align: middle;
        }
        .copy-btn:hover { background: #3a3a3a; }
        @media (prefers-reduced-motion: reduce) {
            .pulse, .spinner { animation: none; }
        }
`
}

/**
 * Renders the JavaScript scripts for the credential form.
 */
function renderScripts(submitUrlJson: string): string {
  return `
        (function () {
            var submitUrl = ${submitUrlJson};

            var OAUTH_DOMAINS = ["outlook.com", "hotmail.com", "live.com"];
            var APP_PASSWORD_DOMAINS = {
                "gmail.com": {
                    label: "App Password",
                    helpText: "How to generate a Google App Password",
                    helpUrl: "https://myaccount.google.com/apppasswords"
                },
                "googlemail.com": {
                    label: "App Password",
                    helpText: "How to generate a Google App Password",
                    helpUrl: "https://myaccount.google.com/apppasswords"
                },
                "yahoo.com": {
                    label: "App Password",
                    helpText: "How to generate a Yahoo App Password",
                    helpUrl: "https://help.yahoo.com/kb/SLN15241.html"
                },
                "icloud.com": {
                    label: "App Password",
                    helpText: "How to generate an iCloud App Password",
                    helpUrl: "https://support.apple.com/en-us/HT204397"
                }
            };

            var container = document.getElementById("accounts-container");
            var addBtn = document.getElementById("add-account-btn");
            var form = document.getElementById("credential-form");
            var formFieldset = document.getElementById("form-fieldset");
            var submitBtn = document.getElementById("submit-btn");
            var statusBox = document.getElementById("status-box");

            var accountIndex = 0;
            var pendingRedirectUrl = null;

            function clearChildren(el) {
                while (el.firstChild) el.removeChild(el.firstChild);
            }

            function showStatus(type, msg) {
                statusBox.textContent = msg;
                statusBox.className = "status-box " + type;
                statusBox.style.display = "block";
                statusBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }

            function collectAccounts() {
                var cards = container.querySelectorAll(".account-card");
                var accounts = [];
                for (var i = 0; i < cards.length; i++) {
                    var card = cards[i];
                    var idx = card.dataset.idx;
                    var email = card.querySelector('input[name="email_' + idx + '"]').value.trim();
                    if (!email) continue;

                    var domain = email.split("@")[1] || "";
                    var isOAuth = OAUTH_DOMAINS.indexOf(domain) !== -1;

                    if (isOAuth) {
                        accounts.push({ email: email, oauth: true });
                    } else {
                        var pass = card.querySelector('input[name="password_' + idx + '"]').value;
                        var imapHost = card.querySelector('input[name="imap_' + idx + '"]');
                        var imapPort = card.querySelector('input[name="imapport_' + idx + '"]');
                        accounts.push({
                            email: email,
                            password: pass,
                            imapHost: imapHost ? imapHost.value.trim() : "",
                            imapPort: imapPort ? imapPort.value.trim() : ""
                        });
                    }
                }
                return { accounts: accounts };
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

                const group = document.createElement("div");
                group.className = "form-group";

                const labelEl = document.createElement("label");
                labelEl.setAttribute("for", key + "_" + idx);
                labelEl.textContent = label;
                group.appendChild(labelEl);

                const input = document.createElement("input");
                input.id = key + "_" + idx;
                input.name = key + "_" + idx;
                input.type = type;
                input.placeholder = placeholder;
                if (required) input.required = true;

                if (type === "password") {
                    const wrapper = document.createElement("div");
                    wrapper.className = "input-wrapper";
                    input.className += " has-toggle";
                    wrapper.appendChild(input);

                    const toggleBtn = document.createElement("button");
                    toggleBtn.type = "button";
                    toggleBtn.className = "toggle-password-btn";
                    toggleBtn.textContent = "Show";
                    toggleBtn.setAttribute("aria-label", "Show password as plain text");
                    toggleBtn.setAttribute("aria-pressed", "false");
                    toggleBtn.addEventListener("click", function () {
                        const isPass = input.getAttribute("type") === "password";
                        input.setAttribute("type", isPass ? "text" : "password");
                        toggleBtn.textContent = isPass ? "Hide" : "Show";
                        toggleBtn.setAttribute("aria-label", isPass ? "Hide password" : "Show password as plain text");
                        toggleBtn.setAttribute("aria-pressed", isPass ? "true" : "false");
                    });
                    wrapper.appendChild(toggleBtn);
                    group.appendChild(wrapper);
                } else {
                    group.appendChild(input);
                }

                const errorEl = document.createElement("div");
                errorEl.id = "error-" + key + "_" + idx;
                errorEl.className = "field-error";
                errorEl.setAttribute("role", "alert");
                errorEl.setAttribute("aria-live", "polite");

                const describedBy = [errorEl.id];

                if (helpText) {
                    const help = document.createElement("p");
                    help.id = "help-" + key + "_" + idx;
                    help.className = "help-text";
                    describedBy.push(help.id);
                    if (helpUrl) {
                        const a = document.createElement("a");
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

                input.setAttribute("aria-describedby", describedBy.join(" "));
                group.appendChild(errorEl);

                input.addEventListener("invalid", function (event) {
                    event.preventDefault();
                    const inputEl = event.target;
                    inputEl.setAttribute("aria-invalid", "true");
                    if (inputEl.validity.valueMissing) {
                        errorEl.textContent = "This field is required.";
                    } else if (inputEl.validity.typeMismatch && inputEl.type === "email") {
                        errorEl.textContent = "Please enter a valid email address.";
                    } else {
                        errorEl.textContent = "Invalid value.";
                    }
                    errorEl.classList.add("active");
                });

                input.addEventListener("input", function (event) {
                    const inputEl = event.target;
                    if (inputEl.hasAttribute("aria-invalid")) {
                        inputEl.removeAttribute("aria-invalid");
                        errorEl.textContent = "";
                        errorEl.classList.remove("active");
                    }
                });

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
                    const pw = createFieldGroup({
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

                const pwCustom = createFieldGroup({
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

                const imap = createFieldGroup({
                    idx: idx,
                    key: "imap",
                    label: "IMAP Host",
                    type: "text",
                    placeholder: "imap.example.com",
                    required: false,
                    helpText: "Optional. Leave empty for auto-detection. Accepts localhost or a proxy host.",
                    helpUrl: ""
                });
                if (state && state.imap) imap.input.value = state.imap;
                extraContainer.appendChild(imap.group);

                const imapPort = createFieldGroup({
                    idx: idx,
                    key: "imapport",
                    label: "IMAP Port",
                    type: "text",
                    placeholder: "993",
                    required: false,
                    helpText: "Optional. Default 993. Set a custom port for a local IMAP proxy.",
                    helpUrl: ""
                });
                imapPort.input.setAttribute("inputmode", "numeric");
                if (state && state.imapPort) imapPort.input.value = state.imapPort;
                extraContainer.appendChild(imapPort.group);
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

                    var prev = card.previousElementSibling;
                    var next = card.nextElementSibling;
                    var focusTarget = (prev && prev.classList && prev.classList.contains("account-card")) ? prev :
                                      (next && next.classList && next.classList.contains("account-card")) ? next : null;

                    card.remove();
                    updateAccountNumbers();

                    // UX/a11y: Return focus to the previous or next card's first input if it exists,
                    // otherwise try the Add button. Creates a much smoother experience for keyboard users.
                    if (focusTarget) {
                        var firstInput = focusTarget.querySelector("input");
                        if (firstInput && firstInput instanceof HTMLElement) {
                            firstInput.focus();
                        }
                    } else if (addBtn) {
                        addBtn.focus();
                    }
                });
                header.appendChild(removeBtn);
                card.appendChild(header);

                var emailField = createFieldGroup({
                    idx: idx,
                    key: "email",
                    label: "Email Address",
                    type: "email",
                    placeholder: "user@example.com",
                    required: true
                });
                card.appendChild(emailField.group);

                var extraFields = document.createElement("div");
                card.appendChild(extraFields);

                emailField.input.addEventListener("input", function (e) {
                    var val = e.target.value.trim();
                    var domain = val.split("@")[1] || "";
                    renderDomainSpecificFields(extraFields, idx, domain);
                });

                return card;
            }

            function renderOAuthDeviceCode(nextStep) {
                // Clear the setup form and show device code instructions.
                formFieldset.disabled = false;
                statusBox.style.display = "block";
                statusBox.className = "status-box success";
                while (statusBox.firstChild) statusBox.removeChild(statusBox.firstChild);

                var title = document.createElement("strong");
                title.textContent = "Microsoft Authorization Required";
                statusBox.appendChild(title);
                statusBox.appendChild(document.createElement("br"));
                statusBox.appendChild(document.createElement("br"));

                var instructions = document.createElement("span");
                instructions.textContent = "1. Visit ";
                statusBox.appendChild(instructions);

                var link = document.createElement("a");
                link.href = nextStep.verification_url;
                link.target = "_blank";
                link.textContent = nextStep.verification_url;
                link.style.color = "#3b82f6";
                link.style.textDecoration = "underline";
                statusBox.appendChild(link);

                statusBox.appendChild(document.createTextNode(" in a new tab."));
                statusBox.appendChild(document.createElement("br"));
                statusBox.appendChild(document.createTextNode("2. Enter the following code:"));
                statusBox.appendChild(document.createElement("br"));
                statusBox.appendChild(document.createElement("br"));

                var codeEl = document.createElement("code");
                codeEl.style.display = "inline-block";
                codeEl.style.backgroundColor = "#000";
                codeEl.style.padding = "8px 12px";
                codeEl.style.borderRadius = "6px";
                codeEl.style.fontFamily = "monospace";
                codeEl.style.fontSize = "1.2em";
                codeEl.style.letterSpacing = "0.1em";
                codeEl.textContent = nextStep.user_code;
                statusBox.appendChild(codeEl);

                if (navigator.clipboard) {
                    var copyBtn = document.createElement("button");
                    copyBtn.type = "button";
                    copyBtn.textContent = "Copy";
                    copyBtn.className = "copy-btn";
                    copyBtn.setAttribute("aria-label", "Copy code to clipboard");
                    copyBtn.addEventListener("click", function () {
                        navigator.clipboard.writeText(nextStep.user_code).then(function () {
                            copyBtn.textContent = "Copied!";
                            copyBtn.setAttribute("aria-label", "Code copied to clipboard");
                            copyBtn.setAttribute("aria-live", "polite");
                            setTimeout(function () {
                                copyBtn.textContent = "Copy";
                                copyBtn.setAttribute("aria-label", "Copy code to clipboard");
                            }, 2000);
                        });
                    });
                    statusBox.appendChild(copyBtn);
                }

                statusBox.appendChild(document.createElement("br"));
                statusBox.appendChild(document.createElement("br"));

                var waiting = document.createElement("span");
                waiting.id = "outlook-waiting";
                waiting.className = "pulse";
                // a11y: announce the long-running "waiting for sign-in" status to
                // screen readers without interrupting (polite, not assertive).
                waiting.setAttribute("aria-live", "polite");
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
                var newCard = createAccountCard(accountIndex++);
                container.appendChild(newCard);
                updateAccountNumbers();

                // Immediately focus the first input field of the new card
                // so keyboard users can seamlessly start typing.
                var firstInput = newCard.querySelector("input");
                if (firstInput) firstInput.focus();
            });

            form.addEventListener("submit", function (evt) {
                evt.preventDefault();
                statusBox.style.display = "none";

                // a11y (WCAG 3.3.1 / 2.4.3): run native field validation on submit
                // and move focus to the first invalid field so keyboard /
                // screen-reader users land on the problem. The per-field "invalid"
                // handlers above paint the inline error + aria-invalid. The form
                // carries the novalidate attribute so this is the only validation gate.
                if (!form.checkValidity()) {
                    var firstInvalid = form.querySelector(":invalid");
                    if (firstInvalid instanceof HTMLElement) firstInvalid.focus();
                    return;
                }

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
                        var imapSpec = a.imapHost;
                        // Append the port unless the host field already carries one.
                        if (a.imapPort && imapSpec.indexOf(":") === -1) {
                            imapSpec = imapSpec + ":" + a.imapPort;
                        }
                        parts.push(a.email + ":" + a.password + ":" + imapSpec);
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
`
}

/**
 * Renders the main HTML content for the credential form.
 */
function renderMainContent(displayName: string, server: string, description: string): string {
  return `
    <main class="container">
        <div class="card">
            <div class="server-header">
                <h1 class="server-name">${displayName}</h1>
                <div class="server-id">${server}</div>
                <p class="server-description">${description}</p>
            </div>

            <h2 class="form-title" id="form-heading">Email Accounts</h2>

            <form id="credential-form" aria-labelledby="form-heading" novalidate>
                <fieldset id="form-fieldset" style="border: none; padding: 0; margin: 0;">
                    <div id="accounts-container"></div>

                    <button type="button" class="add-btn" id="add-account-btn">+ Add Another Account</button>

                    <button type="submit" class="submit-btn" id="submit-btn">Connect</button>
                </fieldset>

                <div class="status-box" id="status-box" role="alert"></div>
            </form>
        </div>
    </main>
`
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
  const submitUrlJson = JSON.stringify(options.submitUrl).replace(/</g, '\\u003c')

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'" />
    <title>${displayName}</title>
    <style>${renderStyles()}</style>
</head>
<body>
    ${renderMainContent(displayName, server, description)}
    <script>${renderScripts(submitUrlJson)}</script>
</body>
</html>`
}
