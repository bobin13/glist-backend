const listsRepository = require('./lists.repository');
const usersRepository = require('../users/users.repository');
const events = require('../items/items.events');
const validate = require('../../lib/validate');

const MEMBER_ROLES = ['editor', 'viewer'];

function memberRole(value) {
  if (value === undefined) return 'editor';
  if (!MEMBER_ROLES.includes(value)) {
    throw new validate.ValidationError('Role must be "editor" or "viewer"');
  }
  return value;
}

async function getMyLists(req, res) {
  const lists = await listsRepository.findForUser(req.user.id);
  return res.json({ lists });
}

async function createList(req, res) {
  const name = validate.name(req.body?.name, 'List name');
  const list = await listsRepository.create(name, req.user.id);
  return res.status(201).json({
    list: { ...list, role: 'owner', owner_name: req.user.display_name, member_count: 1 }
  });
}

async function renameList(req, res) {
  const name = validate.name(req.body?.name, 'List name');
  const list = await listsRepository.rename(req.params.listId, name);
  events.publish(req.params.listId, { type: 'list-updated', name: list.name });
  return res.json({ list });
}

async function deleteList(req, res) {
  await listsRepository.remove(req.params.listId);
  events.publish(req.params.listId, { type: 'list-deleted' });
  events.disconnect(req.params.listId);
  return res.status(204).end();
}

async function getMembers(req, res) {
  const members = await listsRepository.findMembers(req.params.listId);
  return res.json({ members });
}

async function addMember(req, res) {
  const email = validate.email(req.body?.email);
  const role = memberRole(req.body?.role);

  const found = await usersRepository.findByEmailWithPassword(email);
  if (!found || found.is_disabled) {
    return res.status(404).json({ error: 'No account uses that email. Ask them to sign up first.' });
  }

  const added = await listsRepository.addMember(req.params.listId, found.id, role);
  if (!added) {
    return res.status(409).json({ error: 'That person is already on this list' });
  }

  events.publish(req.params.listId, { type: 'members-changed' });
  return res.status(201).json({ members: await listsRepository.findMembers(req.params.listId) });
}

async function updateMember(req, res) {
  const role = memberRole(req.body?.role);
  const updated = validate.isUuid(req.params.userId)
    && await listsRepository.updateMemberRole(req.params.listId, req.params.userId, role);
  if (!updated) {
    return res.status(404).json({ error: 'Member not found (the owner\'s role can\'t be changed)' });
  }

  events.publish(req.params.listId, { type: 'members-changed' });
  return res.json({ members: await listsRepository.findMembers(req.params.listId) });
}

// Owners can remove anyone else; any member can remove themselves (leave the list).
async function removeMember(req, res) {
  const { listId, userId } = req.params;
  const isSelf = userId === req.user.id;

  if (!isSelf && req.listRole !== 'owner') {
    return res.status(403).json({ error: 'Only the list owner can remove people' });
  }
  if (isSelf && req.listRole === 'owner') {
    return res.status(400).json({ error: 'The owner can\'t leave their own list. Delete it instead.' });
  }

  const removed = validate.isUuid(userId) && await listsRepository.removeMember(listId, userId);
  if (!removed) {
    return res.status(404).json({ error: 'Member not found' });
  }

  events.publish(listId, { type: 'members-changed', removedUserId: userId });
  events.disconnect(listId, userId);
  return res.status(204).end();
}

module.exports = {
  getMyLists,
  createList,
  renameList,
  deleteList,
  getMembers,
  addMember,
  updateMember,
  removeMember
};
