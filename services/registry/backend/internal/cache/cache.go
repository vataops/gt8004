package cache

import (
	"context"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// Cache wraps a Redis client with graceful fallback on failure.
type Cache struct {
	client *redis.Client
	logger *zap.Logger
}

// New creates a Redis-backed cache. Returns nil cache (no-op) if redisURL is empty.
func New(redisURL string, logger *zap.Logger) (*Cache, error) {
	if redisURL == "" {
		logger.Info("redis not configured, caching disabled")
		return nil, nil
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		logger.Warn("redis ping failed, continuing without cache", zap.Error(err))
		client.Close()
		return nil, nil
	}

	logger.Info("redis connected", zap.String("addr", opts.Addr))
	return &Cache{client: client, logger: logger}, nil
}

// Get returns cached bytes or nil on miss/error.
func (c *Cache) Get(ctx context.Context, key string) []byte {
	if c == nil {
		return nil
	}
	val, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		if !errors.Is(err, redis.Nil) {
			c.logger.Warn("cache get error", zap.String("key", key), zap.Error(err))
		}
		return nil
	}
	return val
}

// Set stores bytes with a TTL. Errors are logged but not returned.
func (c *Cache) Set(ctx context.Context, key string, val []byte, ttl time.Duration) {
	if c == nil {
		return
	}
	if err := c.client.Set(ctx, key, val, ttl).Err(); err != nil {
		c.logger.Warn("cache set error", zap.String("key", key), zap.Error(err))
	}
}

// Del removes one or more keys.
func (c *Cache) Del(ctx context.Context, keys ...string) {
	if c == nil || len(keys) == 0 {
		return
	}
	if err := c.client.Del(ctx, keys...).Err(); err != nil {
		c.logger.Warn("cache del error", zap.Strings("keys", keys), zap.Error(err))
	}
}

// DelPattern removes all keys matching a glob pattern (e.g. "agent:abc:*").
func (c *Cache) DelPattern(ctx context.Context, pattern string) {
	if c == nil {
		return
	}
	var cursor uint64
	for {
		keys, next, err := c.client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			c.logger.Warn("cache scan error", zap.String("pattern", pattern), zap.Error(err))
			return
		}
		if len(keys) > 0 {
			c.client.Del(ctx, keys...)
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
}

// Close shuts down the Redis connection.
func (c *Cache) Close() error {
	if c == nil {
		return nil
	}
	return c.client.Close()
}
