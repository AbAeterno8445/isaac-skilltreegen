// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("fs/promises");

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
    icon: "assets/icon.ico",
  });

  // and load the index.html of the app.
  mainWindow.loadFile("index.html");
  mainWindow.setMenuBarVisibility(false);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

const getANM2Files = async () => {
  const procFiles = [];
  const totalFiles = ["assets/tree_nodes.anm2"];

  // Add custom anm2 files
  const customFiles = await fs.readdir("assets/custom");
  for (let i = 0; i < customFiles.length; i++) {
    const fileName = path.join("assets", "custom", customFiles[i]);
    if (fileName.endsWith(".anm2")) {
      totalFiles.push(fileName);
    }
  }

  // Get and return file data
  for (let i = 0; i < totalFiles.length; i++) {
    const fileData = await fs.readFile(totalFiles[i], "utf-8");
    procFiles.push(fileData);
  }
  return procFiles;
};

ipcMain.handle("readANM2", (ev) => {
  return getANM2Files();
});

ipcMain.handle("getWorkingDir", (ev) => {
  if (app.isPackaged) return path.join(__dirname, "..", "..");
  return __dirname;
});

ipcMain.handle("saveNodeData", (ev, nodeData) => {
  fs.writeFile("assets/nodeData.json", nodeData, "utf-8");
});

ipcMain.handle("saveCustomNodeData", (ev, nodeData) => {
  fs.writeFile("assets/customNodeData.json", nodeData, "utf-8");
});

ipcMain.handle("loadNodeData", (ev) => {
  return fs.readFile("assets/nodeData.json", "utf-8");
});

ipcMain.handle("loadCustomNodeData", (ev) => {
  return fs.readFile("assets/customNodeData.json", "utf-8");
});

ipcMain.handle("saveTree", (ev, treeName, treeData) => {
  fs.writeFile("trees/" + treeName + ".json", treeData, "utf-8");
});
