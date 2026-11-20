const itemsRepository = require('./items.repository');
const events = require('./items.events');
const validate = require('../../lib/validate');

function requestId(req) {
  return req.get('X-Client-Request-Id') || null;
}

async function getItems(req, res) {
  const items = await itemsRepository.findByList(req.params.listId);
  return res.json({ items, role: req.listRole });
}

function streamEvents(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  events.addClient(req.params.listId, req.user.id, res);
}

async function createItem(req, res) {
  const { name, quantity = 1, unit = null } = req.body || {};
  const itemName = validate.name(name, 'Item name', 200);

  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number' });
  }
  if (unit !== null && typeof unit !== 'string') {
    return res.status(400).json({ error: 'Unit must be a string or null' });
  }

  const item = await itemsRepository.create({
    listId: req.params.listId,
    name: itemName,
    quantity,
    unit,
    createdBy: req.user.id
  });
  events.publish(req.params.listId, { type: 'created', item, requestId: requestId(req) });
  return res.status(201).json({ item });
}

async function removeItem(req, res) {
  const { listId, itemId } = req.params;
  const item = validate.isUuid(itemId)
    ? await itemsRepository.markRemoved(listId, itemId, req.user.id)
    : null;

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  events.publish(listId, { type: 'removed', item, requestId: requestId(req) });
  return res.json({ item });
}

module.exports = { getItems, streamEvents, createItem, removeItem };
