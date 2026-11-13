// Regenerates the README screenshots in docs/.
// Usage: node scripts/screenshots.js
//
// Loads the real, unpacked extension (this repo folder) in headless Chrome and
// drives it with Puppeteer on a made-up sign-up page (scripts/demo/signup.html)
// served from a throwaway local server. Chrome is told to resolve the demo
// hostname to that server, so the alias is built from a realistic site name.
// The bubble, the fill and the popup are the extension's own; the saved
// addresses are demo data.
//
// Puppeteer is not a dependency of this repo. The script picks it up from, in
// order: $PUPPETEER_DIR (a folder containing node_modules/puppeteer), this
// repo, then the sibling ../CrmLevel67 checkout. Anywhere else:
//   npm install --no-save puppeteer
const fs = require("fs");
const http = require("http");
const path = require("path");
const { createRequire } = require("module");

const root = path.join(__dirname, "..");
const docs = path.join(root, "docs");
const PORT = Number(process.env.PORT) || 6812;
const DEMO_HOST = "www.brightcart.example";
const DEMO_URL = `http://${DEMO_HOST}:${PORT}/signup`;
const EMAILS = ["jane.doe@gmail.com", "jane@doe-studio.example"];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function loadPuppeteer() {
  const bases = [process.env.PUPPETEER_DIR, root, path.join(root, "..", "CrmLevel67")];
  for (const base of bases.filter(Boolean)) {
    try {
      return createRequire(path.join(base, "noop.js"))("puppeteer");
    } catch { /* try the next location */ }
  }
  throw new Error("Puppeteer not found. Run: npm install --no-save puppeteer");
}

function serveDemoPage() {
  const html = fs.readFileSync(path.join(__dirname, "demo", "signup.html"));
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(html);
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

(async () => {
  const puppeteer = loadPuppeteer();
  fs.mkdirSync(docs, { recursive: true });
  const server = await serveDemoPage();
  const browser = await puppeteer.launch({
    enableExtensions: [root],
    args: [`--host-resolver-rules=MAP ${DEMO_HOST} 127.0.0.1`]
  });
  try {
    const worker = await browser.waitForTarget((t) => t.type() === "service_worker");
    const popupUrl = `chrome-extension://${new URL(worker.url()).host}/popup.html`;
    const shot = (target, name, options = {}) =>
      target.screenshot({ path: path.join(docs, name), ...options });

    // Demo addresses, saved the way the popup saves them.
    const setup = await browser.newPage();
    await setup.goto(popupUrl);
    await setup.evaluate((emails) => chrome.storage.sync.set({ emails, email: emails[0] }), EMAILS);
    await setup.close();

    // 1. Hero: the suggestion bubble under the email field of a sign-up form.
    const site = await browser.newPage();
    await site.setViewport({ width: 1200, height: 690, deviceScaleFactor: 1.5 });
    await site.goto(DEMO_URL);
    await site.bringToFront();
    await wait(400); // content script runs at document_idle
    await site.click("#email");
    await wait(500);
    await shot(site, "bubble.png");

    // 2. One click on the bubble: the field holds the alias.
    await site.mouse.click(...(await site.$eval(".gpa-chip", (el) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    })));
    await wait(120); // the fill flash is still on
    const form = await (await site.$("form")).boundingBox();
    await shot(site, "filled.png", {
      clip: { x: form.x - 28, y: form.y - 24, width: form.width + 56, height: form.height + 48 }
    });

    // 3 and 4. The toolbar popup. Opened in a tab at the popup's width, so the
    //    "current tab" it asks Chrome for is pointed at the demo site's tab.
    const popup = await browser.newPage();
    await popup.setViewport({ width: 360, height: 700, deviceScaleFactor: 2 });
    await popup.evaluateOnNewDocument((pattern) => {
      const query = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = () => query({ url: pattern });
    }, `*://${DEMO_HOST}/*`);
    await popup.goto(popupUrl);
    await popup.waitForSelector("#site:not([hidden])");
    await wait(300);
    const bottomOf = (selector) =>
      popup.$eval(selector, (el) => el.getBoundingClientRect().bottom + window.scrollY);
    const topOf = (selector) =>
      popup.$eval(selector, (el) => el.getBoundingClientRect().top + window.scrollY);
    // Top of the popup: saved addresses, alias for this site, fill and copy.
    await shot(popup, "popup.png", {
      clip: { x: 0, y: 0, width: 360, height: (await bottomOf("#site")) + 16 }
    });
    // Further down: the alias format section, with a custom pattern.
    await popup.click('input[name="tagStyle"][value="custom"]');
    await popup.focus("#customPattern");
    await popup.keyboard.type("-{year}"); // appended to the default {name}
    await popup.evaluate(() => document.activeElement.blur());
    await wait(300);
    const top = (await topOf("#format")) - 16;
    await shot(popup, "options.png", {
      clip: { x: 0, y: top, width: 360, height: (await bottomOf("#format")) + 16 - top }
    });

    console.log("screenshots written to docs/");
  } finally {
    await browser.close();
    server.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
