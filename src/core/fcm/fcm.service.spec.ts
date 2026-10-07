import { FCM_MULTICAST_TOKEN_LIMIT } from './fcm.service';

describe('FCM_MULTICAST_TOKEN_LIMIT', () => {
  it('matches Firebase multicast cap', () => {
    expect(FCM_MULTICAST_TOKEN_LIMIT).toBe(500);
  });
});

describe('FCM token chunking', () => {
  function chunkTokens(tokens: string[]): string[][] {
    const chunks: string[][] = [];
    for (let offset = 0; offset < tokens.length; offset += FCM_MULTICAST_TOKEN_LIMIT) {
      chunks.push(tokens.slice(offset, offset + FCM_MULTICAST_TOKEN_LIMIT));
    }
    return chunks;
  }

  it('splits 1200 tokens into three batches of 500', () => {
    const tokens = Array.from({ length: 1200 }, (_, i) => `t${i}`);
    const chunks = chunkTokens(tokens);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(500);
    expect(chunks[1]).toHaveLength(500);
    expect(chunks[2]).toHaveLength(200);
  });
});
