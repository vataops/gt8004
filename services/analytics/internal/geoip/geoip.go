package geoip

import (
	"net"
	"sync"

	"github.com/oschwald/geoip2-golang"
	"go.uber.org/zap"
)

// Result holds resolved geolocation data from an IP address.
type Result struct {
	Country string // ISO 3166-1 alpha-2 (e.g., "KR", "US")
	City    string // City name in English
}

// Resolver resolves IP addresses to geographic locations using MaxMind GeoLite2.
// If no database is loaded, all lookups return nil (no-op).
type Resolver struct {
	db     *geoip2.Reader
	logger *zap.Logger
	mu     sync.RWMutex
}

// New creates a Resolver. If dbPath is empty or the file cannot be opened,
// the resolver operates in no-op mode (all lookups return nil).
func New(dbPath string, logger *zap.Logger) *Resolver {
	r := &Resolver{logger: logger}

	if dbPath == "" {
		logger.Info("geoip: no database path configured, geolocation disabled")
		return r
	}

	db, err := geoip2.Open(dbPath)
	if err != nil {
		logger.Warn("geoip: failed to open database, geolocation disabled",
			zap.String("path", dbPath),
			zap.Error(err),
		)
		return r
	}

	r.db = db
	logger.Info("geoip: database loaded", zap.String("path", dbPath))
	return r
}

// Lookup resolves an IP string to country and city.
// Returns nil if the resolver has no database or the IP is invalid/private.
func (r *Resolver) Lookup(ipStr string) *Result {
	if r.db == nil {
		return nil
	}

	ip := net.ParseIP(ipStr)
	if ip == nil {
		return nil
	}

	// Skip private/loopback addresses
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() {
		return nil
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	record, err := r.db.City(ip)
	if err != nil {
		return nil
	}

	result := &Result{}
	if record.Country.IsoCode != "" {
		result.Country = record.Country.IsoCode
	}
	if name, ok := record.City.Names["en"]; ok && name != "" {
		result.City = name
	}

	if result.Country == "" && result.City == "" {
		return nil
	}

	return result
}

// Close closes the underlying database.
func (r *Resolver) Close() {
	if r.db != nil {
		r.db.Close()
	}
}
