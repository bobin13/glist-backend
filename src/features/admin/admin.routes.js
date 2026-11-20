const express = require('express');
const admin = require('./admin.controller');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

router.get('/users', admin.listUsers);
router.patch('/users/:userId', admin.updateUser);
router.delete('/users/:userId', admin.deleteUser);

module.exports = router;
