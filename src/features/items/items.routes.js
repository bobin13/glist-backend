const express = require('express');
const itemsController = require('./items.controller');

const router = express.Router();

router.get('/', itemsController.getAllItems);
router.get('/events', itemsController.streamItemEvents);
router.post('/', itemsController.createItem);
router.delete('/:id', itemsController.deleteItem);

module.exports = router;