package httptransport

import (
	"net/http"
	"time"

	"saleor-tma-backend/internal/telegram"
)

type TelegramAuthMiddleware struct {
	BotToken string
	MaxAge   time.Duration
}

func (m TelegramAuthMiddleware) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		initData := r.Header.Get("X-Telegram-Init-Data")
		if initData == "" {
			http.Error(w, "missing X-Telegram-Init-Data", http.StatusUnauthorized)
			return
		}

		auth, err := telegram.VerifyInitData(r.Context(), initData, m.BotToken, m.MaxAge)
		if err != nil {
			http.Error(w, "invalid telegram init data", http.StatusUnauthorized)
			return
		}

		ctx := telegram.WithAuth(r.Context(), auth)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

