const express = require('express');
const lists = require('./lists.controller');
const items = require('../items/items.controller');
const { requireAuth } = require('../../middleware/auth');
const { requireListRole } = require('../../middleware/listAccess');

const router = express.Router();
router.use(requireAuth);

const viewer = requireListRole('viewer');
const editor = requireListRole('editor');
const owner = requireListRole('owner');

router.get('/', lists.getMyLists);
router.post('/', lists.createList);
router.patch('/:listId', owner, lists.renameList);
router.delete('/:listId', owner, lists.deleteList);

router.get('/:listId/members', viewer, lists.getMembers);
router.post('/:listId/members', owner, lists.addMember);
router.patch('/:listId/members/:userId', owner, lists.updateMember);
router.delete('/:listId/members/:userId', viewer, lists.removeMember);

router.get('/:listId/items', viewer, items.getItems);
router.get('/:listId/events', viewer, items.streamEvents);
router.post('/:listId/items', editor, items.createItem);
router.delete('/:listId/items/:itemId', editor, items.removeItem);

module.exports = router;
