// 用已保存的 ModelScope 登录 cookie 注入 egolite，在设置页点“重新部署→确认部署”。
//
// 约定：任一关键步骤失败 → process.exit(1)，避免"静默成功"（供 agent/CI 判定成败）。
// 运行：ego-browser nodejs < tools/ms-redeploy.mjs
const fs = await import("node:fs");

const COOKIE_PATH = "C:/Users/dqy/AppData/Local/Temp/ms-cookies.json";

function fail(msg) {
  console.error(`✗ ms-redeploy 失败：${msg}`);
  process.exit(1);
}

try {
  // 1) cookie 文件存在性 + 可解析性检查（旧版直接 readFileSync，缺失时抛栈、无退出码语义）
  if (!fs.existsSync(COOKIE_PATH)) {
    fail(`cookie 文件不存在：${COOKIE_PATH}（先导出魔搭登录态，见 docs/lessons.md §7.4）`);
  }
  let cookies;
  try {
    cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf8"));
  } catch (e) {
    fail(`cookie 文件读取/解析失败：${COOKIE_PATH} → ${e?.message ?? e}`);
  }
  if (!Array.isArray(cookies) || cookies.length === 0) {
    fail(`cookie 文件为空或格式不是数组：${COOKIE_PATH}`);
  }

  const task = await taskSpace("ms-redeploy");
  const page = task.page("p1");
  await page.cdp("Network.enable");

  // 2) 注入登录 cookie —— 不吞错：任一注入失败即中断（登录态不完整会导致后续点击无效，
  //    旧版 `.catch(() => {})` 把失败悄悄咽掉）
  for (const c of cookies) {
    await page.cdp("Network.setCookie", {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || "/",
      secure: !!c.secure,
      url: "https://modelscope.cn",
    });
  }

  await page.goto("https://modelscope.cn/studios/zgqy379/guangchang3d/settings");
  await page.waitForTimeout(6000);

  // 3) 点「重新部署」
  const clicked = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div,button,span")].find(
      (e) => (e.textContent || "").trim() === "重新部署" && e.offsetParent,
    );
    if (el) { el.click(); return true; }
    return false;
  });
  console.log("redeploy clicked", clicked);
  if (!clicked) fail("找不到「重新部署」按钮（登录态失效或页面结构变更）");

  // 4) 点「确认部署」
  await page.waitForTimeout(2500);
  const confirmed = await page.evaluate(() => {
    const el = [...document.querySelectorAll("button,div,span")].find(
      (e) => (e.textContent || "").trim() === "确认部署" && e.offsetParent,
    );
    if (el) { el.click(); return true; }
    return false;
  });
  console.log("confirm clicked", confirmed);
  if (!confirmed) fail("找不到「确认部署」按钮");

  // 5) 校验提交回执
  await page.waitForTimeout(6000);
  const submitted = await page.evaluate(() => document.body.innerText.includes("重新部署已提交"));
  console.log("submitted:", submitted);
  if (!submitted) fail("未检测到「重新部署已提交」文案（部署可能未提交成功）");

  console.log("✓ ms-redeploy 完成：已提交重新部署");
} catch (e) {
  fail(e?.stack ?? String(e));
}