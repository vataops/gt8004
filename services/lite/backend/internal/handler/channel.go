package handler

import (
	"math/big"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/AEL/aes-lite/internal/channel"
	"github.com/AEL/aes-common/ws"
	"github.com/AEL/aes-lite/internal/x402"
)

func (h *Handler) CreateChannel(c *gin.Context) {
	var req channel.CreateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Default to lite mode
	if req.Mode == "" {
		req.Mode = channel.ModeLite
	}

	// x402 payment: extract verified payment info (set by middleware)
	payment := x402.GetPayment(c)
	if payment != nil {
		req.USDCAmount = payment.Amount
		h.logger.Info("x402 payment verified",
			zap.Float64("amount", payment.Amount),
			zap.String("tx_hash", payment.TxHash),
		)
	}

	ch, err := h.engine.CreateChannel(c.Request.Context(), req)
	if err != nil {
		h.logger.Error("failed to create channel", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Call Escrow deposit on-chain (if configured)
	if h.escrow != nil && payment != nil {
		usdcWei := new(big.Int)
		usdcWei.SetInt64(int64(payment.Amount * 1e6)) // USDC has 6 decimals
		txHash, err := h.escrow.Deposit(c.Request.Context(), ch.ChannelID, usdcWei)
		if err != nil {
			h.logger.Error("escrow deposit failed", zap.Error(err))
		} else if txHash != "" {
			h.logger.Info("escrow deposit sent", zap.String("tx_hash", txHash))
		}
	}

	// Broadcast channel creation event
	h.hub.Broadcast(ws.Event{
		Type:      "channel_created",
		ChannelID: ch.ChannelID,
		Payload:   ch,
	})

	c.JSON(http.StatusCreated, ch)
}

func (h *Handler) GetChannel(c *gin.Context) {
	id := c.Param("id")
	ch, err := h.engine.GetChannel(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}

	// Include balances
	balances, _ := h.engine.GetBalances(c.Request.Context(), id)

	c.JSON(http.StatusOK, gin.H{
		"channel":  ch,
		"balances": balances,
	})
}

type topupRequest struct {
	AgentID string `json:"agent_id" binding:"required"`
	Amount  int64  `json:"amount" binding:"required,gt=0"`
}

func (h *Handler) TopupChannel(c *gin.Context) {
	id := c.Param("id")
	var req topupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// x402 payment: if middleware verified, use payment amount
	payment := x402.GetPayment(c)
	if payment != nil {
		req.Amount = int64(payment.Amount * channel.CreditRatio)
	}

	if err := h.engine.TopupCredits(c.Request.Context(), id, req.AgentID, req.Amount); err != nil {
		h.logger.Error("failed to topup", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Escrow topup on-chain
	if h.escrow != nil && payment != nil {
		usdcWei := new(big.Int)
		usdcWei.SetInt64(int64(payment.Amount * 1e6))
		if txHash, err := h.escrow.Topup(c.Request.Context(), id, usdcWei); err != nil {
			h.logger.Error("escrow topup failed", zap.Error(err))
		} else if txHash != "" {
			h.logger.Info("escrow topup sent", zap.String("tx_hash", txHash))
		}
	}

	// Broadcast topup event
	h.hub.Broadcast(ws.Event{
		Type:      "credits_topped_up",
		ChannelID: id,
		Payload: gin.H{
			"agent_id":      req.AgentID,
			"credits_added": req.Amount,
		},
	})

	c.JSON(http.StatusOK, gin.H{"status": "topped_up", "channel_id": id, "credits_added": req.Amount})
}

func (h *Handler) CloseChannel(c *gin.Context) {
	id := c.Param("id")

	stl, err := h.engine.CloseChannel(c.Request.Context(), id)
	if err != nil {
		h.logger.Error("failed to close channel", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Escrow settle on-chain via Settler
	var settleTxHash string
	if h.settler != nil {
		txHash, err := h.settler.Settle(c.Request.Context(), stl)
		if err != nil {
			h.logger.Error("escrow settle failed", zap.Error(err),
				zap.String("channel", id))
		} else {
			settleTxHash = txHash
		}
	}

	// Broadcast channel settled event
	h.hub.Broadcast(ws.Event{
		Type:      "channel_settled",
		ChannelID: id,
		Payload: gin.H{
			"settlement":     stl,
			"settle_tx_hash": settleTxHash,
		},
	})

	resp := gin.H{"settlement": stl}
	if settleTxHash != "" {
		resp["settle_tx_hash"] = settleTxHash
	}

	c.JSON(http.StatusOK, resp)
}
