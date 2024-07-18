const spriteAtlas = {
  frames: {},
  meta: {
    image: "assets/tree_nodes.png",
    format: "RGBA8888",
    size: { w: 320, h: 320 },
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
};

let treeData = {};
let nodeCounter = 0;
let stageSprites = [];

let shiftHeld = false;
let ctrlHeld = false;

let tileSprites = undefined;
let linkSprites = undefined;
let paletteContainer = new PIXI.Container();
let paletteBG = new PIXI.Sprite(PIXI.Texture.WHITE);
paletteBG.width = 162;
paletteBG.height = 800;
paletteBG.tint = 0x222222;
paletteContainer.addChild(paletteBG);

let paletteNodes = [];
let nodeSprites = {};

// Selected palette node indicator sprite
let selectorSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
selectorSprite.width = 32;
selectorSprite.height = 32;
selectorSprite.tint = 0x888888;
paletteContainer.addChild(selectorSprite);

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
  await PIXI.Assets.load(["assets/tree_nodes.png", "assets/node_links.png"]);

  const parser = new DOMParser();
  const XMLdata = await window.myFS.readXML();
  const XMLdoc = parser.parseFromString(XMLdata, "text/xml");

  // Convert ANM2 data to sprite frame data for drawing
  const anims = XMLdoc.getElementsByTagName("Animation");
  for (let anim of anims) {
    const animName = anim.getAttribute("Name");
    if (animName.includes("Allocated")) continue;

    const frameElem =
      anim.getElementsByTagName("LayerAnimation")[0].firstElementChild;

    spriteAtlas.frames[animName] = {
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
        x: -frameElem.getAttribute("Width") / 2,
        y: -frameElem.getAttribute("Height") / 2,
        w: 32,
        h: 32,
      },
    };

    // Add option to 'Type' input
    const tmpOptionElem = document.createElement("option");
    tmpOptionElem.value = animName;
    tmpOptionElem.innerHTML = animName;
    inputElems.type.appendChild(tmpOptionElem);
  }

  tileSprites = new PIXI.Spritesheet(
    PIXI.Texture.from(spriteAtlas.meta.image),
    spriteAtlas
  );

  linkSprites = new PIXI.Spritesheet(
    PIXI.Texture.from(linksAtlas.meta.image),
    linksAtlas
  );

  await tileSprites.parse();
  await linkSprites.parse();

  // Populate palette once spritesheet is generated
  let i = 0;
  for (let anim of anims) {
    const animName = anim.getAttribute("Name");
    if (animName.includes("Allocated")) continue;

    // Add node to palette
    const paletteNodeSprite = new PIXI.Sprite(tileSprites.textures[animName]);
    paletteNodeSprite.x = 16 + (i % 5) * 32;
    paletteNodeSprite.y = 16 + Math.floor(i / 5) * 32;
    paletteContainer.addChild(paletteNodeSprite);

    let nodeSize = "Large";
    if (animName.split(" ").includes("Med")) nodeSize = "Med";
    else if (animName.split(" ").includes("Small")) nodeSize = "Small";

    paletteNodes.push({
      type: animName,
      size: nodeSize,
      name: animName,
      description: [""],
      modifiers: {},
    });

    i++;
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
}

function resetSelection() {
  selectedNode = paletteNodes[0];
  setInputElems(selectedNode);
  selectedSprite.texture = tileSprites.textures[selectedNode.type];
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
    }
  }

  for (let [nodeID, node] of Object.entries(treeData)) {
    const nodeSprite = new PIXI.Sprite(tileSprites.textures[node.type]);

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
    const tmpNode = {
      pos: [x, y],
      type: inputElems.type.value,
      size: inputElems.size.value,
      name: inputElems.name.value,
      description: inputElems.description.value?.split("\n") || [""],
      modifiers: JSON.parse(
        "{" + inputElems.modifiers.value.replace("\n", "") + "}"
      ),
      adjacent: [],
      requires: [],
    };
    if (inputElems.alwaysAvail.checked) tmpNode.alwaysAvailable = true;
    nodeCounter++;

    const nodeSprite = new PIXI.Sprite(tileSprites.textures[tmpNode.type]);
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

// Mouse event funcs
document.addEventListener("mousedown", (ev) => {
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
    const clickedID = tileX + tileY * 5;
    if (clickedID < paletteNodes.length) {
      selectedNode = paletteNodes[clickedID];
      setInputElems(selectedNode);

      selectorSprite.x = tileX * 32;
      selectorSprite.y = tileY * 32;

      selectedSprite.texture = tileSprites.textures[selectedNode.type];
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

            if (connectFirst.node.requires)
              removeFromArr(connectFirst.node.requires, tmpNode.nodeID);
            if (connectFirst.node.adjacent)
              removeFromArr(connectFirst.node.adjacent, tmpNode.nodeID);
            if (tmpNode.node.requires)
              removeFromArr(tmpNode.node.requires, connectFirst.nodeID);
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
              if (tmpNode.node.requires.indexOf(connectFirst.nodeID) == -1)
                tmpNode.node.requires.push(parseInt(connectFirst.nodeID));

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
  return inputFocus;
}

// Key event funcs
document.addEventListener("keydown", (ev) => {
  if (ev.shiftKey) shiftHeld = true;
  if (ev.ctrlKey) ctrlHeld = true;
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
    // Make sure adjacent & required nodes exist
    for (let i = node.adjacent.length - 1; i >= 0; i--) {
      if (!treeData.hasOwnProperty(node.adjacent[i])) {
        node.adjacent.splice(i, 1);
      }
    }
    for (let i = node.requires.length - 1; i >= 0; i--) {
      if (!treeData.hasOwnProperty(node.requires[i])) {
        node.requires.splice(i, 1);
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
  await window.myFS.saveNodeData(JSON.stringify(paletteNodes, null, 2));
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
