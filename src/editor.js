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

let selectedNode = undefined;

let nodesContainer = new PIXI.Container();

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
}

function loadTreeData(data) {
  treeData = data;

  if (stageSprites.length > 0) {
    for (let sprite of stageSprites) {
      app.stage.removeChild(sprite);
    }
  }
  stageSprites = [];

  resetSelection();
  for (let [nodeID, node] of Object.entries(treeData)) {
    const nodeSprite = new PIXI.Sprite(tileSprites.textures[node.type]);

    const nodeX = node.pos[0] * 38;
    const nodeY = node.pos[1] * 38;

    nodeSprite.x = nodeX;
    nodeSprite.y = nodeY;

    stageSprites.push(nodeSprite);
    nodesContainer.addChild(nodeSprite);
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

// Mouse event funcs
document.addEventListener("mousedown", (ev) => {
  if (ev.button == 0) {
    const canvasRect = canvasDivElem.getBoundingClientRect();

    // Clicked palette
    if (
      ev.pageX >= canvasRect.x &&
      ev.pageX <= canvasRect.x + paletteBG.width
    ) {
      const tileX = Math.floor((ev.pageX - canvasRect.x) / 32);
      const tileY = Math.floor((ev.pageY - canvasRect.y) / 32);
      const clickedID = tileX + tileY * 5;
      if (clickedID < paletteNodes.length) {
        selectedNode = paletteNodes[clickedID];
        setInputElems(selectedNode);

        selectorSprite.x = tileX * 32;
        selectorSprite.y = tileY * 32;
      }
    }
  }

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
  }
});

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
