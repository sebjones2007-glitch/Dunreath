// Dunreath desktop app. It opens the live game, so every update pushed to
// GitHub Pages reaches players the next time they start the app.
const { app, BrowserWindow, Menu, session, shell } = require("electron");
const path = require("path");

const GAME_URL = "https://sebjones2007-glitch.github.io/Dunreath/";
const GAME_ORIGIN = new URL(GAME_URL).origin;
const GAME_PATH = new URL(GAME_URL).pathname;

let win = null;
let pendingLink = null;

// Email sign-in links come back as dunreath://auth#access_token=... The
// part after "auth" is handed to the game page, which finishes signing in.
const LINK_PREFIX = "dunreath://auth";
function linkTarget(url) {
  if (typeof url !== "string" || !url.startsWith(LINK_PREFIX)) return null;
  // A fresh query string forces a full page load even when the game is
  // already open, so the game reads the new sign-in details.
  const hash = url.indexOf("#");
  return GAME_URL + "?signin=" + Date.now() + (hash < 0 ? "" : url.slice(hash));
}
function openLink(url) {
  const target = linkTarget(url);
  if (!target) return;
  if (!win) { pendingLink = target; return }
  win.loadURL(target);
  if (win.isMinimized()) win.restore();
  win.focus();
}
const linkInArgs = argv => argv.find(a => typeof a === "string" && a.startsWith(LINK_PREFIX));

const isGamePage = url => {
  try { const u = new URL(url); return u.origin === GAME_ORIGIN && u.pathname.startsWith(GAME_PATH) }
  catch { return false }
};

function loadGame() {
  win.loadURL(pendingLink || GAME_URL);
  pendingLink = null;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: "Dunreath",
    backgroundColor: "#2C2017",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  win.webContents.setUserAgent(win.webContents.getUserAgent() + " DunreathDesktop");
  win.once("ready-to-show", () => win.show());

  // Links to anything outside the game open in the player's own browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("file:") || isGamePage(url)) return;
    e.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });

  // No connection: show a period-styled notice with a retry button.
  win.webContents.on("did-fail-load", (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    win.loadFile(path.join(__dirname, "offline.html"));
  });
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") { win.setFullScreen(!win.isFullScreen()); e.preventDefault() }
    if (input.key === "r" && (input.control || input.meta) && win.webContents.getURL().startsWith("file:")) { loadGame(); e.preventDefault() }
  });

  // offline.html asks to retry by navigating to #retry.
  win.webContents.on("did-navigate-in-page", (e, url) => {
    if (url.startsWith("file:") && url.endsWith("#retry")) loadGame();
  });

  loadGame();
}

if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient("dunreath", process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient("dunreath");
}
// macOS delivers links through open-url, possibly before the app is ready.
app.on("open-url", (e, url) => { e.preventDefault(); openLink(url) });

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Windows starts a second copy with the link in its arguments.
  app.on("second-instance", (e, argv) => {
    const link = linkInArgs(argv);
    if (link) { openLink(link); return }
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  { const link = linkInArgs(process.argv); if (link) pendingLink = linkTarget(link) }
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(process.platform === "darwin" ? Menu.buildFromTemplate([
      { role: "appMenu" }, { role: "editMenu" },
      { label: "View", submenu: [{ role: "togglefullscreen" }] }, { role: "windowMenu" }
    ]) : null);
    // Always fetch the newest edition of the game rather than a cached copy.
    await session.defaultSession.clearCache();
    createWindow();
  });
  app.on("window-all-closed", () => app.quit());
}
