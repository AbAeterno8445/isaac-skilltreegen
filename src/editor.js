const spriteAtlas = {
  frames: {},
  meta: {
    image: "assets/tree_nodes.png",
    format: "RGBA8888",
    size: { w: 320, h: 320 },
    scale: 1,
  },
};

let treeData = {};
let stageSprites = [];

let tileSprites = undefined;

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
    const frameElem =
      anim.getElementsByTagName("LayerAnimation")[0].firstElementChild;

    spriteAtlas.frames[anim.getAttribute("Name")] = {
      frame: {
        x: 0,
        y: 0,
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
  }

  const app = new PIXI.Application();
  await app.init({ width: 800, height: 600 });

  document.body.append(app.canvas);

  tileSprites = new PIXI.Spritesheet(
    PIXI.Texture.from(spriteAtlas.meta.image),
    spriteAtlas
  );

  await tileSprites.parse();

  app.stage.addChild(nodesContainer);
}
main();

function loadTreeData(data) {
  treeData = data;

  if (stageSprites.length > 0) {
    for (let sprite of stageSprites) {
      app.stage.removeChild(sprite);
    }
  }
  stageSprites = [];

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
