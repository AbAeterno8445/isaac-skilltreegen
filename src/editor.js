const spriteAtlas = {
  frames: {},
  meta: {
    image: "assets/tree_nodes.png",
    format: "RGBA8888",
    size: { w: 320, h: 320 },
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

let tileSprites = undefined;
let paletteContainer = new PIXI.Container();
let paletteBG = new PIXI.Sprite(PIXI.Texture.WHITE);
paletteBG.width = 162;
paletteBG.height = 800;
paletteBG.tint = 0x222222;
paletteContainer.addChild(paletteBG);

let paletteNodes = [];

let selectorSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
selectorSprite.width = 32;
selectorSprite.height = 32;
selectorSprite.tint = 0x888888;
paletteContainer.addChild(selectorSprite);

let centerSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
centerSprite.width = 8;
centerSprite.height = 8;
centerSprite.anchor.set(0.5);
centerSprite.tint = 0xaaaaaa;

let selectedNode = undefined;
let selectedSprite = new PIXI.Sprite();
selectedSprite.alpha = 0;

let nodesContainer = new PIXI.Container();
nodesContainer.addChild(centerSprite);
nodesContainer.addChild(selectedSprite);

let camera = { x: 400, y: 300 };
let dragging = false;
let dragStart = { x: 0, y: 0 };

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

  await tileSprites.parse();

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
      description: "",
      modifiers: "",
      alwaysAvail: false,
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

  app.stage.addChild(nodesContainer);
  app.stage.addChild(paletteContainer);

  app.canvas.onclick = clickCanvas;
}
document.addEventListener("DOMContentLoaded", main);

function setInputElems(inputData) {
  inputElems.type.value = inputData.type;
  inputElems.size.value = inputData.size;
  inputElems.name.value = inputData.name;
  inputElems.description.value = inputData.description;
  inputElems.modifiers.value = inputData.modifiers;
  inputElems.alwaysAvail.checked = inputData.alwaysAvail;
}

function resetSelection() {
  selectedNode = paletteNodes[0];
  setInputElems(selectedNode);
  selectedSprite.texture = tileSprites.textures[selectedNode.type];
}

function loadTreeData(data) {
  // Remove old sprites
  for (let [nodeID, node] of Object.entries(treeData)) {
    if (node.sprite) nodesContainer.removeChild(node.sprite);
  }

  treeData = data;
  nodeCounter = 0;

  resetSelection();
  for (let [nodeID, node] of Object.entries(treeData)) {
    const nodeSprite = new PIXI.Sprite(tileSprites.textures[node.type]);
    node.sprite = nodeSprite;

    const nodeX = node.pos[0] * 38;
    const nodeY = node.pos[1] * 38;

    nodeSprite.x = nodeX;
    nodeSprite.y = nodeY;

    nodesContainer.addChild(nodeSprite);

    if (nodeID > nodeCounter) nodeCounter = nodeID;
  }
}

// Read input file and set tree data
function readSingleFile(e) {
  var file = e.target.files[0];
  if (!file) {
    console.warn("Could not load the specified file.");
    return;
  }
  var reader = new FileReader();
  reader.onload = function (e) {
    var contents = e.target.result;
    loadTreeData(JSON.parse(contents));
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
  const tmpNode = {
    pos: [x, y],
    type: inputElems.type.value,
    size: inputElems.size.value,
    name: inputElems.name.value,
    description: inputElems.description.value,
    modifiers: inputElems.modifiers.value,
    alwaysAvailable: inputElems.alwaysAvail.checked,
    adjacent: [],
    requires: [],
  };
  const nodeSprite = new PIXI.Sprite(tileSprites.textures[tmpNode.type]);
  nodeSprite.x = x * 38;
  nodeSprite.y = y * 38;
  nodesContainer.addChild(nodeSprite);
  tmpNode.sprite = nodeSprite;

  nodeCounter++;
  treeData[nodeCounter] = tmpNode;
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
    const node = treeData[nodeID];
    if (node.sprite) nodesContainer.removeChild(node.sprite);
    delete treeData[nodeID];
  }
}

// Mouse event funcs
document.addEventListener("mousedown", (ev) => {
  if (ev.button == 2 && !dragging) {
    dragging = true;
    dragStart.x = ev.pageX;
    dragStart.y = ev.pageY;
  }
});
document.addEventListener("mouseup", (ev) => {
  if (ev.button == 2 && dragging) {
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
    // Draw selected node on mouse
    const canvasRect = canvasDivElem.getBoundingClientRect();
    selectedSprite.x =
      Math.floor((ev.pageX - camera.x - canvasRect.x + 19) / 38) * 38;
    selectedSprite.y =
      Math.floor((ev.pageY - camera.y - canvasRect.y + 19) / 38) * 38;
    selectedSprite.alpha = 0.4;
  }
});

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
    if (tmpNode != undefined) {
      removeNode(tmpNode.nodeID);
    } else {
      addNodeAt(tileX, tileY);
    }
  }
}

// Save palette node data
async function savePaletteData() {
  await window.myFS.saveNodeData(JSON.stringify(paletteNodes, null, 2));
}

// Load palette node data
async function loadPaletteData() {
  try {
    const tmpNodeData = await window.myFS.loadNodeData();
    paletteNodes = JSON.parse(tmpNodeData);
  } catch (err) {
    console.warn("Error loading palette data:", err);
  }
}

// Edit palette node on input change
for (let [elemName, elem] of Object.entries(inputElems)) {
  elem.onchange = (e) => {
    const nodeID = paletteNodes.indexOf(selectedNode);
    if (elem.type == "checkbox")
      paletteNodes[nodeID][elemName] = e.target.checked;
    else paletteNodes[nodeID][elemName] = e.target.value;
    savePaletteData();
  };
}
