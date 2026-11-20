// Server-sent events, one channel per list. Only members are subscribed (checked by the route).
// Note: clients live in this process's memory, so on serverless hosts an event only reaches
// clients connected to the same instance; the frontend also refreshes on reconnect.
const channels = new Map(); // listId -> Map(response -> userId)

function addClient(listId, userId, response) {
  if (!channels.has(listId)) channels.set(listId, new Map());
  const clients = channels.get(listId);
  clients.set(response, userId);

  const heartbeat = setInterval(() => {
    response.write(': keep-alive\n\n');
  }, 25000);

  response.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(response);
    if (clients.size === 0) channels.delete(listId);
  });
}

// change: { type: 'created' | 'removed' | 'list-updated' | 'list-deleted' | 'members-changed', ... }
function publish(listId, change) {
  const clients = channels.get(listId);
  if (!clients) return;
  const event = `event: list-changed\ndata: ${JSON.stringify({ listId, ...change })}\n\n`;
  clients.forEach((userId, client) => client.write(event));
}

// Closes the stream of a user who lost access (or of everyone, when userId is omitted).
function disconnect(listId, userId) {
  const clients = channels.get(listId);
  if (!clients) return;
  clients.forEach((clientUserId, client) => {
    if (userId === undefined || clientUserId === userId) client.end();
  });
}

module.exports = { addClient, publish, disconnect };
