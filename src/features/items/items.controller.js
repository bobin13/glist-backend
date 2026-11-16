const itemsService = require('./items.service');
const itemsEvents = require('./items.events');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getAllItems(req, res) {
  try {
    const items = await itemsService.getAllItems();
    return res.status(200).json({ items });
  } catch (error) {
    console.error('Failed to retrieve grocery items:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve grocery items' });
  }
}

function streamItemEvents(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  itemsEvents.addClient(res);
}

async function createItem(req, res) {
  const { list_id, name, quantity, unit, created_by } = req.body || {};

  if (!uuidPattern.test(list_id || '') || !uuidPattern.test(created_by || '')) {
    return res.status(400).json({ error: 'Valid list_id and created_by UUIDs are required' });
  }

  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'A non-empty name is required' });
  }

  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number' });
  }

  if (unit !== undefined && unit !== null && typeof unit !== 'string') {
    return res.status(400).json({ error: 'Unit must be a string or null' });
  }

  try {
    const item = await itemsService.createItem({
      list_id,
      name: name.trim(),
      quantity,
      unit: unit ?? null,
      created_by
    });
    itemsEvents.publishItemChange({
      type: 'created',
      item,
      requestId: req.get('X-Client-Request-Id') || null
    });
    return res.status(201).json({ item });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ error: 'list_id or created_by does not exist' });
    }

    console.error('Failed to create grocery item:', error.message);
    return res.status(500).json({ error: 'Failed to create grocery item' });
  }
}

async function deleteItem(req, res) {
  const { id } = req.params;

  if (!uuidPattern.test(id)) {
    return res.status(400).json({ error: 'A valid item UUID is required' });
  }

  try {
    const item = await itemsService.deleteItem(id);
    if (!item) {
      return res.status(404).json({ error: 'Grocery item not found' });
    }

    itemsEvents.publishItemChange({
      type: 'removed',
      item,
      requestId: req.get('X-Client-Request-Id') || null
    });
    return res.status(200).json({ item });
  } catch (error) {
    console.error('Failed to delete grocery item:', error.message);
    return res.status(500).json({ error: 'Failed to delete grocery item' });
  }
}

module.exports = { getAllItems, streamItemEvents, createItem, deleteItem };