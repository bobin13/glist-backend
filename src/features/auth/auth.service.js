class AuthenticationProviderNotConfiguredError extends Error {
  constructor() {
    super('Configure credential verification before enabling login');
    this.code = 'AUTH_PROVIDER_NOT_CONFIGURED';
  }
}

async function authenticate() {
  throw new AuthenticationProviderNotConfiguredError();
}

module.exports = { authenticate };