import axios from 'axios';
import { createApiClient } from '@kps/shared';

let onResponseError;
let http;

beforeEach(() => {
  jest.useFakeTimers();
  http = jest.fn().mockResolvedValue({ data: { ok: true } });
  http.interceptors = {
    request: { use: jest.fn() },
    response: {
      use: (onResponse, onError) => { onResponseError = onError; },
    },
  };
  jest.spyOn(axios, 'create').mockReturnValue(http);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function createClient() {
  return createApiClient({
    baseURL: '/api/v1',
    session: { getSession: jest.fn().mockResolvedValue(null) },
  });
}

test('retries transient GET failures and resolves when the retry succeeds', async () => {
  createClient();
  const config = { method: 'get', url: '/leaves' };
  const retry = onResponseError({ config, response: { status: 503 } });

  jest.advanceTimersByTime(750);
  await Promise.resolve();

  await expect(retry).resolves.toEqual({ data: { ok: true } });
  expect(http).toHaveBeenCalledWith(config);
  expect(config._transientRetries).toBe(1);
});

test('does not retry non-GET requests after a server error', async () => {
  createClient();
  const error = { config: { method: 'post', url: '/leaves' }, response: { status: 503 } };

  await expect(onResponseError(error)).rejects.toBe(error);
  expect(http).not.toHaveBeenCalled();
});
