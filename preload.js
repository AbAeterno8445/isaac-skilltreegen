const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("myFS", {
  readANM2: () => {
    return ipcRenderer.invoke("readANM2");
  },
  saveNodeData: (nodeData) => {
    return ipcRenderer.invoke("saveNodeData", nodeData);
  },
  saveCustomNodeData: (nodeData) => {
    return ipcRenderer.invoke("saveCustomNodeData", nodeData);
  },
  loadNodeData: () => {
    return ipcRenderer.invoke("loadNodeData");
  },
  loadCustomNodeData: () => {
    return ipcRenderer.invoke("loadCustomNodeData");
  },
  saveTree: (treeName, treeData) => {
    return ipcRenderer.invoke("saveTree", treeName, treeData);
  },
});
