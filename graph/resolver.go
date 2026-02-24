package graph

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require here.

import (
	"context"
	"errors"

	"saleor-tma-backend/internal/app/tma"
)

// TMAService is the interface that the domain service must satisfy.
// *tma.Service implements this interface automatically (structural typing).
// Defining it here allows tests to inject a lightweight mock without touching
// the real Saleor HTTP client.
type TMAService interface {
	ListRestaurants(ctx context.Context, search string) ([]tma.Restaurant, error)
	ListCategories(ctx context.Context, restaurantID string) ([]tma.Category, error)
	ListDishes(ctx context.Context, restaurantID, categoryID string) ([]tma.Dish, error)
	PlaceOrder(ctx context.Context, telegramUserID int64, input tma.PlaceOrderInput) (tma.PlaceOrderResult, error)
}

// Resolver is the root dependency-injection struct wired in cmd/api/main.go.
// TMA accepts any value that satisfies TMAService — in production that is
// *tma.Service; in tests it is a lightweight stub.
type Resolver struct {
	TMA TMAService
}

// ErrUnauthenticated is returned by every resolver when no valid Telegram
// AuthResult is found in the request context.
var ErrUnauthenticated = errors.New("unauthenticated")

// stringPtrOrNil converts an empty string to nil and a non-empty string to a
// pointer. Used when mapping service layer strings to nullable GraphQL fields.
func stringPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
