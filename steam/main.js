// Dunreath, Steam edition. Unlike the free desktop app (desktop/), this one
// carries its own copy of the game (game/, made by scripts/bundle-game.js),
// so it plays offline and only changes when a new build is sent to Steam.
const { app, BrowserWindow, Menu, ipcMain, net, protocol, shell } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const { APP_ID } = require("./steam-config");

const GAME_DIR = path.join(__dirname, "game");
const GAME_URL = "app://dunreath/index.html";

// Steam must be running for Steam Cloud; without it the game still plays and
// saves on this computer. A real App ID also makes Steam start the game
// properly if a player opens the .exe directly.
let steam = null;
try {
  const steamworks = require("steamworks.js");
  if (app.isPackaged && APP_ID !== 480 && steamworks.restartAppIfNecessary(APP_ID)) {
    app.exit(0);
  } else {
    steam = steamworks.init(APP_ID);
    steamworks.electronEnableSteamOverlay();
  }
} catch (e) {
  console.warn("Steam is not available:", e && e.message);
}

// Serve the game from a private app:// address. It behaves like a website
// (so saves in localStorage stay put between versions) without going online.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

// Steam Cloud file names are kept to one simple name the game chooses.
const safeName = name => typeof name === "string" && /^[a-z0-9._-]{1,64}$/i.test(name);
const cloudOn = () => {
  try { return !!steam && steam.cloud.isEnabledForAccount() && steam.cloud.isEnabledForApp() }
  catch { return false }
};
ipcMain.handle("cloud-read", (e, name) => {
  if (!safeName(name) || !cloudOn()) return null;
  try { return steam.cloud.fileExists(name) ? steam.cloud.readFile(name) : null }
  catch (err) { console.warn("Steam Cloud read failed:", err); return null }
});
ipcMain.handle("cloud-write", (e, name, text) => {
  if (!safeName(name) || typeof text !== "string" || !cloudOn()) return false;
  try { return steam.cloud.writeFile(name, text) }
  catch (err) { console.warn("Steam Cloud write failed:", err); return false }
});
ipcMain.on("quit", () => app.quit());

let win = null;
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
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, "preload.js") }
  });
  win.webContents.setUserAgent(win.webContents.getUserAgent() + " DunreathSteam");
  win.once("ready-to-show", () => win.show());

  // Any outside link opens in the player's own browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("app://dunreath/")) return;
    e.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type === "keyDown" && input.key === "F11") { win.setFullScreen(!win.isFullScreen()); e.preventDefault() }
  });
  win.loadURL(GAME_URL);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    protocol.handle("app", req => {
      const { host, pathname } = new URL(req.url);
      const file = path.normalize(path.join(GAME_DIR, decodeURIComponent(pathname)));
      if (host !== "dunreath" || !file.startsWith(GAME_DIR + path.sep)) return new Response("Not found", { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    });
    Menu.setApplicationMenu(null);
    createWindow();
  });
  app.on("window-all-closed", () => app.quit());
}
