export const userPresenceKey = (userId: string) => `user:sockets:${userId}`;

export const refreshTokenKey = (tokenHash: string) =>
  `refresh-token:${tokenHash}`;

export const userRefreshTokensKey = (userId: string) =>
  `user:refresh-tokens:${userId}`;
