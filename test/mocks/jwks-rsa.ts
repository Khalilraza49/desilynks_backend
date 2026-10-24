export class JwksClient {
  async getSigningKey(): Promise<never> {
    throw new Error('JWKS is not available in tests');
  }
}
