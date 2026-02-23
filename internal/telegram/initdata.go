package telegram

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

type User struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Username  string `json:"username"`
	Language  string `json:"language_code"`
}

type AuthResult struct {
	User     User
	AuthDate time.Time
}

var ErrInvalidInitData = errors.New("invalid telegram init data")

func VerifyInitData(ctx context.Context, initData string, botToken string, maxAge time.Duration) (AuthResult, error) {
	_ = ctx

	values, err := url.ParseQuery(initData)
	if err != nil {
		return AuthResult{}, fmt.Errorf("%w: parse query: %v", ErrInvalidInitData, err)
	}

	hash := values.Get("hash")
	if hash == "" {
		return AuthResult{}, fmt.Errorf("%w: missing hash", ErrInvalidInitData)
	}

	pairs := make([]string, 0, len(values))
	for k := range values {
		if k == "hash" {
			continue
		}
		// Telegram initData keys are unique in practice, keep first.
		pairs = append(pairs, k+"="+values.Get(k))
	}
	sort.Strings(pairs)
	dataCheckString := strings.Join(pairs, "\n")

	secret := sha256.Sum256([]byte(botToken))
	mac := hmac.New(sha256.New, secret[:])
	_, _ = mac.Write([]byte(dataCheckString))
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(strings.ToLower(hash)), []byte(strings.ToLower(expected))) {
		return AuthResult{}, fmt.Errorf("%w: signature mismatch", ErrInvalidInitData)
	}

	authDateRaw := values.Get("auth_date")
	if authDateRaw == "" {
		return AuthResult{}, fmt.Errorf("%w: missing auth_date", ErrInvalidInitData)
	}
	sec, err := strconv.ParseInt(authDateRaw, 10, 64)
	if err != nil {
		return AuthResult{}, fmt.Errorf("%w: invalid auth_date", ErrInvalidInitData)
	}
	authDate := time.Unix(sec, 0).UTC()
	if maxAge > 0 && time.Since(authDate) > maxAge {
		return AuthResult{}, fmt.Errorf("%w: auth_date expired", ErrInvalidInitData)
	}

	userRaw := values.Get("user")
	if userRaw == "" {
		return AuthResult{}, fmt.Errorf("%w: missing user", ErrInvalidInitData)
	}

	var user User
	if err := json.Unmarshal([]byte(userRaw), &user); err != nil {
		return AuthResult{}, fmt.Errorf("%w: invalid user json", ErrInvalidInitData)
	}
	if user.ID == 0 {
		return AuthResult{}, fmt.Errorf("%w: missing user.id", ErrInvalidInitData)
	}

	return AuthResult{
		User:     user,
		AuthDate: authDate,
	}, nil
}

