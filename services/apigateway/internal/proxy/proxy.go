package proxy

import (
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Identity token cache for Cloud Run service-to-service auth
var (
	tokenMu    sync.RWMutex
	tokenCache = make(map[string]*cachedToken)
)

type cachedToken struct {
	token   string
	expires time.Time
}

// getIdentityToken fetches a GCP identity token from the metadata server.
// Returns empty string on non-GCP environments (local dev).
func getIdentityToken(audience string) string {
	tokenMu.RLock()
	if ct, ok := tokenCache[audience]; ok && time.Now().Before(ct.expires) {
		tokenMu.RUnlock()
		return ct.token
	}
	tokenMu.RUnlock()

	req, err := http.NewRequest("GET",
		"http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience="+url.QueryEscape(audience),
		nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Metadata-Flavor", "Google")

	resp, err := (&http.Client{Timeout: 3 * time.Second}).Do(req)
	if err != nil {
		return "" // not on GCP — skip auth
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ""
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}

	token := string(body)
	tokenMu.Lock()
	tokenCache[audience] = &cachedToken{token: token, expires: time.Now().Add(45 * time.Minute)}
	tokenMu.Unlock()

	return token
}

// ProxyTo creates a Gin handler that proxies requests to the target URL
func ProxyTo(targetURL string, logger *zap.Logger) gin.HandlerFunc {
	target, err := url.Parse(targetURL)
	if err != nil {
		logger.Fatal("invalid target URL", zap.String("url", targetURL), zap.Error(err))
	}

	// Audience for identity token (base URL without path)
	audience := target.Scheme + "://" + target.Host

	proxy := httputil.NewSingleHostReverseProxy(target)

	// Custom director to preserve headers and add identity token
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target.Host
		req.URL.Host = target.Host
		req.URL.Scheme = target.Scheme

		// Add GCP identity token for Cloud Run service-to-service auth
		if token := getIdentityToken(audience); token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
	}

	// Strip CORS headers from backend responses — the API Gateway's own
	// CORS middleware is the single source of truth for these headers.
	proxy.ModifyResponse = func(resp *http.Response) error {
		resp.Header.Del("Access-Control-Allow-Origin")
		resp.Header.Del("Access-Control-Allow-Methods")
		resp.Header.Del("Access-Control-Allow-Headers")
		resp.Header.Del("Access-Control-Max-Age")
		resp.Header.Del("Access-Control-Allow-Credentials")
		return nil
	}

	// Error handler
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		logger.Error("proxy error",
			zap.String("target", targetURL),
			zap.String("path", r.URL.Path),
			zap.Error(err))
		w.WriteHeader(http.StatusBadGateway)
		w.Write([]byte("Bad Gateway"))
	}

	return func(c *gin.Context) {
		// Forward important headers
		c.Request.Header.Set("X-Real-IP", c.ClientIP())

		// Preserve X-Wallet-Address if present
		if walletAddr := c.GetHeader("X-Wallet-Address"); walletAddr != "" {
			c.Request.Header.Set("X-Wallet-Address", walletAddr)
		}

		proxy.ServeHTTP(c.Writer, c.Request)
	}
}
