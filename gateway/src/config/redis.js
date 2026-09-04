const { createClient } = require('redis');
require('dotenv').config();

let redisClient;
let isMock = false;
const mockStore = {};

const mockClient = {
  get: async (key) => mockStore[key] || null,
  set: async (key, val, options) => {
    mockStore[key] = val;
    if (options && options.EX) {
      setTimeout(() => {
        delete mockStore[key];
      }, options.EX * 1000);
    }
    return 'OK';
  },
  del: async (key) => {
    delete mockStore[key];
    return 1;
  },
  connect: async () => {},
  on: () => {},
  isOpen: false
};

try {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 0) {
          return false; // Stop trying to reconnect after first failure
        }
        return 500;
      }
    }
  });

  redisClient.on('error', (err) => {
    console.warn('Redis connection issue, Degrading to in-memory mock cache:', err.message);
    isMock = true;
  });

  redisClient.on('connect', () => {
    console.log('Connected to Redis cache successfully.');
  });
} catch (e) {
  console.warn('Failed initializing Redis client, using in-memory mock:', e.message);
  redisClient = mockClient;
  isMock = true;
}

// Intercept get/set/del to use mock if connection fails or is disconnected
const originalGet = redisClient.get;
const originalSet = redisClient.set;
const originalDel = redisClient.del;

redisClient.get = async function(key) {
  if (isMock || !redisClient.isOpen) {
    return mockStore[key] || null;
  }
  try {
    return await originalGet.call(redisClient, key);
  } catch (err) {
    return mockStore[key] || null;
  }
};

redisClient.set = async function(key, val, options) {
  if (isMock || !redisClient.isOpen) {
    mockStore[key] = val;
    return 'OK';
  }
  try {
    return await originalSet.call(redisClient, key, val, options);
  } catch (err) {
    mockStore[key] = val;
    return 'OK';
  }
};

redisClient.del = async function(key) {
  if (isMock || !redisClient.isOpen) {
    delete mockStore[key];
    return 1;
  }
  try {
    return await originalDel.call(redisClient, key);
  } catch (err) {
    delete mockStore[key];
    return 1;
  }
};

// Immediately connect to Redis in development
(async () => {
  try {
    if (!isMock) {
      await redisClient.connect();
    }
  } catch (error) {
    console.warn('Could not connect to Redis server, fallback to in-memory:', error.message);
    isMock = true;
  }
})();

module.exports = redisClient;
