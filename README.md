# Isaac Skill Tree Mod Editor

![image](https://github.com/user-attachments/assets/38939c1e-e08f-409d-b5f6-e471e849f50e)

Editor app for Binding of Isaac: Repentance's **Passive Skill Trees** mod. It allows you to create and edit skill trees, and export them to then be included in-game through the mod.

## Usage

The left panel contains inputs that modify the nodes you'll place on the tree. These include:

- **Size:** Small/Med/Large, this should match the shape of the node as it determines the sprite to be drawn when it's allocated. Small: square, Med: cross, Large: octagon.
- **Name:** will show up as the node's title when hovered in-game in the tree screen.
- **Description:** will show up as the node's description when hovered in-game. Make sure to break lines if they become too long, so that they fit on the screen.
- **Modifiers:** set of modifiers this node will apply once allocated. This field must have appropriate JSON notation to work properly.
- **Always Available:** used for root (starting) nodes, these are always allocatable regardless of other connections.
- **Dev Note:** field has no effect on the node and serves to write a note or reminder on where the node is found, or how it works, etc.
  This data gets saved automatically on edit, so you keep what all nodes do.

In the middle is the canvas where the palette and tree view are seen.

- **Tree View:** placed nodes are rendered here. The grey square represents the center of the tree, ideally you should place root nodes (alwaysAvailable) at or near this point.
- **Palette:** the palette contains all the loaded nodes that can be placed on a tree.

Click on a node in the palette to select it, make sure its data is correct and to your liking with the left inputs panel, and click on the tree view to place it somewhere.

Bear in mind, placed nodes have their data set to a snapshot of what's specified on the left panel's inputs. This means for example, if you place a few "XP gain" nodes set to give 2% xp gain, then change the inputs to have the node grant 5% instead, this will not affect the nodes you've already placed, and will only affect newly placed nodes.

Click on a placed node in the tree view to remove it. Ctrl-click a placed node to get a log of its data on the dev console. Shift-click to replace nodes that have the same name without changing their ID.

Mousewheel or up/down arrow keys allow scrolling through the palette.

## Connection Mode

Press C while no inputs are selected to switch to **connection mode**. This lets you connect placed nodes together to form the tree.

While on connection mode, the cursor will draw a teal square. Click a placed node to select it, then click an adjacent node to attempt to create a connection between them. Hold shift while connecting to set the target node as the new source node, to keep connecting.

Connections can only be made horizontally, vertically or diagonally from the source node, and at a distance of up to 1 node away (adjacent or 1 space in between). You can click the source node again to cancel connecting it.

Break a connection by selecting its source and target nodes again in any order.

## How Palette Loads Nodes

Nodes are loaded from the "assets/tree_nodes.anm2" file. Each frame in the "Default" animation represents a node and its sprite data, taking into account its crop X, crop Y, width and height (which can be edited with the ANM2 editor tool).

## Saving and Loading

The input at the top, to the left of "Save Tree" is the filename (without extension) for the current tree. Trees get saved to a "trees" sub-directory within this project's directory, as a JSON file.

The 'Condense data' check condenses save data by turning node objects into one-line JSON strings themselves, saving some space (useful when pasting tree data into lua as it's easier to handle).

'Copy Tree JSON' copies the tree data to your clipboard, allowing you to paste it somewhere else. This takes the 'Condense data' check into account.

At the top left is the file loader, you can load tree JSON files here.
