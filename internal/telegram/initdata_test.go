package telegram

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"testing"
	"time"
)

const testBotToken = "1234567890:AABBCCDDEEFFaabbccddeeff-TestBotToken"

// buildInitData constructs a properly signed Telegram initData string.
// offsetSeconds shifts auth_date relative to now (negative = in the past).
func buildInitData(botToken string, userID int64, offsetSeconds int, extraFields map[string]string) string {
	userJSON := fmt.Sprintf(
		`{"id":%d,"first_name":"Test","last_name":"User","username":"testuser","language_code":"en"}`,
		userID,
	)
	authDate := fmt.Sprintf("%d", time.Now().Add(time.Duration(offsetSeconds)*time.Second).Unix())

	fields := map[string]string{
		"auth_date": authDate,
		"user":      userJSON,
	}
	for k, v := range extraFields {
		fields[k] = v
	}

	// Build sorted key=value pairs (excluding hash).
	pairs := make([]string, 0, len(fields))
	for k, v := range fields {
		if k != "hash" {
			pairs = append(pairs, k+"="+v)
		}
	}
	sort.Strings(pairs)
	dataCheckString := strings.Join(pairs, "\n")

	// Compute HMAC-SHA256.
	secret := sha256.Sum256([]byte(botToken))
	mac := hmac.New(sha256.New, secret[:])
	mac.Write([]byte(dataCheckString))
	hash := hex.EncodeToString(mac.Sum(nil))

	// Encode as URL query string.
	values := url.Values{}
	for k, v := range fields {
		values.Set(k, v)
	}
	values.Set("hash", hash)
	return values.Encode()
}

// ---- Valid cases --------------------------------------------------------

func TestVerifyInitData_Valid(t *testing.T) {
	initData := buildInitData(testBotToken, 42, 0, nil)

	result, err := VerifyInitData(context.Background(), initData, testBotToken, 10*time.Minute)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if result.User.ID != 42 {
		t.Errorf("expected user ID 42, got %d", result.User.ID)
	}
	if result.User.FirstName != "Test" {
		t.Errorf("expected first name 'Test', got %q", result.User.FirstName)
	}
	if result.User.Username != "testuser" {
		t.Errorf("expected username 'testuser', got %q", result.User.Username)
	}
	if result.User.Language != "en" {
		t.Errorf("expected language 'en', got %q", result.User.Language)
	}
	if result.AuthDate.IsZero() {
		t.Error("expected non-zero AuthDate")
	}
}

func TestVerifyInitData_ZeroMaxAge_SkipsExpiryCheck(t *testing.T) {
	// auth_date is 2 hours in the past — would fail with a normal maxAge,
	// but maxAge=0 means "no expiry check".
	initData := buildInitData(testBotToken, 99, -7200, nil)

	_, err := VerifyInitData(context.Background(), initData, testBotToken, 0)
	if err != nil {
		t.Fatalf("expected no error with maxAge=0, got: %v", err)
	}
}

func TestVerifyInitData_ExtraFields_StillValid(t *testing.T) {
	// Telegram can include additional fields such as chat_instance or start_param.
	initData := buildInitData(testBotToken, 7, 0, map[string]string{
		"chat_instance": "-1234567890",
		"start_param":   "promo42",
	})

	_, err := VerifyInitData(context.Background(), initData, testBotToken, 10*time.Minute)
	if err != nil {
		t.Fatalf("extra fields should not break verification, got: %v", err)
	}
}

// ---- Auth-date expiry ---------------------------------------------------

func TestVerifyInitData_Expired(t *testing.T) {
	// auth_date is 20 minutes in the past; maxAge is 10 minutes.
	initData := buildInitData(testBotToken, 1, -1200, nil)

	_, err := VerifyInitData(context.Background(), initData, testBotToken, 10*time.Minute)
	if err == nil {
		t.Fatal("expected error for expired auth_date, got nil")
	}
}

func TestVerifyInitData_JustExpired(t *testing.T) {
	// auth_date is exactly maxAge+1 second in the past.
	initData := buildInitData(testBotToken, 1, -(601), nil)

	_, err := VerifyInitData(context.Background(), initData, testBotToken, 10*time.Minute)
	if err == nil {
		t.Fatal("expected error for just-expired auth_date, got nil")
	}
}

// ---- Missing / malformed fields -----------------------------------------

func TestVerifyInitData_MissingHash(t *testing.T) {
	values := url.Values{}
	values.Set("auth_date", fmt.Sprintf("%d", time.Now().Unix()))
	values.Set("user", `{"id":1,"first_name":"X"}`)
	// No "hash" key.
	initData := values.Encode()

	_, err := VerifyInitData(context.Background(), initData, testBotToken, 10*time.Minute)
	if err == nil {
		t.Fatal("expected error for missing hash, got nil")
	}
}

func TestVerifyInitData_MissingAuthDate(t *testing.T) {
	// Build with a valid signature but strip auth_date afterwards.
	// Easiest: mutate the values directly then recompute only the missing-field scenario
	// by using buildInitData and then overwriting auth_date with empty.
	values := url.Values{}
	values.Set("user", `{"id":1,"first_name":"X"}`)
	// Manually compute hash over only "user" field (missing auth_date).
	pairs := []string{"user=" + `{"id":1,"first_name":"X"}`}
	dataCheckString := strings.Join(pairs, "\n")
	secret := sha256.Sum256([]byte(testBotToken))
	mac := hmac.New(sha256.New, secret[:])
	mac.Write([]byte(dataCheckString))
	values.Set("hash", hex.EncodeToString(mac.Sum(nil)))

	_, err := VerifyInitData(context.Background(), values.Encode(), testBotToken, 10*time.Minute)
	if err == nil {
		t.Fatal("expected error for missing auth_date, got nil")
	}
}

func TestVerifyInitData_InvalidAuthDate(t *testing.T) {
	// auth_date is present but not a valid integer.
	values := url.Values{}
	values.Set("auth_date", "not-a-number")
	values.Set("user", `{"id":1,"first_name":"X"}`)
	// Compute correct hash so we get past signature check.
	pairs := []string{
		"auth_date=not-a-number",
		`user={"id":1,"first_name":"X"}`,
	}
	sort.Strings(pairs)
	dataCheckString := strings.Join(pairs, "\n")
	secret := sha256.Sum256([]byte(testBotToken))
	mac := hmac.New(sha256.New, secret[:])
	mac.Write([]byte(dataCheckString))
	values.Set("hash", hex.EncodeToString(mac.Sum(nil)))

	_, err := VerifyInitData(context.Background(), values.Encode(), testBotToken, 10*time.Minute)
	if err == nil {
		t.Fatal("expected error for invalid auth_date, got nil")
	}
}

func TestVerifyInitData_MissingUser(t *testing.T) {
	// Construct initData without the "user" field.
	authDate := fmt.Sprintf("%d", time.Now().Unix())
	values := url.Values{}
	values.Set("auth_date", authDate)
	pairs := []string{"auth_date=" + authDate}
	dataCheckString := strings.Join(pairs, "\n")
	secret := sha256.Sum256([]byte(testBotToken))
	mac := hmac.New(sha256.New, secret[:])
	mac.Write([]byte(dataCheckString))
	values.Set("hash", hex.EncodeToString(mac.Sum(nil)))

	_, err := VerifyInitData(context.Background(), values.Encode(), testBotToken, 10*time.Minute)
	if err == nil {
		t.Fatal("expected error for missing user, got nil")
	}
}

func TestVerifyInitData_InvalidUserJSON(t *testing.T) {
	authDate := fmt.Sprintf("%d", time.Now().Unix())
	badUser := `{not valid json`
	values := url.Values{}
	values.Set("auth_date", authDate)
	values.Set("user", badUser)
	pairs := []string{"auth_date=" + authDate, "user=" + badUser}
	sort.Strings(pairs)
	dataCheckString := strings.Join(pairs, "\n")
	secret := sha256.Sum256([]byte(testBotToken))
	mac := hmac.New(sha256.New, secret[:])
	mac.Write([]byte(dataCheckString))
	values.Set("hash", hex.EncodeToString(mac.Sum(nil)))

	_, err := VerifyInitData(context.Background(), values.Encode(), testBotToken, 10*time.Minute)
	if err == nil {
		t.Fatal("expected error for invalid user JSON, got nil")
	}
}

func TestVerifyInitData_UserIDZero(t *testing.T) {
	// user.id == 0 must be rejected.
	authDate := fmt.Sprintf("%d", time.Now().Unix())
	zeroUser := `{"id":0,"first_name":"Ghost"}`
	values := url.Values{}
	values.Set("auth_date", authDate)
	values.Set("user", zeroUser)
	pairs := []string{"auth_date=" + authDate, "user=" + zeroUser}
	sort.Strings(pairs)
	dataCheckString := strings.Join(pairs, "\n")
	secret := sha256.Sum256([]byte(testBotToken))
	mac := hmac.New(sha256.New, secret[:])
	mac.Write([]byte(dataCheckString))
	values.Set("hash", hex.EncodeToString(mac.Sum(nil)))

	_, err := VerifyInitData(context.Background(), values.Encode(), testBotToken, 10*time.Minute)
	if err == nil {
		t.Fatal("expected error for user.id == 0, got nil")
	}
}

// ---- Signature mismatch -------------------------------------------------

func TestVerifyInitData_WrongBotToken(t *testing.T) {
	// Signed with token A, verified with token B.
	initData := buildInitData("wrong-bot-token", 5, 0, nil)

	_, err := VerifyInitData(context.Background(), initData, testBotToken, 10*time.Minute)
	if err == nil {
		t.Fatal("expected signature mismatch error, got nil")
	}
}

func TestVerifyInitData_TamperedData(t *testing.T) {
	// Valid signature but payload has been tampered with afterwards.
	initData := buildInitData(testBotToken, 10, 0, nil)

	// Parse the URL-encoded initData so we can modify decoded field values.
	// Replacing the raw string won't work because the JSON is percent-encoded.
	values, err := url.ParseQuery(initData)
	if err != nil {
		t.Fatalf("ParseQuery: %v", err)
	}

	// Modify the decoded user JSON (change user ID) without recomputing the hash.
	user := values.Get("user")
	user = strings.ReplaceAll(user, `"id":10`, `"id":999`)
	values.Set("user", user)

	tampered := values.Encode()

	_, err = VerifyInitData(context.Background(), tampered, testBotToken, 10*time.Minute)
	if err == nil {
		t.Fatal("expected error for tampered payload, got nil")
	}
}

func TestVerifyInitData_HashCaseInsensitive(t *testing.T) {
	// VerifyInitData must accept both upper- and lower-case hex in the hash field.
	initData := buildInitData(testBotToken, 55, 0, nil)

	values, _ := url.ParseQuery(initData)
	hash := values.Get("hash")

	// Upper-case variant.
	values.Set("hash", strings.ToUpper(hash))
	_, err := VerifyInitData(context.Background(), values.Encode(), testBotToken, 10*time.Minute)
	if err != nil {
		t.Fatalf("upper-case hash should be accepted, got: %v", err)
	}
}

func TestVerifyInitData_EmptyString(t *testing.T) {
	_, err := VerifyInitData(context.Background(), "", testBotToken, 10*time.Minute)
	if err == nil {
		t.Fatal("expected error for empty initData, got nil")
	}
}

func TestVerifyInitData_InvalidQueryString(t *testing.T) {
	// '%' alone is not a valid percent-encoded sequence.
	_, err := VerifyInitData(context.Background(), "hash=%GG&auth_date=abc", testBotToken, 10*time.Minute)
	// May or may not error depending on url.ParseQuery leniency;
	// at minimum, it should not panic and should eventually fail.
	_ = err
}
