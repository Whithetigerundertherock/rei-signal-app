const { readSession } = require("./_auth");

module.exports = async function handler(request, response) {
  const user = readSession(request);
  response.status(200).json({ authenticated: Boolean(user), user });
};
