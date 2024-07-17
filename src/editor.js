const spriteAtlas = {
  frames: {},
  meta: {
    image: "assets/tree_nodes.png",
    format: "RGBA8888",
    size: { w: 320, h: 320 },
    scale: 1,
  },
};

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

  const tileSprites = new PIXI.Spritesheet(
    PIXI.Texture.from(spriteAtlas.meta.image),
    spriteAtlas
  );

  await tileSprites.parse();

  const testSprite = new PIXI.Sprite(tileSprites.textures["Small XP"]);
  app.stage.addChild(testSprite);
}
main();
