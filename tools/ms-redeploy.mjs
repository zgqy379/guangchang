// 用已保存的 ModelScope 登录 cookie 注入 egolite，在设置页点“重新部署→确认部署”。
const fs = await import("node:fs");
const task = await taskSpace("ms-redeploy");
const page = task.page("p1");
await page.cdp("Network.enable");
const cookies = JSON.parse(fs.readFileSync("C:/Users/dqy/AppData/Local/Temp/ms-cookies.json", "utf8"));
for (const c of cookies) {
  await page.cdp("Network.setCookie", { name: c.name, value: c.value, domain: c.domain, path: c.path || "/", secure: !!c.secure, url: "https://modelscope.cn" }).catch(() => {});
}
await page.goto("https://modelscope.cn/studios/zgqy379/guangchang3d/settings");
await page.waitForTimeout(6000);
const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll("div,button,span")].find((e) => (e.textContent || "").trim() === "重新部署" && e.offsetParent);
  if (el) { el.click(); return true; }
  return false;
});
console.log("redeploy clicked", clicked);
await page.waitForTimeout(2500);
const confirmed = await page.evaluate(() => {
  const el = [...document.querySelectorAll("button,div,span")].find((e) => (e.textContent || "").trim() === "确认部署" && e.offsetParent);
  if (el) { el.click(); return true; }
  return false;
});
console.log("confirm clicked", confirmed);
await page.waitForTimeout(6000);
console.log("submitted:", await page.evaluate(() => document.body.innerText.includes("重新部署已提交")));
