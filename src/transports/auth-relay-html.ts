/**
 * Renders the HTML for the email credential relay sign-in page.
 *
 * @param state - The OAuth2 state parameter to be sent back with credentials.
 * @returns The complete HTML document as a string.
 */
export function renderAuthRelayPage(state: string): string {
  // Safe JSON serialization for use in inline script to prevent XSS.
  // We replace < with its unicode equivalent to prevent premature script tag closure.
  const safeState = JSON.stringify(state).replace(/</g, '\\u003c')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Email MCP - Sign In</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f5f5f5; min-height: 100vh;
           display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .card { background: white; border-radius: 12px; padding: 2rem; max-width: 480px; width: 100%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #666; font-size: 0.875rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem; }
    input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 6px;
            font-size: 0.875rem; margin-bottom: 1rem; }
    input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.2); }
    button { width: 100%; padding: 0.625rem; background: #2563eb; color: white; border: none;
             border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    button:disabled { background: #93c5fd; cursor: not-allowed; }
    .error { color: #dc2626; font-size: 0.8rem; margin-bottom: 1rem; display: none; }
    .help { color: #666; font-size: 0.75rem; margin-top: -0.5rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Email MCP Server</h1>
    <p>Enter your email credentials to connect. Use an App Password for Gmail/Yahoo/iCloud.</p>
    <div class="error" id="error"></div>
    <form id="form">
      <label for="credentials">Email Credentials</label>
      <input type="text" id="credentials" name="credentials" required
             placeholder="user@gmail.com:app-password" autocomplete="off">
      <div class="help">Format: email:password. Multiple: email1:pass1,email2:pass2</div>
      <button type="submit" id="submit">Connect</button>
    </form>
  </div>
  <script>
    const form = document.getElementById('form');
    const btn = document.getElementById('submit');
    const errEl = document.getElementById('error');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'Validating...';
      errEl.style.display = 'none';
      try {
        const res = await fetch('/auth/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: ${safeState},
            credentials: document.getElementById('credentials').value
          })
        });
        const data = await res.json();
        if (data.redirect) {
          window.location.href = data.redirect;
        } else {
          errEl.textContent = data.error_description || data.error || 'Unknown error';
          errEl.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Connect';
        }
      } catch (err) {
        errEl.textContent = 'Network error. Please try again.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Connect';
      }
    });
  </script>
</body>
</html>`
}
