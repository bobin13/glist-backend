const clients = new Set();

function addClient(response) {
  clients.add(response);

  const heartbeat = setInterval(() => {
    response.write(': keep-alive\n\n');
  }, 25000);

  response.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(response);
  });
}

function publishItemChange(change) {
  const event = `event: items-changed\ndata: ${JSON.stringify(change)}\n\n`;
  clients.forEach((client) => client.write(event));
}

module.exports = { addClient, publishItemChange };
