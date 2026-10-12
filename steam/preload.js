// Gives the game page a small, safe doorway to Steam: read and write its
// Steam Cloud save file, unlock an achievement, and quit the app.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dunreathSteam", {
  cloudRead: name => ipcRenderer.invoke("cloud-read", name),
  cloudWrite: (name, text) => ipcRenderer.invoke("cloud-write", name, text),
  achieve: id => ipcRenderer.send("achieve", id),
  quit: () => ipcRenderer.send("quit")
});
