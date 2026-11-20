const listsRepository = require('../features/lists/lists.repository');
const { isUuid } = require('../lib/validate');

const ROLE_RANK = { viewer: 1, editor: 2, owner: 3 };

// Allows the request only if the signed-in user is on the list with at least `minimumRole`.
// Sets req.listRole. Non-members get 404 so list IDs can't be probed.
function requireListRole(minimumRole) {
  return async function listAccess(req, res, next) {
    const { listId } = req.params;
    const role = isUuid(listId) ? await listsRepository.findRole(listId, req.user.id) : null;

    if (!role) {
      return res.status(404).json({ error: 'List not found' });
    }
    if (ROLE_RANK[role] < ROLE_RANK[minimumRole]) {
      const action = minimumRole === 'owner' ? 'Only the list owner can do that' : 'You can only view this list';
      return res.status(403).json({ error: action });
    }

    req.listRole = role;
    return next();
  };
}

module.exports = { requireListRole };
