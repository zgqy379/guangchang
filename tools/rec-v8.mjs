// Demo 视频采集 v8：HUD + 参数碑 + 真 HR 版本
// 街区鸟瞰 → 落地越肩 → 投递结算 → 对比篮 A/B → 办公室 3DGS → 四区巡游
const task = await taskSpace("guangchang-video-v8");
const page = task.page("p1");
const fs = await import("node:fs");
const path = await import("node:path");

const OUT = "E:/guangchang/docs/video/frames";
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.startsWith("f_")) fs.unlinkSync(path.join(OUT, f));

let frameIndex = 0;
const frameTimes = [];
const sceneMarks = [];
const events = {};
async function drain() {
  const evs = await page.events();
  for (const e of evs) {
    if (e && e.method === "Page.screencastFrame" && e.params && e.params.data) {
      fs.writeFileSync(path.join(OUT, `f_${String(frameIndex).padStart(4, "0")}.jpg`), Buffer.from(e.params.data, "base64"));
      if (e.params.metadata && typeof e.params.metadata.timestamp === "number") frameTimes.push(e.params.metadata.timestamp);
      else frameTimes.push(Date.now() / 1000);
      frameIndex += 1;
      await page.cdp("Page.screencastFrameAck", { sessionId: e.params.sessionId }).catch(() => {});
    }
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function hold(ms, step = 350) {
  for (let t = 0; t < ms; t += step) { await wait(Math.min(step, ms - t)); await drain(); }
}
async function waitStreetOpen(timeout = 35000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const ok = await page.evaluate(() => {
      const txt = document.body.innerText || "";
      return !txt.includes("招聘街区搭建中") && !!document.querySelector(".street-cta");
    }).catch(() => false);
    if (ok) return true;
    await wait(500);
  }
  return false;
}

async function waitForText(sel, prefix, timeout = 40000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const ok = await page.evaluate(([s, p]) => (document.querySelector(s)?.textContent || "").startsWith(p), [sel, prefix]).catch(() => false);
    if (ok) return true;
    await wait(500);
  }
  return false;
}

async function waitFor(sel, timeout = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const ok = await page.evaluate((s) => !!document.querySelector(s), sel).catch(() => false);
    if (ok) return true;
    await wait(400);
  }
  return false;
}

await page.cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await page.goto("http://localhost:4173/?v=hud-v8");
await wait(5000);
await page.evaluate(() => localStorage.removeItem("gc-street-progress-v1"));

await page.click("text=招聘街区");
const ready = await waitStreetOpen(35000);
console.log("street ready:", ready);

await wait(1200);
await page.cdp("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: 1280, maxHeight: 720 });
await hold(600);

// A 街区鸟瞰：参数碑 + HUD
sceneMarks.push({ frameIndex: frameIndex, label: "street" });
await hold(2800);

// B 落地越肩：走近摊位，自动 3/4 特写
sceneMarks.push({ frameIndex: frameIndex, label: "roam" });
await page.click(".street-cta");
await hold(2600);
const c = await page.evaluate(() => {
  const r = document.querySelector("canvas").getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
await page.mouse.click(c.x + 150, c.y + 70, { label: "walk toward booths" });
await hold(3400);

// C 投递：XP/四区进度/飞袋金光
sceneMarks.push({ frameIndex: frameIndex, label: "deliver" });
await page.evaluate(() => {
  const b = [...document.querySelectorAll(".lot-card-actions button")].find((x) => (x.textContent || "").includes("投简历"));
  b?.click();
});
await hold(2600);

// D 对比篮 → A/B 并排
sceneMarks.push({ frameIndex: frameIndex, label: "basket" });
await page.evaluate(() => {
  const b = [...document.querySelectorAll(".lot-card-actions button")].find((x) => (x.textContent || "").includes("对比"));
  b?.click();
});
await hold(800);
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").includes("对比篮"));
  b?.click();
});
await hold(3600);

// E 回街区（剪掉重载遮罩）
events.returnClickAt = Date.now() / 1000;
await page.click("text=招聘街区");
const reopened = await waitStreetOpen(30000);
events.streetReadyAt = Date.now() / 1000;
console.log("street reopened:", reopened);
await hold(3000);

// F 四区巡游：先落回第三人称，再看小地图传送
sceneMarks.push({ frameIndex: frameIndex, label: "tour" });
await page.click(".street-cta");
await hold(2400);
await page.evaluate(() => {
  const b = [...document.querySelectorAll(".nav-pill")].find((x) => (x.textContent || "").includes("文创"));
  b?.click();
});
await hold(2200);
await page.evaluate(() => {
  const b = [...document.querySelectorAll(".nav-pill")].find((x) => (x.textContent || "").includes("金融"));
  b?.click();
});
await hold(2600);

await page.cdp("Page.stopScreencast", {});
await drain();

fs.writeFileSync("E:/guangchang/docs/video/scene-marks-v8.json", JSON.stringify(sceneMarks, null, 1));
fs.writeFileSync("E:/guangchang/docs/video/frames-times-v8.json", JSON.stringify(frameTimes));
fs.writeFileSync("E:/guangchang/docs/video/scene-events-v8.json", JSON.stringify(events, null, 1));
console.log("FRAMES:", frameIndex, "| marks:", JSON.stringify(sceneMarks));
