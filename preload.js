const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("myFS", {
  readXML: () => {
    return ipcRenderer.invoke("readXML");
  },
  saveNodeData: (nodeData) => {
    return ipcRenderer.invoke("saveNodeData", nodeData);
  },
  loadNodeData: () => {
    return ipcRenderer.invoke("loadNodeData");
  },
});
