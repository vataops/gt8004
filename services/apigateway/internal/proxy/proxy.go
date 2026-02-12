package proxy

import (
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ProxyTo creates a Gin handler that proxies requests to the target URL
func ProxyTo(targetURL string, logger *zap.Logger) gin.HandlerFunc {
	target, err := url.Parse(targetURL)
	if err != nil {
		logger.Fatal("invalid target URL", zap.String("url", targetURL), zap.Error(err))
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	// Custom director to preserve headers
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target.Host
		req.URL.Host = target.Host
		req.URL.Scheme = target.Scheme
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
