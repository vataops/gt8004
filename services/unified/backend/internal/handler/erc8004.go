package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) AgentDescriptor(c *gin.Context) {
	if h.erc8004 == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "ERC-8004 not configured"})
		return
	}
	descriptor := h.erc8004.BuildDescriptor()
	c.JSON(http.StatusOK, descriptor)
}
