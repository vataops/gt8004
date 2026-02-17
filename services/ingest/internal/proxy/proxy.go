package proxy

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"go.uber.org/zap"
)

const maxBodyCapture = 51200 // 50KB

// ProxyResult captures metrics and body data from a proxied request.
type ProxyResult struct {
	StatusCode     int
	ResponseMs     float64
	Error          error
	RequestBody    string
	ResponseBody   string
	RequestHeaders map[string]string
}

// responseCapture wraps http.ResponseWriter to tee the response body.
type responseCapture struct {
	http.ResponseWriter
	body    *bytes.Buffer
	maxCap  int
	written int
}

func (rc *responseCapture) Write(b []byte) (int, error) {
	if rc.written < rc.maxCap {
		remaining := rc.maxCap - rc.written
		if len(b) <= remaining {
			rc.body.Write(b)
		} else {
			rc.body.Write(b[:remaining])
		}
		rc.written += len(b)
	}
	return rc.ResponseWriter.Write(b)
}

func (rc *responseCapture) Flush() {
	if f, ok := rc.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Proxy provides reverse-proxy functionality for the GT8004 ingest gateway.
type Proxy struct {
	logger *zap.Logger
}

// NewProxy creates a new Proxy.
func NewProxy(logger *zap.Logger) *Proxy {
	return &Proxy{logger: logger}
}

// Forward proxies the request to the given origin endpoint and returns metrics.
func (p *Proxy) Forward(w http.ResponseWriter, r *http.Request, originEndpoint string, path string) *ProxyResult {
	result := &ProxyResult{}

	target, err := url.Parse(originEndpoint)
	if err != nil {
		p.logger.Error("invalid origin endpoint", zap.String("origin", originEndpoint), zap.Error(err))
		http.Error(w, "invalid origin endpoint", http.StatusBadGateway)
		result.StatusCode = http.StatusBadGateway
		result.Error = err
		return result
	}

	// Capture request body
	if r.Body != nil {
		bodyBytes, readErr := io.ReadAll(io.LimitReader(r.Body, maxBodyCapture+1))
		if readErr == nil && len(bodyBytes) > 0 {
			if len(bodyBytes) > maxBodyCapture {
				result.RequestBody = string(bodyBytes[:maxBodyCapture])
			} else {
				result.RequestBody = string(bodyBytes)
			}
			// Restore body for the proxy
			r.Body = io.NopCloser(bytes.NewReader(bodyBytes))
		}
	}

	// Capture request headers
	result.RequestHeaders = map[string]string{}
	if ua := r.Header.Get("User-Agent"); ua != "" {
		result.RequestHeaders["user-agent"] = ua
	}
	if ct := r.Header.Get("Content-Type"); ct != "" {
		result.RequestHeaders["content-type"] = ct
	}
	if ref := r.Header.Get("Referer"); ref != "" {
		result.RequestHeaders["referer"] = ref
	}
	if xai := r.Header.Get("X-Agent-ID"); xai != "" {
		result.RequestHeaders["x-agent-id"] = xai
	}
	// Client IP extraction
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		result.RequestHeaders["client-ip"] = strings.Split(ip, ",")[0]
	} else if ip := r.Header.Get("X-Real-IP"); ip != "" {
		result.RequestHeaders["client-ip"] = ip
	} else if r.RemoteAddr != "" {
		result.RequestHeaders["client-ip"] = r.RemoteAddr
	}

	start := time.Now()

	// Wrap writer to capture response body
	capture := &responseCapture{
		ResponseWriter: w,
		body:           &bytes.Buffer{},
		maxCap:         maxBodyCapture,
	}

	proxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.URL.Path = path
			req.Host = target.Host
			req.Header.Set("X-Forwarded-By", "GT8004-Ingest")
		},
		Transport: &http.Transport{
			ResponseHeaderTimeout: 30 * time.Second,
		},
		ModifyResponse: func(resp *http.Response) error {
			result.StatusCode = resp.StatusCode
			resp.Header.Del("Access-Control-Allow-Origin")
			resp.Header.Del("Access-Control-Allow-Methods")
			resp.Header.Del("Access-Control-Allow-Headers")
			resp.Header.Del("Access-Control-Max-Age")
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			p.logger.Error("proxy error", zap.String("origin", originEndpoint), zap.Error(err))
			http.Error(w, "gateway error: upstream unreachable", http.StatusBadGateway)
			result.StatusCode = http.StatusBadGateway
			result.Error = err
		},
	}

	proxy.ServeHTTP(capture, r)
	result.ResponseMs = float64(time.Since(start).Milliseconds())
	result.ResponseBody = capture.body.String()

	return result
}
