const spriteAtlases = [];
const spriteAtlas = {
  frames: {},
  meta: {
    image: "assets/tree_nodes.png",
    format: "RGBA8888",
    scale: 1,
  },
};

const linksAtlas = {
  frames: {
    diagonal: {
      frame: { x: 0, y: 0, w: 76, h: 76 },
      sourceSize: { w: 76, h: 76 },
      spriteSourceSize: { x: -38, y: -38, w: 76, h: 76 },
    },
    vertical: {
      frame: { x: 76, y: 0, w: 38, h: 76 },
      sourceSize: { w: 38, h: 76 },
      spriteSourceSize: { x: -19, y: -38, w: 38, h: 76 },
    },
  },
  meta: {
    image: "assets/node_links.png",
    format: "RGBA8888",
    size: { w: 114, h: 76 },
    scale: 1,
  },
};

const app = new PIXI.Application();

const canvasDivElem = document.getElementById("canvasContainer");
const inputElems = {
  type: document.getElementById("inpNodeType"),
  size: document.getElementById("inpNodeSize"),
  name: document.getElementById("inpNodeName"),
  description: document.getElementById("inpNodeDesc"),
  modifiers: document.getElementById("inpNodeMods"),
  alwaysAvail: document.getElementById("inpNodeAvail"),
  customID: document.getElementById("inpCustomID"),
  note: document.getElementById("inpNodeNote"),
};

let treeData = {};
let nodeCounter = 0;
let stageSprites = [];

let shiftHeld = false;
let ctrlHeld = false;

let tileSpritesheets = [];
let tileTextures = {};

// Custom images get a starting frame of (5000 * index of new image), this object holds {[startFrame] = custom image filename}
let customImages = {};

let linkSprites = [];
let paletteContainer = new PIXI.Container();
let paletteNodesContainer = new PIXI.Container();
let paletteBG = new PIXI.Sprite(PIXI.Texture.WHITE);
paletteBG.width = 194;
paletteBG.height = 900;
paletteBG.tint = 0x222222;
paletteContainer.addChild(paletteBG);
paletteContainer.addChild(paletteNodesContainer);

let paletteCols = 6;
let paletteScroll = 0;
let paletteNodes = [];
let nodeSprites = {};

// Selected palette node indicator sprite
let selectorSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
selectorSprite.width = 32;
selectorSprite.height = 32;
selectorSprite.tint = 0xadd8e6;
paletteNodesContainer.addChild(selectorSprite);

// Visual sprite displayed at position (0, 0)
let centerSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
centerSprite.width = 8;
centerSprite.height = 8;
centerSprite.anchor.set(0.5);
centerSprite.tint = 0xaaaaaa;

// Visual sprite displayed at mouse position when connecting nodes
let connectorSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
connectorSprite.width = 32;
connectorSprite.height = 32;
connectorSprite.anchor.set(0.5);
connectorSprite.tint = 0x44aaaa;
connectorSprite.alpha = 0;

// Visual sprite displayed at the first connection position while connecting nodes
let connectingSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
connectingSprite.width = 32;
connectingSprite.height = 32;
connectingSprite.anchor.set(0.5);
connectingSprite.tint = 0x44aaaa;
connectingSprite.alpha = 0;

let selectedNode = undefined;
let selectedSprite = new PIXI.Sprite();
selectedSprite.alpha = 0;

let linksContainer = new PIXI.Container();
let nodesContainer = new PIXI.Container();
nodesContainer.addChild(connectorSprite);
nodesContainer.addChild(connectingSprite);
nodesContainer.addChild(centerSprite);
nodesContainer.addChild(selectedSprite);

let camera = { x: 400, y: 300 };
let dragging = false;
let dragStart = { x: 0, y: 0 };

let connecting = false;
let connectFirst = undefined;
let connectedNodes = [];

nodesContainer.x = camera.x;
nodesContainer.y = camera.y;

async function main() {
  // Load assets
  await PIXI.Assets.load(["assets/node_links.png"]);

  const parser = new DOMParser();
  const ANM2data = await window.myFS.readANM2();

  let allAnims = {};
  let customSheets = 0;
  for (let fileData of ANM2data) {
    const XMLdoc = parser.parseFromString(fileData, "text/xml");

    // Grab sprite and generate atlas
    const spritesheets = XMLdoc.getElementsByTagName("Spritesheet");
    for (let spritesheet of spritesheets) {
      const filePath = spritesheet.getAttribute("Path")?.split("/").pop();
      if (!filePath) {
        continue;
      }

      const isMainImage = filePath == "tree_nodes.png";
      if (!isMainImage) customSheets++;
      const workingDir = await window.myFS.getWorkingDir();
      const imagePath =
        workingDir +
        "/assets/" +
        (isMainImage ? filePath : "custom/" + filePath);

      await PIXI.Assets.load([imagePath]);
      console.log("Loaded ", imagePath);
      spriteAtlases[filePath] = {
        frames: {},
        meta: {
          image: imagePath,
          format: "RGBA8888",
          scale: 1,
        },
      };

      // Convert ANM2 data to sprite frame data for drawing
      const anims = XMLdoc.getElementsByTagName("Animation");
      for (let anim of anims) {
        const animName = anim.getAttribute("Name");
        if (animName.includes("Allocated")) continue;
        if (animName.includes("Available")) continue;

        if (animName == "Default") {
          const frames = anim
            .getElementsByTagName("LayerAnimation")[0]
            .getElementsByTagName("Frame");

          let frameNum = 0;
          if (!isMainImage) {
            frameNum = 5000 + (customSheets - 1) * 1000;
            customImages[frameNum] = filePath;
          }
          allAnims[frameNum] = anim;
          for (let frameElem of frames) {
            spriteAtlases[filePath].frames[frameNum] = {
              frame: {
                x: frameElem.getAttribute("XCrop"),
                y: frameElem.getAttribute("YCrop"),
                w: frameElem.getAttribute("Width"),
                h: frameElem.getAttribute("Height"),
              },
              sourceSize: {
                w: 32,
                h: 32,
              },
              spriteSourceSize: {
                x: -frameElem.getAttribute("XPivot"),
                y: -frameElem.getAttribute("YPivot"),
                w: 32,
                h: 32,
              },
            };

            // Add option to 'Type' input
            const tmpOptionElem = document.createElement("option");
            tmpOptionElem.value = frameNum;
            tmpOptionElem.innerHTML = frameNum;
            inputElems.type.appendChild(tmpOptionElem);

            frameNum++;
          }
        }
      }
    }
  }

  for (let spriteAtlas of Object.values(spriteAtlases)) {
    const tmpSpritesheet = new PIXI.Spritesheet(
      PIXI.Texture.from(spriteAtlas.meta.image),
      spriteAtlas
    );
    await tmpSpritesheet.parse();
    tileSpritesheets.push(tmpSpritesheet);
    if (tmpSpritesheet) {
      for (let [k, v] of Object.entries(tmpSpritesheet.textures)) {
        tileTextures[k] = v;
      }
    }
  }

  linkSprites = new PIXI.Spritesheet(
    PIXI.Texture.from(linksAtlas.meta.image),
    linksAtlas
  );
  await linkSprites.parse();

  // Populate palette once spritesheet is generated
  let paletteIdx = 0;
  for (let [startFrame, anim] of Object.entries(allAnims)) {
    const animName = anim.getAttribute("Name");
    if (animName.includes("Allocated")) continue;
    if (animName.includes("Available")) continue;

    if (animName == "Default") {
      const frames = anim
        .getElementsByTagName("LayerAnimation")[0]
        .getElementsByTagName("Frame");

      let frameCounter = 0;
      for (let frameElem of frames) {
        const startFrameNum = parseInt(startFrame);
        const nodeIdx = startFrameNum + frameCounter;
        // Add node to palette
        const paletteNodeSprite = new PIXI.Sprite(tileTextures[nodeIdx]);
        paletteNodeSprite.x = 16 + (paletteIdx % paletteCols) * 32;
        paletteNodeSprite.y = 16 + Math.floor(paletteIdx / paletteCols) * 32;
        paletteNodesContainer.addChild(paletteNodeSprite);

        let nodeSize = "Large";
        if (frameElem.getAttribute("Width") == "28") nodeSize = "Small";

        const newNode = {
          type: frameCounter,
          size: nodeSize,
          name: "",
          description: [""],
          modifiers: {},
          note: "",
        };
        if (startFrameNum > 0) {
          newNode.startFrame = startFrameNum;
          if (startFrame >= 5000) {
            newNode.custom = customImages[startFrame];
          }
        }
        paletteNodes.push(newNode);

        paletteIdx++;
        frameCounter++;
      }
    }
  }
  await loadPaletteData();
  resetSelection();

  const canvasContainerRect = document.getElementById("canvasContainer");
  await app.init({
    width: canvasContainerRect.clientWidth,
    height: canvasContainerRect.clientHeight,
  });

  document.getElementById("canvasContainer").append(app.canvas);

  nodesContainer.addChild(linksContainer);
  app.stage.addChild(nodesContainer);
  app.stage.addChild(paletteContainer);

  app.canvas.onclick = clickCanvas;
}
document.addEventListener("DOMContentLoaded", main);

function setInputElems(inputData) {
  inputElems.type.value = inputData.type;
  inputElems.size.value = inputData.size;
  inputElems.name.value = inputData.name;
  inputElems.description.value = inputData.description?.join("\n") || "";
  const modifiersStr = JSON.stringify(inputData.modifiers, null, 2);
  if (inputData.modifiers) {
    inputElems.modifiers.value = modifiersStr
      .split("\n")
      .filter((v) => v != "{" && v != "}" && v != "{}")
      .map((v) => v.trim())
      .join("\n");
  } else {
    inputElems.modifiers.value = "";
  }
  inputElems.alwaysAvail.checked = inputData.alwaysAvail;
  if (inputData.customID) inputElems.customID.value = inputData.customID;
  else inputElems.customID.value = "";
  inputElems.note.value = inputData.note;
}

function resetSelection() {
  selectedNode = paletteNodes[0];
  setInputElems(selectedNode);
  let nodeTexID = parseInt(selectedNode.type);
  if (selectedNode.startFrame) nodeTexID += parseInt(selectedNode.startFrame);
  selectedSprite.texture = tileTextures[nodeTexID];
  selectorSprite.x = 0;
  selectorSprite.y = 0;
}

function updateNodeLinks() {
  for (let connection of connectedNodes) {
    linksContainer.removeChild(connection.link.sprite);
  }
  connectedNodes = [];
  for (let [nodeID, node] of Object.entries(treeData)) {
    if (!node.adjacent) continue;
    nodeID = parseInt(nodeID);

    for (let adjacentID of node.adjacent) {
      if (!treeData.hasOwnProperty(adjacentID)) continue;

      // Check connection hasn't been made already
      let connectionMade = false;
      for (let connection of connectedNodes) {
        if (
          (connection.node1.nodeID == nodeID &&
            connection.node2.nodeID == adjacentID) ||
          (connection.node1.nodeID == adjacentID &&
            connection.node2.nodeID == nodeID)
        ) {
          connectionMade = true;
          break;
        }
      }
      if (connectionMade) break;

      const adjacentNode = treeData[adjacentID];
      let linkType = undefined;
      let dirX = adjacentNode.pos[0] - node.pos[0];
      let dirY = adjacentNode.pos[1] - node.pos[1];

      if (Math.abs(dirX) <= 2 && Math.abs(dirY) <= 2) {
        if (node.pos[0] == adjacentNode.pos[0]) {
          linkType = "Vertical";
        } else if (node.pos[1] == adjacentNode.pos[1]) {
          linkType = "Horizontal";
        } else if (Math.abs(dirX) == Math.abs(dirY)) {
          linkType = "Diagonal";
        }
      }
      if (!linkType) continue;

      const tmpLink = {
        sprite:
          linkType == "Diagonal"
            ? new PIXI.Sprite(linkSprites.textures["diagonal"])
            : new PIXI.Sprite(linkSprites.textures["vertical"]),
      };
      if (linkType == "Horizontal") tmpLink.sprite.rotation = Math.PI / 2;
      if (
        (adjacentNode.pos[0] <= node.pos[0] &&
          adjacentNode.pos[1] > node.pos[1]) ||
        (adjacentNode.pos[0] > node.pos[0] &&
          adjacentNode.pos[1] <= node.pos[1])
      )
        tmpLink.sprite.scale.x = -1;
      if (linkType == "Diagonal" && Math.abs(dirX) == 2)
        tmpLink.sprite.scale.x *= 2;
      if (
        Math.abs(dirY) == 2 ||
        (linkType == "Horizontal" && Math.abs(dirX) == 2)
      )
        tmpLink.sprite.scale.y *= 2;

      tmpLink.sprite.x = node.pos[0] * 38 + 19 * dirX;
      tmpLink.sprite.y = node.pos[1] * 38 + 19 * dirY;

      connectedNodes.push({
        node1: { node, nodeID },
        node2: { node: adjacentNode, nodeID: adjacentID },
        link: tmpLink,
      });

      linksContainer.addChild(tmpLink.sprite);
    }
  }
}

function loadTreeData(data) {
  // Remove old sprites
  for (let sprite of Object.values(nodeSprites)) {
    nodesContainer.removeChild(sprite);
  }
  nodeSprites = {};
  for (let connection of connectedNodes) {
    linksContainer.removeChild(connection.link.sprite);
  }
  connectedNodes = [];

  treeData = data;
  nodeCounter = 0;

  resetSelection();
  // Parse nodes if compressed
  const tmpKeys = Object.keys(treeData);
  if (tmpKeys.length && typeof treeData[tmpKeys[0]] == "string") {
    for (let nodeID of Object.keys(treeData)) {
      treeData[nodeID] = JSON.parse(treeData[nodeID]);

      // Remove old data
      if (treeData[nodeID].requires) delete treeData[nodeID].requires;
    }
  }

  for (let [nodeID, node] of Object.entries(treeData)) {
    const nodeSprite = new PIXI.Sprite(tileTextures[node.type]);

    const nodeX = node.pos[0] * 38;
    const nodeY = node.pos[1] * 38;

    nodeSprite.x = nodeX;
    nodeSprite.y = nodeY;

    nodesContainer.addChild(nodeSprite);
    nodeSprites[nodeID] = nodeSprite;

    if (parseInt(nodeID) > nodeCounter) nodeCounter = parseInt(nodeID);
  }
  updateNodeLinks();
}

// Read input file and set tree data
function readSingleFile(e) {
  let file = e.target.files[0];
  if (!file) {
    console.warn("Could not load the specified file.");
    return;
  }
  let reader = new FileReader();
  reader.onload = function (e) {
    let contents = e.target.result;
    loadTreeData(JSON.parse(contents));

    document.getElementById("inpFilename").value =
      file.name?.split(".")[0] || "";
  };
  reader.readAsText(file);
}

// On file input
document.getElementById("file-input").addEventListener(
  "change",
  function (e) {
    if (this.value.split(".").pop()?.toLowerCase() == "json") {
      readSingleFile(e);
    } else {
      console.warn("Not a JSON file!");
    }
  },
  false
);

// Add node at position
function addNodeAt(x, y) {
  try {
    let nodeTexID = parseInt(inputElems.type.value);
    if (selectedNode.startFrame) nodeTexID += parseInt(selectedNode.startFrame);
    const tmpNode = {
      pos: [x, y],
      type: nodeTexID,
      size: inputElems.size.value,
      name: inputElems.name.value,
      description: inputElems.description.value?.split("\n") || [""],
      modifiers: JSON.parse(
        "{" + inputElems.modifiers.value.replace("\n", "") + "}"
      ),
      adjacent: [],
    };
    if (inputElems.alwaysAvail.checked) tmpNode.alwaysAvailable = true;
    if (inputElems.customID.value) tmpNode.customID = inputElems.customID.value;
    nodeCounter++;

    const nodeSprite = new PIXI.Sprite(tileTextures[tmpNode.type]);
    nodeSprite.x = x * 38;
    nodeSprite.y = y * 38;
    nodesContainer.addChild(nodeSprite);
    nodeSprites[nodeCounter] = nodeSprite;

    treeData[nodeCounter] = tmpNode;
  } catch (err) {
    console.warn(err);
    console.warn("Could not place node.");
  }
}

// Get node at position
function getNodeAt(x, y) {
  for (let [nodeID, node] of Object.entries(treeData)) {
    if (node.pos[0] == x && node.pos[1] == y) return { nodeID, node };
  }
  return undefined;
}

// Remove given node from tree data
function removeNode(nodeID) {
  if (treeData.hasOwnProperty(nodeID)) {
    // Remove connections to this node
    for (let i = connectedNodes.length - 1; i >= 0; i--) {
      const connection = connectedNodes[i];
      if (
        connection.node1.nodeID == nodeID ||
        connection.node2.nodeID == nodeID
      ) {
        linksContainer.removeChild(connection.link.sprite);
        connectedNodes.splice(i, 1);
      }
    }

    if (nodeSprites.hasOwnProperty(nodeID)) {
      nodesContainer.removeChild(nodeSprites[nodeID]);
      delete nodeSprites[nodeID];
    }
    delete treeData[nodeID];
  }
}

// Scroll palette
function scrollPalette(ev, delta, mouseWithin = true) {
  const canvasRect = canvasDivElem.getBoundingClientRect();
  if (
    ((mouseWithin &&
      ev.pageX > canvasRect.x &&
      ev.pageX < canvasRect.x + canvasRect.width &&
      ev.pageY > canvasRect.y &&
      ev.pageY < canvasRect.y + canvasRect.height) ||
      !mouseWithin) &&
    !isInputFocused()
  ) {
    let scrollSpeed = 1;
    if (shiftHeld) scrollSpeed = 3;
    if (delta < 0) {
      paletteScroll = Math.max(0, paletteScroll - scrollSpeed);
    } else if (delta > 0) {
      paletteScroll = Math.min(
        Math.floor(paletteNodes.length / paletteCols),
        paletteScroll + scrollSpeed
      );
    }
    paletteNodesContainer.y = -paletteScroll * 32;
  }
}

// Mouse event funcs
document.addEventListener("mousedown", (ev) => {
  if (ev.shiftKey) shiftHeld = true;
  else shiftHeld = false;
  if (ev.ctrlKey) ctrlHeld = true;
  else ctrlHeld = false;
  if ((ev.button == 1 || ev.button == 2) && !dragging) {
    dragging = true;
    dragStart.x = ev.pageX;
    dragStart.y = ev.pageY;
  }
});
document.addEventListener("mouseup", (ev) => {
  if ((ev.button == 1 || ev.button == 2) && dragging) {
    dragging = false;
    camera.x = nodesContainer.x;
    camera.y = nodesContainer.y;
  }
});
document.addEventListener("mousemove", (ev) => {
  if (dragging) {
    const xOff = dragStart.x - ev.pageX;
    const yOff = dragStart.y - ev.pageY;

    nodesContainer.x = camera.x - xOff;
    nodesContainer.y = camera.y - yOff;
  } else {
    const canvasRect = canvasDivElem.getBoundingClientRect();
    const tileX =
      Math.floor((ev.pageX - camera.x - canvasRect.x + 19) / 38) * 38;
    const tileY =
      Math.floor((ev.pageY - camera.y - canvasRect.y + 19) / 38) * 38;
    if (!connecting) {
      // Draw selected node on mouse
      selectedSprite.x = tileX;
      selectedSprite.y = tileY;
      selectedSprite.alpha = 0.4;
    } else {
      connectorSprite.x = tileX;
      connectorSprite.y = tileY;
      connectorSprite.alpha = 0.5;
    }
  }
});
document.addEventListener("wheel", (ev) => {
  scrollPalette(ev, ev.deltaY);
});

function removeFromArr(arr, item) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] == item) arr.splice(i, 1);
  }
}

// Canvas click handler
function clickCanvas(ev) {
  const canvasRect = canvasDivElem.getBoundingClientRect();

  if (ev.pageX >= canvasRect.x && ev.pageX <= canvasRect.x + paletteBG.width) {
    // Clicked palette
    const tileX = Math.floor((ev.pageX - canvasRect.x) / 32);
    const tileY = Math.floor((ev.pageY - canvasRect.y) / 32);
    const clickedID = tileX + tileY * paletteCols + paletteScroll * paletteCols;
    if (clickedID < paletteNodes.length) {
      selectedNode = paletteNodes[clickedID];
      setInputElems(selectedNode);

      selectorSprite.x = tileX * 32;
      selectorSprite.y = tileY * 32 + paletteScroll * 32;

      let nodeTexID = parseInt(selectedNode.type);
      if (selectedNode.startFrame)
        nodeTexID += parseInt(selectedNode.startFrame);
      selectedSprite.texture = tileTextures[nodeTexID];
    }
  } else {
    // Clicked canvas
    const tileX = Math.floor(
      (ev.pageX - canvasRect.x - nodesContainer.x + 19) / 38
    );
    const tileY = Math.floor(
      (ev.pageY - canvasRect.y - nodesContainer.y + 19) / 38
    );
    const tmpNode = getNodeAt(tileX, tileY);
    if (!connecting) {
      if (tmpNode != undefined) {
        if (ctrlHeld) {
          // Ctrl + click: print node data (for debugging)
          console.log(tmpNode.nodeID, tmpNode.node);
        } else if (shiftHeld && inputElems.type.value == tmpNode.node.type) {
          // Shift + click: replace node data
          tmpNode.node.name = inputElems.name.value;
          tmpNode.node.size = inputElems.size.value;
          tmpNode.node.description = inputElems.description.value?.split(
            "\n"
          ) || [""];
          tmpNode.node.modifiers = JSON.parse(
            "{" + inputElems.modifiers.value.replace("\n", "") + "}"
          );
          if (inputElems.alwaysAvail.checked) {
            tmpNode.node.alwaysAvailable = true;
          } else if (tmpNode.node.alwaysAvailable) {
            delete tmpNode.node.alwaysAvailable;
          }
          if (inputElems.customID.value)
            tmpNode.node.customID = inputElems.customID.value;
          console.log("Replaced placed node data at", tileX, tileY);
        } else {
          removeNode(tmpNode.nodeID);
        }
      } else {
        addNodeAt(tileX, tileY);
      }
    } else if (tmpNode) {
      const selectFirst = () => {
        connectFirst = tmpNode;
        connectingSprite.x = tileX * 38;
        connectingSprite.y = tileY * 38;
        connectingSprite.alpha = 0.8;
      };

      // Shift + click: connect nodes
      if (!connectFirst) {
        selectFirst();
      } else {
        if (connectFirst.nodeID != tmpNode.nodeID) {
          let existingConn = undefined;
          for (let connection of connectedNodes) {
            if (
              (connection.node1.nodeID == connectFirst.nodeID &&
                connection.node2.nodeID == tmpNode.nodeID) ||
              (connection.node1.nodeID == tmpNode.nodeID &&
                connection.node2.nodeID == connectFirst.nodeID)
            ) {
              existingConn = connection;
            }
          }

          if (existingConn) {
            // Existing connection, remove it
            linksContainer.removeChild(existingConn.link.sprite);
            const tmpIndex = connectedNodes.indexOf(existingConn);
            if (tmpIndex != -1) connectedNodes.splice(tmpIndex, 1);

            if (connectFirst.node.adjacent)
              removeFromArr(connectFirst.node.adjacent, tmpNode.nodeID);
            if (tmpNode.node.adjacent)
              removeFromArr(tmpNode.node.adjacent, connectFirst.nodeID);
          } else {
            // Create new connection
            const dirX = tmpNode.node.pos[0] - connectFirst.node.pos[0];
            const dirY = tmpNode.node.pos[1] - connectFirst.node.pos[1];

            if (
              Math.abs(dirX) <= 2 &&
              Math.abs(dirY) <= 2 &&
              (dirX == 0 || dirY == 0 || Math.abs(dirX) == Math.abs(dirY))
            ) {
              if (connectFirst.node.adjacent.indexOf(tmpNode.nodeID) == -1)
                connectFirst.node.adjacent.push(parseInt(tmpNode.nodeID));
              if (tmpNode.node.adjacent.indexOf(connectFirst.nodeID) == -1)
                tmpNode.node.adjacent.push(parseInt(connectFirst.nodeID));

              updateNodeLinks();
            } else {
              console.warn("This node connection is not possible.");
            }
          }
        }

        // Shift + click: continue connecting
        if (shiftHeld && connectFirst.nodeID != tmpNode.nodeID) {
          selectFirst();
        } else {
          connectFirst = undefined;
          connectingSprite.alpha = 0;
        }
      }
    }
  }
}

function isInputFocused() {
  let inputFocus = false;
  for (let inp of Object.values(inputElems)) {
    if (
      (inp.type == "text" || inp.type == "textarea") &&
      document.activeElement == inp
    ) {
      inputFocus = true;
    }
  }
  if (
    !inputFocus &&
    document.getElementById("inpFilename") == document.activeElement
  ) {
    inputFocus = true;
  }
  return inputFocus;
}

// Key event funcs
document.addEventListener("keydown", (ev) => {
  if (ev.shiftKey) shiftHeld = true;
  if (ev.ctrlKey) ctrlHeld = true;

  if (ev.key == "ArrowDown") {
    scrollPalette(ev, 1, false);
  } else if (ev.key == "ArrowUp") {
    scrollPalette(ev, -1, false);
  }
});
document.addEventListener("keyup", (ev) => {
  if (!ev.shiftKey) shiftHeld = false;
  if (!ev.ctrlKey) ctrlHeld = false;
  if (!isInputFocused()) {
    if (ev.key == "c" || ev.key == "C") {
      connecting = !connecting;
      if (connecting) {
        selectedSprite.alpha = 0;
      } else {
        connectFirst = undefined;
        connectorSprite.alpha = 0;
        connectingSprite.alpha = 0;
      }
    }
  }
});

function getCondensedTreeData() {
  if (document.getElementById("condenseCheck").checked) {
    const tmpTreeJSON = {};
    for (let [nodeID, node] of Object.entries(treeData)) {
      tmpTreeJSON[nodeID] = JSON.stringify(node);
    }
    return tmpTreeJSON;
  }
  return treeData;
}

function sanitizeNodeData() {
  for (let [_, node] of Object.entries(treeData)) {
    // Make sure adjacent nodes exist
    for (let i = node.adjacent.length - 1; i >= 0; i--) {
      if (!treeData.hasOwnProperty(node.adjacent[i])) {
        node.adjacent.splice(i, 1);
      }
    }
  }
}

// Save tree data
async function saveTreeData() {
  const filename = document
    .getElementById("inpFilename")
    .value?.trim()
    .replace(/[^a-z0-9]/gi, "_");
  if (!filename) {
    console.warn("Error while saving tree: Invalid filename!");
    return;
  }

  sanitizeNodeData();
  const tmpTreeJSON = getCondensedTreeData();
  await window.myFS.saveTree(filename, JSON.stringify(tmpTreeJSON, null, 2));
  console.log("Saved to trees/" + filename + ".json");
}

// Save palette node data
async function savePaletteData() {
  await window.myFS.saveNodeData(
    JSON.stringify(
      paletteNodes.filter((node) => !node.custom),
      null,
      2
    )
  );
  // Save custom
  const customImgNodes = {};
  for (let customImgPath of Object.values(customImages)) {
    customImgNodes[customImgPath] = paletteNodes.filter(
      (node) => node.custom == customImgPath
    );
  }
  await window.myFS.saveCustomNodeData(JSON.stringify(customImgNodes, null, 2));
}

// Load palette node data
async function loadPaletteData() {
  try {
    const tmpNodeData = await window.myFS.loadNodeData();
    for (let tmpNode of JSON.parse(tmpNodeData)) {
      for (let oldNode of paletteNodes) {
        if (tmpNode.type == oldNode.type) {
          Object.assign(oldNode, tmpNode);
          break;
        }
      }
    }
    const customNodeData = await window.myFS.loadCustomNodeData();
    if (customNodeData) {
      for (let [imgPath, customNodeList] of Object.entries(
        JSON.parse(customNodeData)
      )) {
        for (let tmpNode of customNodeList) {
          for (let oldNode of paletteNodes) {
            if (
              tmpNode.type == oldNode.type &&
              oldNode.custom &&
              oldNode.custom == imgPath
            ) {
              Object.assign(oldNode, tmpNode);
              break;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("Error loading palette data:", err);
  }
}

// Edit palette node on input change
for (let [elemName, elem] of Object.entries(inputElems)) {
  elem.onchange = (e) => {
    const nodeID = paletteNodes.indexOf(selectedNode);
    if (elem.type == "checkbox") {
      paletteNodes[nodeID][elemName] = e.target.checked;
    } else if (elemName == "description") {
      paletteNodes[nodeID][elemName] = e.target.value.split("\n");
    } else if (elemName == "modifiers") {
      // Check field has valid JSON data
      try {
        const tmpJSON = JSON.parse(
          "{" + e.target.value.replace("\n", "") + "}"
        );
        paletteNodes[nodeID][elemName] = tmpJSON;
        inputElems.modifiers.style.border = "none";
      } catch (err) {
        console.warn(err);
        console.warn("Invalid JSON in modifiers field.");
        inputElems.modifiers.style.border = "1px solid red";
      }
    } else {
      paletteNodes[nodeID][elemName] = e.target.value;
    }
    savePaletteData();
  };
}

function copyTreeToClipboard() {
  sanitizeNodeData();
  navigator.clipboard.writeText(
    JSON.stringify(getCondensedTreeData(), null, 2)
  );
  console.log("Copied tree data to clipboard.");
}

// Update "Total Nodes" counter regularly
setInterval(() => {
  document.getElementById("totalNodesCounter").innerHTML =
    Object.values(treeData).length;
}, 500);
