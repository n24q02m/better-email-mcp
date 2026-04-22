from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:44269/authorize?response_type=code&client_id=claude&redirect_uri=http://localhost")
    page.wait_for_timeout(500)

    # Just take a screenshot to see what's loaded
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")

if __name__ == "__main__":
    import os
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
