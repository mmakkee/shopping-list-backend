const express = require("express");
const mongoose = require("mongoose");
const app = express();
const PORT = 3005;

app.use(express.json());

const AWID = "awid-license-owner-id";
const MONGO_URI = "mongodb://127.0.0.1:27017/shopping-list-db";

mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB", err));

const itemSchema = new mongoose.Schema({
  text: { type: String, required: true },
  solved: { type: Boolean, default: false }
});

const shoppingListSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerId: { type: String, required: true },
  members: [{ type: String }],
  items: [itemSchema],
  state: { type: String, default: "active" }
});

const ShoppingList = mongoose.model("ShoppingList", shoppingListSchema);

const mockUsers = {
  "user123": { id: "user123", name: "Maria (Owner)" },
  "user789": { id: "user789", name: "Ivan (Member)" },
  "user456": { id: "user456", name: "Petr (Stranger)" }
};

const createError = (code, message) => ({
  [code]: {
    type: "Error",
    message: message
  }
});

const authMiddleware = (req, res, next) => {
  const userId = req.headers["x-user-id"] || "user123";
  const user = mockUsers[userId];

  if (!user) {
    return res.status(401).json({
      uuAppErrorMap: createError("uu-app/notAuthenticated", "User not found.")
    });
  }
  req.user = user;
  next();
};

app.use(authMiddleware);

// list/create
app.post("/list/create", async (req, res) => {
  const dtoIn = req.body;
  
  if (!dtoIn.name) {
    return res.status(400).json({
      uuAppErrorMap: createError("list/create/invalidDtoIn", "Missing list name.")
    });
  }

  try {
    const newList = await ShoppingList.create({
      name: dtoIn.name,
      ownerId: req.user.id,
      members: [],
      items: [],
      state: "active"
    });

    res.json({
      awid: AWID,
      id: newList._id,
      name: newList.name,
      ownerId: newList.ownerId,
      members: newList.members,
      items: newList.items,
      state: newList.state,
      uuAppErrorMap: {}
    });
  } catch (e) {
    res.status(500).json({ uuAppErrorMap: createError("list/create/sys", e.message) });
  }
});

// list/get
app.get("/list/get", async (req, res) => {
  const dtoIn = req.query;

  if (!dtoIn.id) {
    return res.status(400).json({
      uuAppErrorMap: createError("list/get/invalidDtoIn", "Missing list ID.")
    });
  }

  try {
    const list = await ShoppingList.findById(dtoIn.id);

    if (!list || (list.ownerId !== req.user.id && !list.members.includes(req.user.id))) {
      return res.status(400).json({
        uuAppErrorMap: createError("list/get/notAuthorized", "List not found or access denied.")
      });
    }

    res.json({
      awid: AWID,
      id: list._id,
      name: list.name,
      ownerId: list.ownerId,
      members: list.members,
      items: list.items,
      state: list.state,
      uuAppErrorMap: {}
    });
  } catch (e) {
    res.status(500).json({ uuAppErrorMap: createError("list/get/sys", e.message) });
  }
});

// list/update
app.post("/list/update", async (req, res) => {
  const dtoIn = req.body;

  if (!dtoIn.id || !dtoIn.name) {
    return res.status(400).json({
      uuAppErrorMap: createError("list/update/invalidDtoIn", "Missing ID or name.")
    });
  }

  try {
    const list = await ShoppingList.findById(dtoIn.id);

    if (!list) {
      return res.status(404).json({ uuAppErrorMap: createError("list/update/notFound", "List not found.") });
    }

    if (list.ownerId !== req.user.id) {
      return res.status(403).json({
        uuAppErrorMap: createError("list/update/notAuthorized", "Only owner can update list.")
      });
    }

    list.name = dtoIn.name;
    await list.save();

    res.json({
      awid: AWID,
      id: list._id,
      name: list.name,
      uuAppErrorMap: {}
    });
  } catch (e) {
    res.status(500).json({ uuAppErrorMap: createError("list/update/sys", e.message) });
  }
});

// list/delete
app.post("/list/delete", async (req, res) => {
  const dtoIn = req.body;

  if (!dtoIn.id) {
    return res.status(400).json({
      uuAppErrorMap: createError("list/delete/invalidDtoIn", "Missing list ID.")
    });
  }

  try {
    const list = await ShoppingList.findById(dtoIn.id);

    if (!list) {
      return res.status(404).json({ uuAppErrorMap: createError("list/delete/notFound", "List not found.") });
    }

    if (list.ownerId !== req.user.id) {
      return res.status(403).json({
        uuAppErrorMap: createError("list/delete/notAuthorized", "Only owner can delete list.")
      });
    }

    await ShoppingList.findByIdAndDelete(dtoIn.id);

    res.json({
      awid: AWID,
      id: dtoIn.id,
      success: true,
      uuAppErrorMap: {}
    });
  } catch (e) {
    res.status(500).json({ uuAppErrorMap: createError("list/delete/sys", e.message) });
  }
});

// list/addMember
app.post("/list/addMember", async (req, res) => {
  const dtoIn = req.body;

  if (!dtoIn.listId || !dtoIn.memberId) {
    return res.status(400).json({
      uuAppErrorMap: createError("list/addMember/invalidDtoIn", "Missing listId or memberId.")
    });
  }

  try {
    const list = await ShoppingList.findById(dtoIn.listId);

    if (!list || list.ownerId !== req.user.id) {
      return res.status(403).json({
        uuAppErrorMap: createError("list/addMember/notAuthorized", "Only owner can add members.")
      });
    }

    if (!list.members.includes(dtoIn.memberId)) {
      list.members.push(dtoIn.memberId);
      await list.save();
    }

    res.json({
      awid: AWID,
      listId: list._id,
      memberId: dtoIn.memberId,
      members: list.members,
      uuAppErrorMap: {}
    });
  } catch (e) {
    res.status(500).json({ uuAppErrorMap: createError("list/addMember/sys", e.message) });
  }
});

// list/removeMember
app.post("/list/removeMember", async (req, res) => {
  const dtoIn = req.body;

  if (!dtoIn.listId || !dtoIn.memberId) {
    return res.status(400).json({
      uuAppErrorMap: createError("list/removeMember/invalidDtoIn", "Missing listId or memberId.")
    });
  }

  try {
    const list = await ShoppingList.findById(dtoIn.listId);

    if (!list || list.ownerId !== req.user.id) {
      return res.status(403).json({
        uuAppErrorMap: createError("list/removeMember/notAuthorized", "Only owner can remove members.")
      });
    }

    list.members = list.members.filter(m => m !== dtoIn.memberId);
    await list.save();

    res.json({
      awid: AWID,
      listId: list._id,
      memberId: dtoIn.memberId,
      members: list.members,
      uuAppErrorMap: {}
    });
  } catch (e) {
    res.status(500).json({ uuAppErrorMap: createError("list/removeMember/sys", e.message) });
  }
});

// list/leaveList
app.post("/list/leaveList", async (req, res) => {
  const dtoIn = req.body;
  if (!dtoIn.listId) {
    return res.status(400).json({ uuAppErrorMap: createError("list/leaveList/invalidDtoIn", "Missing listId.") });
  }

  try {
    const list = await ShoppingList.findById(dtoIn.listId);
    if (!list) return res.status(404).json({ uuAppErrorMap: createError("list/notFound", "List not found.") });

    list.members = list.members.filter(m => m !== req.user.id);
    await list.save();

    res.json({
      awid: AWID,
      listId: list._id,
      leftUserId: req.user.id,
      uuAppErrorMap: {}
    });
  } catch (e) {
    res.status(500).json({ uuAppErrorMap: createError("list/leaveList/sys", e.message) });
  }
});

// item/add
app.post("/item/add", async (req, res) => {
  const dtoIn = req.body;

  if (!dtoIn.listId || !dtoIn.text) {
    return res.status(400).json({
      uuAppErrorMap: createError("item/add/invalidDtoIn", "Missing listId or text.")
    });
  }

  try {
    const list = await ShoppingList.findById(dtoIn.listId);

    if (!list || (list.ownerId !== req.user.id && !list.members.includes(req.user.id))) {
      return res.status(403).json({
        uuAppErrorMap: createError("item/add/notAuthorized", "Access denied.")
      });
    }

    const newItem = { text: dtoIn.text, solved: false };
    list.items.push(newItem);
    await list.save();
    
    const savedItem = list.items[list.items.length - 1];

    res.json({
      awid: AWID,
      listId: list._id,
      item: savedItem,
      uuAppErrorMap: {}
    });
  } catch (e) {
    res.status(500).json({ uuAppErrorMap: createError("item/add/sys", e.message) });
  }
});

// item/remove
app.post("/item/remove", async (req, res) => {
  const dtoIn = req.body;
  if (!dtoIn.listId || !dtoIn.itemId) {
    return res.status(400).json({ uuAppErrorMap: createError("item/remove/invalidDtoIn", "Missing IDs.") });
  }

  try {
    const list = await ShoppingList.findById(dtoIn.listId);
    
    if (!list || (list.ownerId !== req.user.id && !list.members.includes(req.user.id))) {
      return res.status(403).json({ uuAppErrorMap: createError("item/remove/notAuthorized", "Access denied.") });
    }

    list.items.pull({ _id: dtoIn.itemId });
    await list.save();

    res.json({
      awid: AWID,
      listId: list._id,
      removedItemId: dtoIn.itemId,
      uuAppErrorMap: {}
    });
  } catch (e) {
    res.status(500).json({ uuAppErrorMap: createError("item/remove/sys", e.message) });
  }
});

// item/resolve
app.post("/item/resolve", async (req, res) => {
  const dtoIn = req.body;
  if (!dtoIn.listId || !dtoIn.itemId || dtoIn.solved === undefined) {
    return res.status(400).json({ uuAppErrorMap: createError("item/resolve/invalidDtoIn", "Missing fields.") });
  }

  try {
    const list = await ShoppingList.findById(dtoIn.listId);
    if (!list || (list.ownerId !== req.user.id && !list.members.includes(req.user.id))) {
      return res.status(403).json({ uuAppErrorMap: createError("item/resolve/notAuthorized", "Access denied.") });
    }

    const item = list.items.id(dtoIn.itemId);
    if (item) {
      item.solved = dtoIn.solved;
      await list.save();
    }

    res.json({
      awid: AWID,
      listId: list._id,
      item: item,
      uuAppErrorMap: {}
    });
  } catch (e) {
    res.status(500).json({ uuAppErrorMap: createError("item/resolve/sys", e.message) });
  }
});

// item/list
app.get("/item/list", async (req, res) => {
  const dtoIn = req.query;
  if (!dtoIn.listId) {
    return res.status(400).json({ uuAppErrorMap: createError("item/list/invalidDtoIn", "Missing listId.") });
  }

  try {
    const list = await ShoppingList.findById(dtoIn.listId);
    if (!list || (list.ownerId !== req.user.id && !list.members.includes(req.user.id))) {
      return res.status(403).json({ uuAppErrorMap: createError("item/list/notAuthorized", "Access denied.") });
    }

    let resultItems = list.items;
    if (dtoIn.filter === "unresolved") {
      resultItems = resultItems.filter(i => !i.solved);
    }

    res.json({
      awid: AWID,
      listId: list._id,
      items: resultItems,
      uuAppErrorMap: {}
    });
  } catch (e) {
    res.status(500).json({ uuAppErrorMap: createError("item/list/sys", e.message) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});