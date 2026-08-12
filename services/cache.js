// Simple cache wrapper with Redis if available, otherwise in-memory Map with TTL
let redisClient = null;
let useRedis = false;

try {
  // try to require ioredis if installed
  // eslint-disable-next-line global-require
  const IORedis = require('ioredis');
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    redisClient = new IORedis(redisUrl);
    useRedis = true;
  }
} catch (err) {
  // ioredis not installed or failed to initialize; fall back to in-memory cache
  useRedis = false;
}

if (!useRedis) {
  // simple in-memory cache
  const map = new Map();

  function set(key, value, ttlSeconds = 300) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    map.set(key, { value, expiresAt });
  }

  function get(key) {
    const entry = map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      map.delete(key);
      return null;
    }
    return entry.value;
  }

  function del(key) {
    map.delete(key);
  }

  module.exports = { set, get, del, _backend: 'memory' };
} else {
  // Redis-backed implementation
  async function set(key, value, ttlSeconds = 300) {
    try {
      await redisClient.set(key, JSON.stringify(value), 'EX', Math.max(1, Math.floor(ttlSeconds)));
    } catch (err) {
      // swallow redis errors to avoid breaking the request
      // eslint-disable-next-line no-console
      console.warn('redis set failed', err && err.message);
    }
  }

  async function get(key) {
    try {
      const raw = await redisClient.get(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('redis get failed', err && err.message);
      return null;
    }
  }

  async function del(key) {
    try {
      await redisClient.del(key);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('redis del failed', err && err.message);
    }
  }

  module.exports = { set, get, del, _backend: 'redis' };
}
