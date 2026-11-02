import fs from "node:fs";
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  colorScheme: "dark",
});
await page.goto("http://127.0.0.1:4317", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);

const zh = await page.locator(".native-status").innerText();
await page.locator(".topbar").screenshot({ path: "qa/evidence/native/01-web-topbar-zh.png" });

await page.locator(".lang-switch").click();
await page.waitForTimeout(600);
const en = await page.locator(".native-status").innerText();
await page.locator(".topbar").screenshot({ path: "qa/evidence/native/02-web-topbar-en.png" });

await page.locator(".lang-switch").click();
await page.waitForTimeout(400);

const result = { chineseStatus: zh, englishStatus: en, toggleWorked: zh !== en };
fs.writeFileSync("qa/evidence/native/web-status.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
