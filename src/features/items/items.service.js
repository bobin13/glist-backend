const itemsRepository = require('./items.repository');

async function getAllItems() {
  return itemsRepository.findAll();
}

async function createItem(item) {
  return itemsRepository.create(item);
}

async function deleteItem(id) {
  return itemsRepository.markRemovedById(id);
}

module.exports = { getAllItems, createItem, deleteItem };