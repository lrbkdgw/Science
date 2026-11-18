import "./style.css";
import { brandMark, icon } from "./icons";
import { galaxies, imagePath, catalogLabel } from "./catalog";
import type { GalaxyScene, ViewSettings } from "./scene";

const $ = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const $$ = <T extends Element = HTMLElement>(selector: string) =>
  Array.from(document.querySelectorAll<T>(selector));
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const settings: ViewSettings = {
  auto: !reducedMotion,
  speed: 0.5,
  light: 80,
  marks: true,
  guides: true,
};
let scene: GalaxyScene | undefined;
let selected = 0,
  browsing = 0,
  currentZoom = 1;
let panelCollapsed = window.innerWidth <= 960;
let ambient = false,
  audio: AudioContext | null = null,
  masterGain: GainNode | null = null;
let dialogKind: "archive" | "guide" | "mark" | null = null;
let previousFocus: HTMLElement | null = null;
const btn = (action: string, svg: string, label: string, cls = "") =>
  `<button type="button" class="icon-btn ${cls}" data-action="${action}" aria-label="${label}" title="${label}">${icon(svg)}</button>`;
const switchControl = (action: string, label: string, glyph: string) =>
  `<button class="switch-row" data-action="${action}" type="button" role="switch" aria-checked="true"><span>${icon(glyph, 15)}${label}</span><i class="switch-track"><b></b></i></button>`;
const markHTML = (i: number) =>
  `<div class="sky-mark ${i ? "secondary" : "primary"}"><span class="mark-anchor"></span><svg class="mark-leader" viewBox="0 0 72 34" fill="none" aria-hidden="true"><path d="M1 33 30 4h41" stroke="currentColor" stroke-width=".8"/></svg><button class="mark-name" data-action="mark-${i}" title="查看天体标注"><span></span><small></small></button></div>`;
const number = (value: number) => `${value < 10 ? "0" : ""}${value}`;

$("#app").innerHTML = `
<div class="app-shell">
  <header class="topbar">
    <button class="brand" data-action="home" aria-label="ASTRA 观测台首页">${brandMark}<span><strong>ASTRA</strong><small>OBSERVATORY</small></span></button>
    <nav class="main-nav" aria-label="主导航">
      <button data-action="observatory" class="nav-item active" aria-current="page">${icon("compass", 16)}<span>观测台</span></button>
      <button data-action="archive" class="nav-item">${icon("layers", 16)}<span>星系图鉴</span></button>
      <button data-action="guide" class="nav-item">${icon("book", 16)}<span>观测指南</span></button>
    </nav>
    <div class="top-tools"><span class="online"><i class="led"></i>系统在线</span><i class="tool-divider"></i>${btn("sound", "mute", "开启空间音效", "sound-btn")}${btn("fullscreen", "expand", "进入全屏（F）", "fullscreen-btn")}</div>
  </header>
  <main class="observatory">
    <section class="stage" aria-label="交互式星系观测区">
      <div id="space-viewport" tabindex="0" aria-label="三维星系视图。拖动旋转，滚轮或双指缩放，双击重置。">
        <div class="sky-plate"></div>
        <div class="compat-orbits" aria-hidden="true"></div>
        <img class="fallback-galaxy" src="/assets/milky-way.webp" alt="" draggable="false" />
        <canvas id="space-canvas" aria-label="Three.js 三维星系"></canvas>
      </div>
      <div class="stage-shading"></div>
      <div class="object-info" aria-live="polite" aria-atomic="true">
        <div class="eyebrow"><i class="eyebrow-line"></i> GALAXY EXPLORER <span class="eyebrow-slash">/</span> <span id="object-index">001</span></div>
        <h1 id="object-title">Milky Way</h1>
        <div class="object-subtitle"><strong id="object-cn">银河系</strong><i></i><span id="object-type">棒旋星系</span><span id="object-class" class="class-tag">SBbc</span></div>
        <p id="object-intro" class="object-intro"></p>
        <div class="object-stats">
          <div><span class="stat-label">${icon("diameter", 13)}星系直径</span><p><b id="object-diameter">105,700</b><small>光年</small></p></div>
          <div><span class="stat-label">${icon("spark", 13)}恒星数量</span><p><b id="object-stars">≈ 2,000</b><small id="star-unit">亿颗</small></p></div>
        </div>
      </div>
      <div id="sky-marks">${markHTML(0)}${markHTML(1)}</div>
      <aside class="control-panel" aria-label="视图控制">
        <button class="panel-heading" data-action="panel" aria-controls="panel-body" aria-expanded="true"><span class="panel-title">${icon("sliders", 18)}<strong>视图控制</strong></span><span class="panel-chevron">${icon("down", 15)}</span></button>
        <div class="panel-body" id="panel-body">
          <div class="control-label"><span>观测视角</span><small>CAMERA</small></div>
          <div class="mode-switch" role="group" aria-label="观测视角"><button data-action="orbit" class="selected" aria-pressed="true">${icon("orbit", 15)}轨道视角</button><button data-action="top" aria-pressed="false">${icon("top", 15)}俯视视角</button></div>
          <div class="panel-rule"></div>
          ${switchControl("auto", "自动旋转", "rotate")}
          <div class="range-control"><label for="speed">旋转速度</label><output for="speed" id="speed-value">0.5×</output><input id="speed" type="range" min="0.1" max="1.5" step="0.1" value="0.5" aria-label="旋转速度" /></div>
          <div class="range-control"><label for="light">星尘亮度</label><output for="light" id="light-value">80%</output><input id="light" type="range" min="0" max="100" step="1" value="80" aria-label="星尘亮度" /></div>
          <div class="panel-rule"></div>
          ${switchControl("marks", "天体标注", "label")}
          <button class="reset-btn" data-action="reset">${icon("reset", 14)}<span>重置视图</span><kbd>R</kbd></button>
        </div>
      </aside>
      <div class="coords"><span class="coord-cross">${icon("crosshair", 21)}</span><div><span><b>RA</b><em id="right-ascension"></em></span><span><b>DEC</b><em id="declination"></em></span></div></div>
      <div class="view-toolbar"><div class="tool-island" role="group" aria-label="场景工具">
        ${btn("zoom-out", "minus", "缩小（−）")}<button class="zoom-value" data-action="zoom-reset" title="恢复 100% 缩放">100<span>%</span></button>${btn("zoom-in", "plus", "放大（+）")}
        <i></i>${btn("guides", "grid", "隐藏轨道辅助线", "guides-btn active")}${btn("capture", "camera", "保存观测影像")}
      </div><div class="interaction-hint">${icon("mouse", 12)}<span class="desktop-hint">拖动旋转 <b>·</b> 滚轮缩放</span><span class="touch-hint">单指旋转 <b>·</b> 双指缩放</span></div></div>
      <div class="gizmo-wrap"><svg id="axis-gizmo" width="60" height="53" viewBox="0 0 60 53" aria-hidden="true"><line x1="30" y1="27" x2="48" y2="32" stroke="#d19d85"/><text fill="#d19d85">X</text><line x1="30" y1="27" x2="12" y2="34" stroke="#91c8b7"/><text fill="#91c8b7">Y</text><line x1="30" y1="27" x2="30" y2="9" stroke="#a4a9d8"/><text fill="#a4a9d8">Z</text><circle cx="30" cy="27" r="2" fill="#aab7c4"/></svg><span>3D ORBIT</span></div>
    </section>
    <section class="galaxy-collection" aria-labelledby="collection-title">
      <div class="collection-heading"><h2 id="collection-title">${icon("collection", 15)} 星系导航</h2><span class="collection-en">GALAXY COLLECTION</span><div class="collection-pager"><span><b id="page-index">01</b> / 03</span>${btn("prev", "left", "上一个星系")}${btn("next", "right", "下一个星系")}</div></div>
      <div class="galaxy-cards" role="group" aria-label="选择观测星系">${galaxies.map((g, i) => `<button class="galaxy-card ${i === 0 ? "selected" : ""}" data-galaxy="${i}" aria-pressed="${i === 0}" aria-label="观测${g.name}"><span class="thumb-scene thumb-${g.id}"><img src="${imagePath(g, true)}" alt="" draggable="false"/></span><span class="card-copy"><small>${catalogLabel(g)}</small><strong>${g.name}</strong><span>${g.en}</span></span><span class="card-live"><i></i>观测中</span><span class="card-arrow">${icon("arrow-up-right", 16)}</span></button>`).join("")}</div>
    </section>
  </main>
  <footer class="statusbar"><div><span class="engine-status"><i class="led"></i><span id="engine-state">引擎启动中</span></span><i></i><span class="engine-name">THREE.JS <b>/</b> <span id="render-method">WEBGL</span></span></div><div><span class="status-observatory">ASTRA DEEP SPACE OBSERVATORY</span><i></i><span class="clock"><b>UTC</b> <time id="utc-time">00:00:00</time></span></div></footer>
</div>
<dialog id="observatory-dialog" aria-labelledby="dialog-title"><div id="dialog-content"></div></dialog>
<div class="toast" id="toast" role="status"></div>
`;

function renderGalaxy() {
  const g = galaxies[selected];
  $("#object-index").textContent = `0${g.number}`;
  $("#object-title").textContent = g.en;
  $("#object-cn").textContent = g.name;
  $("#object-type").textContent = g.type;
  $("#object-class").textContent = g.morphology;
  $("#object-intro").textContent = g.intro;
  $("#object-diameter").textContent = g.diameter;
  const stars = ["≈ 2,000", "≈ 10,000", "≈ 1,000"];
  $("#object-stars").textContent = stars[selected];
  $("#right-ascension").textContent = g.ra;
  $("#declination").textContent = g.dec;
  $("#page-index").textContent = g.number;
  $$(".sky-mark").forEach((el, i) => {
    el.querySelector(".mark-name span")!.textContent = g.marks[i].name;
    el.querySelector(".mark-name small")!.textContent = g.marks[i].code;
  });
  $$(".galaxy-card").forEach((card, i) => {
    card.classList.toggle("selected", i === selected);
    card.setAttribute("aria-pressed", String(i === selected));
  });
  $(".stage").dataset.galaxy = g.id;
}
function selectGalaxy(index: number) {
  selected = (index + galaxies.length) % galaxies.length;
  renderGalaxy();
  if (scene) void scene.setGalaxy(galaxies[selected]);
  else $(".fallback-galaxy").setAttribute("src", imagePath(galaxies[selected]));
  if (!reducedMotion)
    $(".object-info").animate(
      [
        { opacity: 0.2, transform: "translateY(5px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 320, easing: "ease-out" },
    );
  const row = $(".galaxy-cards"),
    card = $$(".galaxy-card")[selected];
  if (row.scrollWidth > row.clientWidth)
    row.scrollTo({
      left: card.offsetLeft - row.offsetLeft,
      behavior: reducedMotion ? "instant" : "smooth",
    });
}
function updateMode(mode: "orbit" | "top") {
  for (const name of ["orbit", "top"]) {
    const el = $(`[data-action="${name}"]`);
    el.classList.toggle("selected", name === mode);
    el.setAttribute("aria-pressed", String(name === mode));
  }
  $(".gizmo-wrap > span").textContent =
    mode === "top" ? "TOP VIEW" : "3D ORBIT";
}
function updateZoom(z: number) {
  currentZoom = z;
  $(".zoom-value").innerHTML = `${Math.round(z * 100)}<span>%</span>`;
  $<HTMLButtonElement>('[data-action="zoom-in"]').disabled = z >= 2;
  $<HTMLButtonElement>('[data-action="zoom-out"]').disabled = z <= 0.55;
}
function updatePanel() {
  $(".control-panel").classList.toggle("collapsed", panelCollapsed);
  $('[data-action="panel"]').setAttribute(
    "aria-expanded",
    String(!panelCollapsed),
  );
  $("#panel-body").hidden = panelCollapsed;
}
function updateSettings() {
  for (const name of ["auto", "marks"] as const)
    $(`[data-action="${name}"]`).setAttribute(
      "aria-checked",
      String(settings[name]),
    );
  const speed = $<HTMLInputElement>("#speed"),
    light = $<HTMLInputElement>("#light");
  speed.value = String(settings.speed);
  light.value = String(settings.light);
  speed.disabled = !settings.auto;
  for (const el of [speed, light])
    el.style.setProperty(
      "--fill",
      `${((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) * 100}%`,
    );
  $("#speed-value").textContent = `${settings.speed.toFixed(1)}×`;
  $("#light-value").textContent = `${settings.light}%`;
  $("#sky-marks").hidden = !settings.marks;
  const guides = $('[data-action="guides"]');
  guides.classList.toggle("active", settings.guides);
  guides.setAttribute("aria-pressed", String(settings.guides));
  guides.title =
    guides.ariaLabel = `${settings.guides ? "隐藏" : "显示"}轨道辅助线`;
}
let toastTimer: ReturnType<typeof setTimeout>;
function notify(message: string) {
  const toast = $("#toast");
  toast.innerHTML = `${icon("check", 14)}<span>${message}</span>`;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2400);
}
const dialog = $<HTMLDialogElement>("#observatory-dialog");
function setActiveNav(action: string) {
  $$(".nav-item").forEach((el) => {
    const active = el.dataset.action === action;
    el.classList.toggle("active", active);
    if (active) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
}
function openDialog(kind: "archive" | "guide" | "mark") {
  dialogKind = kind;
  dialog.dataset.kind = kind;
  if (!dialog.open) {
    previousFocus = document.activeElement as HTMLElement;
    dialog.showModal();
  }
  if (scene) scene.suspended = true;
  setActiveNav(kind === "mark" ? "observatory" : kind);
  document.body.classList.add("dialog-open");
  $<HTMLButtonElement>('#dialog-content [data-action="close"]')?.focus({
    preventScroll: true,
  });
}
function closeDialog() {
  if (dialog.open) dialog.close();
}
dialog.addEventListener("close", () => {
  dialogKind = null;
  if (scene) scene.suspended = false;
  document.body.classList.remove("dialog-open");
  setActiveNav("observatory");
  previousFocus?.focus({ preventScroll: true });
});
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeDialog();
  }
});
const closeButton = () => btn("close", "close", "关闭窗口", "dialog-close");
function archiveContent() {
  const g = galaxies[browsing];
  $("#dialog-content").innerHTML =
    `<div class="dialog-top"><span class="eyebrow"><i class="eyebrow-line"></i> CELESTIAL ARCHIVE</span>${closeButton()}</div><div class="dialog-heading"><h2 id="dialog-title">星系图鉴</h2><p>本地星系目录 <span>/</span> 03 个观测目标</p></div>
    <div class="archive-tabs" role="group" aria-label="浏览星系档案">${galaxies.map((item, i) => `<button data-browse="${i}" class="${i === browsing ? "selected" : ""}" aria-pressed="${i === browsing}"><small>${item.number}</small> ${item.name}</button>`).join("")}</div>
    <div class="archive-photo"><img src="${imagePath(g, true)}" alt="${g.name}的星盘和旋臂示意图"/><span>${catalogLabel(g)}</span><b>${g.en}</b></div><div class="archive-body"><div class="archive-title"><h3>${g.name}</h3><span class="type-chip">${g.type}</span></div><p class="galaxy-note">${g.note}</p><dl class="archive-data"><div><dt>星系直径</dt><dd>${g.diameter} <small>光年</small></dd></div><div><dt>恒星数量</dt><dd>${g.stars}</dd></div><div><dt>观测距离</dt><dd>${g.distance}</dd></div></dl><div class="archive-bottom"><span>数值为近似估计 · 星系外观为艺术重建</span><button class="primary-btn" data-action="observe">进入观测 ${icon("arrow-right", 15)}</button></div></div>`;
}
function openArchive() {
  browsing = selected;
  archiveContent();
  openDialog("archive");
}
function openGuide() {
  $("#dialog-content").innerHTML =
    `<div class="dialog-top"><span class="eyebrow"><i class="eyebrow-line"></i> FIELD MANUAL</span>${closeButton()}</div><div class="dialog-heading"><h2 id="dialog-title">观测指南</h2><p>熟悉观测台，开始你的深空探索。</p></div>
    <div class="manual-section"><h3>${icon("mouse", 16)} 探索星系</h3><div class="manual-row"><span>环绕与倾斜</span><strong>按住拖动 <i>/</i> 单指滑动</strong></div><div class="manual-row"><span>靠近与远离</span><strong>滚动滚轮 <i>/</i> 双指捏合</strong></div><div class="manual-row"><span>回到初始视角</span><strong>双击星空</strong></div><div class="manual-row"><span>了解天体</span><strong>点击星系上的标注</strong></div></div>
    <div class="manual-section"><h3>${icon("keyboard", 17)} 键盘快捷键</h3><div class="shortcut-grid">${[
      ["切换星系", "← →"],
      ["调整缩放", "− +"],
      ["暂停 / 继续", "Space"],
      ["重置视图", "R"],
      ["切换全屏", "F"],
      ["关闭窗口", "Esc"],
    ]
      .map(
        ([label, key]) => `<div><span>${label}</span><kbd>${key}</kbd></div>`,
      )
      .join("")}</div></div>
    <div class="manual-note">${icon("info", 17)}<p>星系由体积星尘与三维恒星粒子共同呈现。时间、颜色与空间比例为观测而优化，并非实时天文影像。</p></div><button class="primary-btn guide-done" data-action="close">开始探索 ${icon("arrow-right", 15)}</button>`;
  openDialog("guide");
}
function openMark(i: number) {
  const g = galaxies[selected],
    mark = g.marks[i];
  $("#dialog-content").innerHTML =
    `<div class="dialog-top"><span class="eyebrow"><i class="eyebrow-line"></i> OBJECT ANNOTATION</span>${closeButton()}</div><div class="marker-illustration">${icon(i ? "orbit" : "crosshair", 54)}</div><div class="dialog-heading"><span class="mark-code">${g.name} &nbsp;/&nbsp; ${mark.code}</span><h2 id="dialog-title">${mark.name}</h2></div><p class="marker-note">${mark.note}</p><button class="primary-btn" data-action="close">返回观测 ${icon("arrow-right", 14)}</button>`;
  openDialog("mark");
}
async function toggleSound() {
  try {
    if (!audio) {
      audio = new AudioContext();
      masterGain = audio.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(audio.destination);
      [55, 82.407, 110.08, 164.81].forEach((freq, i) => {
        const osc = audio!.createOscillator(),
          voice = audio!.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        voice.gain.value = [0.38, 0.17, 0.11, 0.055][i];
        osc.connect(voice).connect(masterGain!);
        osc.start();
        const lfo = audio!.createOscillator(),
          amount = audio!.createGain();
        lfo.frequency.value = 0.045 + i * 0.012;
        amount.gain.value = 0.13;
        lfo.connect(amount).connect(osc.frequency);
        lfo.start();
      });
    }
    ambient = !ambient;
    if (ambient) await audio.resume();
    masterGain!.gain.cancelScheduledValues(audio.currentTime);
    masterGain!.gain.setTargetAtTime(
      ambient ? 0.16 : 0,
      audio.currentTime,
      0.28,
    );
    if (!ambient)
      setTimeout(() => {
        if (!ambient) void audio?.suspend();
      }, 1300);
    const b = $('[data-action="sound"]');
    b.classList.toggle("active", ambient);
    b.setAttribute("aria-pressed", String(ambient));
    b.innerHTML = icon(ambient ? "volume" : "mute");
    b.title = b.ariaLabel = ambient ? "关闭空间音效" : "开启空间音效";
    notify(ambient ? "空间音效已开启" : "空间音效已关闭");
  } catch {
    ambient = false;
    notify("当前浏览器不支持空间音效");
  }
}
async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    fullscreenUI();
    return;
  }
  if (document.body.classList.contains("focus-view")) {
    document.body.classList.remove("focus-view");
    fullscreenUI();
    return;
  }
  try {
    await document.documentElement.requestFullscreen();
    fullscreenUI();
  } catch {
    document.body.classList.add("focus-view");
    fullscreenUI();
    notify("已进入沉浸视图 · 按 F 或 Esc 退出");
  }
}
function fullscreenUI() {
  const active =
    !!document.fullscreenElement ||
    document.body.classList.contains("focus-view");
  const b = $('[data-action="fullscreen"]');
  b.innerHTML = icon(active ? "shrink" : "expand");
  b.title = b.ariaLabel = active ? "退出全屏（F）" : "进入全屏（F）";
  b.setAttribute("aria-pressed", String(active));
}
document.addEventListener("fullscreenchange", fullscreenUI);
document.addEventListener("visibilitychange", () => {
  if (audio && ambient) {
    if (document.hidden) void audio.suspend();
    else void audio.resume();
  }
});
async function action(name: string) {
  switch (name) {
    case "home":
      closeDialog();
      selectGalaxy(0);
      break;
    case "observatory":
      closeDialog();
      break;
    case "archive":
      openArchive();
      break;
    case "guide":
      openGuide();
      break;
    case "close":
      closeDialog();
      break;
    case "observe":
      closeDialog();
      selectGalaxy(browsing);
      break;
    case "prev":
      selectGalaxy(selected - 1);
      break;
    case "next":
      selectGalaxy(selected + 1);
      break;
    case "panel":
      panelCollapsed = !panelCollapsed;
      updatePanel();
      break;
    case "auto":
      settings.auto = !settings.auto;
      updateSettings();
      break;
    case "marks":
      settings.marks = !settings.marks;
      updateSettings();
      break;
    case "guides":
      settings.guides = !settings.guides;
      updateSettings();
      break;
    case "orbit":
    case "top":
      scene?.setMode(name);
      break;
    case "reset":
      scene?.reset();
      notify("已恢复初始视角");
      break;
    case "zoom-in":
      scene?.zoomBy(0.15);
      break;
    case "zoom-out":
      scene?.zoomBy(-0.15);
      break;
    case "zoom-reset":
      if (currentZoom !== 1) scene?.setZoom(1);
      break;
    case "sound":
      await toggleSound();
      break;
    case "fullscreen":
      await toggleFullscreen();
      break;
    case "capture":
      if (scene) {
        try {
          await scene.saveImage();
          notify("观测影像已导出为 PNG");
        } catch {
          notify("影像保存失败，请重试");
        }
      }
      break;
    case "mark-0":
    case "mark-1":
      openMark(Number(name.slice(-1)));
      break;
  }
}
document.addEventListener("click", (e) => {
  const button = (e.target as Element).closest<HTMLButtonElement>("button");
  if (!button || button.disabled) return;
  if (button.dataset.galaxy !== undefined)
    selectGalaxy(Number(button.dataset.galaxy));
  else if (button.dataset.browse !== undefined) {
    browsing = Number(button.dataset.browse);
    archiveContent();
    $<HTMLButtonElement>(`[data-browse="${browsing}"]`).focus();
  } else if (button.dataset.action) void action(button.dataset.action);
});
for (const key of ["speed", "light"] as const)
  $<HTMLInputElement>(`#${key}`).addEventListener("input", (e) => {
    settings[key] = Number((e.target as HTMLInputElement).value);
    updateSettings();
  });
document.addEventListener("keydown", (e) => {
  if (
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    dialog.open ||
    (e.target as HTMLElement).closest("input, textarea, select")
  )
    return;
  const actions: Record<string, string> = {
    ArrowLeft: "prev",
    ArrowRight: "next",
    "+": "zoom-in",
    "=": "zoom-in",
    "-": "zoom-out",
    r: "reset",
    f: "fullscreen",
  };
  if (e.key === " " && !(e.target as HTMLElement).closest("button")) {
    e.preventDefault();
    void action("auto");
  } else if (actions[e.key] || actions[e.key.toLowerCase()]) {
    e.preventDefault();
    void action(actions[e.key] || actions[e.key.toLowerCase()]);
  } else if (
    e.key === "Escape" &&
    document.body.classList.contains("focus-view")
  )
    void toggleFullscreen();
});
const smallScreen = matchMedia("(max-width: 960px)");
smallScreen.addEventListener("change", (e) => {
  panelCollapsed = e.matches;
  updatePanel();
});
renderGalaxy();
updateSettings();
updatePanel();
fullscreenUI();
$('[data-action="sound"]').setAttribute("aria-pressed", "false");
function tick() {
  const now = new Date();
  $("#utc-time").textContent =
    `${number(now.getUTCHours())}:${number(now.getUTCMinutes())}:${number(now.getUTCSeconds())}`;
}
tick();
setInterval(tick, 1000);
void import("./scene").then(({ GalaxyScene }) => {
  scene = new GalaxyScene($("#space-viewport"), settings, {
    zoom: updateZoom,
    mode: updateMode,
    ready(gl) {
      $("#render-method").textContent = gl ? "WEBGL 2.0" : "2D VIEW";
      $("#engine-state").textContent = gl ? "渲染引擎就绪" : "兼容视图就绪";
      $(".stage").classList.add("scene-ready");
    },
  });
  if (selected !== 0) void scene.setGalaxy(galaxies[selected]);
  scene.suspended = dialogKind !== null;
});
