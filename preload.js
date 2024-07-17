const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("myFS", {
  readXML: () => {
    return ipcRenderer.invoke("readXML");
  },
});
