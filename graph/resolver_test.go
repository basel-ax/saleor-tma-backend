package graph_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"saleor-tma-backend/graph"
	"saleor-tma-backend/graph/model"
	"saleor-tma-backend/internal/app/tma"
	"saleor-tma-backend/internal/telegram"
)

// ---------------------------------------------------------------------------
// Mock TMAService
// ---------------------------------------------------------------------------

// mockTMAService implements graph.TMAService for tests.
// Each method field can be overridden per test; the zero value returns an
// empty result and no error.
type mockTMAService struct {
	listRestaurantsFn func(ctx context.Context, search string) ([]tma.Restaurant, error)
	listCategoriesFn  func(ctx context.Context, restaurantID string) ([]tma.Category, error)
	listDishesFn      func(ctx context.Context, restaurantID, categoryID string) ([]tma.Dish, error)
	placeOrderFn      func(ctx context.Context, telegramUserID int64, input tma.PlaceOrderInput) (tma.PlaceOrderResult, error)
}

func (m *mockTMAService) ListRestaurants(ctx context.Context, search string) ([]tma.Restaurant, error) {
	if m.listRestaurantsFn != nil {
		return m.listRestaurantsFn(ctx, search)
	}
	return nil, nil
}

func (m *mockTMAService) ListCategories(ctx context.Context, restaurantID string) ([]tma.Category, error) {
	if m.listCategoriesFn != nil {
		return m.listCategoriesFn(ctx, restaurantID)
	}
	return nil, nil
}

func (m *mockTMAService) ListDishes(ctx context.Context, restaurantID, categoryID string) ([]tma.Dish, error) {
	if m.listDishesFn != nil {
		return m.listDishesFn(ctx, restaurantID, categoryID)
	}
	return nil, nil
}

func (m *mockTMAService) PlaceOrder(ctx context.Context, telegramUserID int64, input tma.PlaceOrderInput) (tma.PlaceOrderResult, error) {
	if m.placeOrderFn != nil {
		return m.placeOrderFn(ctx, telegramUserID, input)
	}
	return tma.PlaceOrderResult{}, nil
}

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

// authCtx returns a context carrying a valid Telegram AuthResult.
func authCtx() context.Context {
	auth := telegram.AuthResult{
		User: telegram.User{
			ID:        42,
			FirstName: "Test",
			Username:  "testuser",
			Language:  "en",
		},
		AuthDate: time.Now(),
	}
	return telegram.WithAuth(context.Background(), auth)
}

// noAuthCtx returns a plain context with no Telegram auth attached.
func noAuthCtx() context.Context {
	return context.Background()
}

// newResolver wires a Resolver backed by the provided mock service.
func newResolver(svc graph.TMAService) *graph.Resolver {
	return &graph.Resolver{TMA: svc}
}

// ---------------------------------------------------------------------------
// Unauthenticated access — every resolver must reject requests without auth
// ---------------------------------------------------------------------------

func TestRestaurantsResolver_Unauthenticated(t *testing.T) {
	r := newResolver(&mockTMAService{})
	_, err := r.Query().Restaurants(noAuthCtx(), nil)
	if err == nil {
		t.Fatal("expected unauthenticated error, got nil")
	}
}

func TestRestaurantCategoriesResolver_Unauthenticated(t *testing.T) {
	r := newResolver(&mockTMAService{})
	_, err := r.Query().RestaurantCategories(noAuthCtx(), "rest-1")
	if err == nil {
		t.Fatal("expected unauthenticated error, got nil")
	}
}

func TestCategoryDishesResolver_Unauthenticated(t *testing.T) {
	r := newResolver(&mockTMAService{})
	_, err := r.Query().CategoryDishes(noAuthCtx(), "rest-1", "cat-1")
	if err == nil {
		t.Fatal("expected unauthenticated error, got nil")
	}
}

func TestPlaceOrderResolver_Unauthenticated(t *testing.T) {
	r := newResolver(&mockTMAService{})
	_, err := r.Mutation().PlaceOrder(noAuthCtx(), model.PlaceOrderInput{
		RestaurantID: "rest-1",
		Items:        []*model.CartItemInput{{DishID: "var-1", Quantity: 1}},
	})
	if err == nil {
		t.Fatal("expected unauthenticated error, got nil")
	}
}

// ---------------------------------------------------------------------------
// Restaurants query
// ---------------------------------------------------------------------------

func TestRestaurantsResolver_ReturnsEmptyList(t *testing.T) {
	r := newResolver(&mockTMAService{
		listRestaurantsFn: func(_ context.Context, _ string) ([]tma.Restaurant, error) {
			return []tma.Restaurant{}, nil
		},
	})

	result, err := r.Query().Restaurants(authCtx(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected empty slice, got %d items", len(result))
	}
}

func TestRestaurantsResolver_TypeMapping(t *testing.T) {
	desc := "Best pizza in town"
	imgURL := "https://cdn.example.com/pizza.jpg"

	r := newResolver(&mockTMAService{
		listRestaurantsFn: func(_ context.Context, _ string) ([]tma.Restaurant, error) {
			return []tma.Restaurant{
				{
					ID:          "rest-1",
					Name:        "Pizza Palace",
					Description: desc,
					ImageURL:    imgURL,
					Tags:        []string{"pizza", "italian"},
				},
			}, nil
		},
	})

	result, err := r.Query().Restaurants(authCtx(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 restaurant, got %d", len(result))
	}
	got := result[0]
	if got.ID != "rest-1" {
		t.Errorf("ID: want rest-1, got %q", got.ID)
	}
	if got.Name != "Pizza Palace" {
		t.Errorf("Name: want 'Pizza Palace', got %q", got.Name)
	}
	if got.Description == nil || *got.Description != desc {
		t.Errorf("Description: want %q, got %v", desc, got.Description)
	}
	if got.ImageURL == nil || *got.ImageURL != imgURL {
		t.Errorf("ImageURL: want %q, got %v", imgURL, got.ImageURL)
	}
	if len(got.Tags) != 2 || got.Tags[0] != "pizza" || got.Tags[1] != "italian" {
		t.Errorf("Tags: want [pizza italian], got %v", got.Tags)
	}
}

func TestRestaurantsResolver_EmptyDescriptionAndImage_ReturnNil(t *testing.T) {
	// Empty strings from the service must be mapped to nil pointers in the GQL model.
	r := newResolver(&mockTMAService{
		listRestaurantsFn: func(_ context.Context, _ string) ([]tma.Restaurant, error) {
			return []tma.Restaurant{
				{ID: "r1", Name: "R1", Description: "", ImageURL: "", Tags: nil},
			}, nil
		},
	})

	result, err := r.Query().Restaurants(authCtx(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result[0].Description != nil {
		t.Errorf("empty Description should map to nil, got %v", result[0].Description)
	}
	if result[0].ImageURL != nil {
		t.Errorf("empty ImageURL should map to nil, got %v", result[0].ImageURL)
	}
}

func TestRestaurantsResolver_SearchTermForwarded(t *testing.T) {
	var capturedSearch string
	r := newResolver(&mockTMAService{
		listRestaurantsFn: func(_ context.Context, search string) ([]tma.Restaurant, error) {
			capturedSearch = search
			return nil, nil
		},
	})

	term := "sushi"
	_, err := r.Query().Restaurants(authCtx(), &term)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if capturedSearch != "sushi" {
		t.Errorf("search term: want 'sushi', got %q", capturedSearch)
	}
}

func TestRestaurantsResolver_NilSearchForwarded(t *testing.T) {
	var capturedSearch string
	r := newResolver(&mockTMAService{
		listRestaurantsFn: func(_ context.Context, search string) ([]tma.Restaurant, error) {
			capturedSearch = search
			return nil, nil
		},
	})

	_, err := r.Query().Restaurants(authCtx(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if capturedSearch != "" {
		t.Errorf("nil search should be forwarded as empty string, got %q", capturedSearch)
	}
}

func TestRestaurantsResolver_ServiceError(t *testing.T) {
	r := newResolver(&mockTMAService{
		listRestaurantsFn: func(_ context.Context, _ string) ([]tma.Restaurant, error) {
			return nil, errors.New("saleor unavailable")
		},
	})

	_, err := r.Query().Restaurants(authCtx(), nil)
	if err == nil {
		t.Fatal("expected service error, got nil")
	}
}

// ---------------------------------------------------------------------------
// RestaurantCategories query
// ---------------------------------------------------------------------------

func TestRestaurantCategoriesResolver_TypeMapping(t *testing.T) {
	desc := "Our pizza menu"
	imgURL := "https://cdn.example.com/pizzas.jpg"

	r := newResolver(&mockTMAService{
		listCategoriesFn: func(_ context.Context, restaurantID string) ([]tma.Category, error) {
			return []tma.Category{
				{
					ID:           "cat-1",
					RestaurantID: restaurantID,
					Name:         "Pizzas",
					Description:  desc,
					ImageURL:     imgURL,
				},
			}, nil
		},
	})

	result, err := r.Query().RestaurantCategories(authCtx(), "rest-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 category, got %d", len(result))
	}
	got := result[0]
	if got.ID != "cat-1" {
		t.Errorf("ID: want cat-1, got %q", got.ID)
	}
	if got.RestaurantID != "rest-1" {
		t.Errorf("RestaurantID: want rest-1, got %q", got.RestaurantID)
	}
	if got.Name != "Pizzas" {
		t.Errorf("Name: want Pizzas, got %q", got.Name)
	}
	if got.Description == nil || *got.Description != desc {
		t.Errorf("Description: want %q, got %v", desc, got.Description)
	}
	if got.ImageURL == nil || *got.ImageURL != imgURL {
		t.Errorf("ImageURL: want %q, got %v", imgURL, got.ImageURL)
	}
}

func TestRestaurantCategoriesResolver_RestaurantIDForwarded(t *testing.T) {
	var capturedID string
	r := newResolver(&mockTMAService{
		listCategoriesFn: func(_ context.Context, restaurantID string) ([]tma.Category, error) {
			capturedID = restaurantID
			return nil, nil
		},
	})

	_, _ = r.Query().RestaurantCategories(authCtx(), "rest-42")
	if capturedID != "rest-42" {
		t.Errorf("restaurantID: want rest-42, got %q", capturedID)
	}
}

func TestRestaurantCategoriesResolver_EmptyDescriptionAndImage_ReturnNil(t *testing.T) {
	r := newResolver(&mockTMAService{
		listCategoriesFn: func(_ context.Context, _ string) ([]tma.Category, error) {
			return []tma.Category{
				{ID: "c1", RestaurantID: "r1", Name: "C1", Description: "", ImageURL: ""},
			}, nil
		},
	})

	result, err := r.Query().RestaurantCategories(authCtx(), "r1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result[0].Description != nil {
		t.Errorf("empty Description should map to nil, got %v", result[0].Description)
	}
	if result[0].ImageURL != nil {
		t.Errorf("empty ImageURL should map to nil, got %v", result[0].ImageURL)
	}
}

func TestRestaurantCategoriesResolver_ServiceError(t *testing.T) {
	r := newResolver(&mockTMAService{
		listCategoriesFn: func(_ context.Context, _ string) ([]tma.Category, error) {
			return nil, errors.New("restaurant not found")
		},
	})

	_, err := r.Query().RestaurantCategories(authCtx(), "missing")
	if err == nil {
		t.Fatal("expected service error, got nil")
	}
}

// ---------------------------------------------------------------------------
// CategoryDishes query
// ---------------------------------------------------------------------------

func TestCategoryDishesResolver_TypeMapping(t *testing.T) {
	r := newResolver(&mockTMAService{
		listDishesFn: func(_ context.Context, restaurantID, categoryID string) ([]tma.Dish, error) {
			return []tma.Dish{
				{
					ID:           "var-1",
					ProductID:    "prod-1",
					RestaurantID: restaurantID,
					CategoryID:   categoryID,
					Name:         "Margherita",
					Description:  "Classic tomato and mozzarella",
					ImageURL:     "https://cdn.example.com/margherita.jpg",
					Price:        tma.Money{Amount: 12.5, Currency: "USD"},
				},
			}, nil
		},
	})

	result, err := r.Query().CategoryDishes(authCtx(), "rest-1", "cat-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 dish, got %d", len(result))
	}
	d := result[0]
	if d.ID != "var-1" {
		t.Errorf("ID: want var-1, got %q", d.ID)
	}
	if d.ProductID != "prod-1" {
		t.Errorf("ProductID: want prod-1, got %q", d.ProductID)
	}
	if d.RestaurantID != "rest-1" {
		t.Errorf("RestaurantID: want rest-1, got %q", d.RestaurantID)
	}
	if d.CategoryID != "cat-1" {
		t.Errorf("CategoryID: want cat-1, got %q", d.CategoryID)
	}
	if d.Name != "Margherita" {
		t.Errorf("Name: want Margherita, got %q", d.Name)
	}
	if d.Description != "Classic tomato and mozzarella" {
		t.Errorf("Description unexpected: %q", d.Description)
	}
	if d.ImageURL != "https://cdn.example.com/margherita.jpg" {
		t.Errorf("ImageURL unexpected: %q", d.ImageURL)
	}
	if d.Price == nil {
		t.Fatal("Price must not be nil")
	}
	if d.Price.Amount != 12.5 {
		t.Errorf("Price.Amount: want 12.5, got %f", d.Price.Amount)
	}
	if d.Price.Currency != "USD" {
		t.Errorf("Price.Currency: want USD, got %q", d.Price.Currency)
	}
}

func TestCategoryDishesResolver_IDsForwarded(t *testing.T) {
	var capturedRestaurantID, capturedCategoryID string
	r := newResolver(&mockTMAService{
		listDishesFn: func(_ context.Context, restaurantID, categoryID string) ([]tma.Dish, error) {
			capturedRestaurantID = restaurantID
			capturedCategoryID = categoryID
			return nil, nil
		},
	})

	_, _ = r.Query().CategoryDishes(authCtx(), "rest-99", "cat-77")
	if capturedRestaurantID != "rest-99" {
		t.Errorf("restaurantID: want rest-99, got %q", capturedRestaurantID)
	}
	if capturedCategoryID != "cat-77" {
		t.Errorf("categoryID: want cat-77, got %q", capturedCategoryID)
	}
}

func TestCategoryDishesResolver_ServiceError(t *testing.T) {
	r := newResolver(&mockTMAService{
		listDishesFn: func(_ context.Context, _, _ string) ([]tma.Dish, error) {
			return nil, errors.New("category not in restaurant")
		},
	})

	_, err := r.Query().CategoryDishes(authCtx(), "rest-1", "cat-other")
	if err == nil {
		t.Fatal("expected service error, got nil")
	}
}

// ---------------------------------------------------------------------------
// PlaceOrder mutation
// ---------------------------------------------------------------------------

func TestPlaceOrderResolver_TypeMapping_WithCoordinates(t *testing.T) {
	var capturedInput tma.PlaceOrderInput
	var capturedUserID int64

	r := newResolver(&mockTMAService{
		placeOrderFn: func(_ context.Context, telegramUserID int64, input tma.PlaceOrderInput) (tma.PlaceOrderResult, error) {
			capturedUserID = telegramUserID
			capturedInput = input
			return tma.PlaceOrderResult{OrderID: "order-99", Status: "UNFULFILLED"}, nil
		},
	})

	comment := "Ring the bell"
	result, err := r.Mutation().PlaceOrder(authCtx(), model.PlaceOrderInput{
		RestaurantID: "rest-1",
		Items: []*model.CartItemInput{
			{DishID: "var-1", Quantity: 2},
			{DishID: "var-2", Quantity: 1},
		},
		DeliveryLocation: &model.DeliveryLocationInput{Lat: 55.751244, Lng: 37.618423},
		Comment:          &comment,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify output mapping.
	if result.OrderID != "order-99" {
		t.Errorf("OrderID: want order-99, got %q", result.OrderID)
	}
	if result.Status != "UNFULFILLED" {
		t.Errorf("Status: want UNFULFILLED, got %q", result.Status)
	}

	// Verify the Telegram user ID was extracted from context and forwarded.
	if capturedUserID != 42 {
		t.Errorf("telegramUserID: want 42, got %d", capturedUserID)
	}

	// Verify input mapping.
	if capturedInput.RestaurantID != "rest-1" {
		t.Errorf("input.RestaurantID: want rest-1, got %q", capturedInput.RestaurantID)
	}
	if len(capturedInput.Items) != 2 {
		t.Fatalf("input.Items: want 2, got %d", len(capturedInput.Items))
	}
	if capturedInput.Items[0].DishID != "var-1" || capturedInput.Items[0].Quantity != 2 {
		t.Errorf("input.Items[0]: want {var-1 2}, got %+v", capturedInput.Items[0])
	}
	if capturedInput.Items[1].DishID != "var-2" || capturedInput.Items[1].Quantity != 1 {
		t.Errorf("input.Items[1]: want {var-2 1}, got %+v", capturedInput.Items[1])
	}
	if capturedInput.DeliveryLocation == nil {
		t.Fatal("DeliveryLocation must not be nil")
	}
	if capturedInput.DeliveryLocation.Lat != 55.751244 || capturedInput.DeliveryLocation.Lng != 37.618423 {
		t.Errorf("DeliveryLocation: want {55.751244 37.618423}, got %+v", capturedInput.DeliveryLocation)
	}
	if capturedInput.Comment != "Ring the bell" {
		t.Errorf("Comment: want 'Ring the bell', got %q", capturedInput.Comment)
	}
	if capturedInput.GoogleMapsURL != "" {
		t.Errorf("GoogleMapsURL: want empty, got %q", capturedInput.GoogleMapsURL)
	}
}

func TestPlaceOrderResolver_TypeMapping_WithGoogleMapsUrl(t *testing.T) {
	var capturedInput tma.PlaceOrderInput

	r := newResolver(&mockTMAService{
		placeOrderFn: func(_ context.Context, _ int64, input tma.PlaceOrderInput) (tma.PlaceOrderResult, error) {
			capturedInput = input
			return tma.PlaceOrderResult{OrderID: "order-100", Status: "UNFULFILLED"}, nil
		},
	})

	mapsURL := "https://maps.google.com/?q=55.75,37.62"
	_, err := r.Mutation().PlaceOrder(authCtx(), model.PlaceOrderInput{
		RestaurantID:  "rest-1",
		Items:         []*model.CartItemInput{{DishID: "var-1", Quantity: 1}},
		GoogleMapsURL: &mapsURL,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if capturedInput.GoogleMapsURL != mapsURL {
		t.Errorf("GoogleMapsURL: want %q, got %q", mapsURL, capturedInput.GoogleMapsURL)
	}
	if capturedInput.DeliveryLocation != nil {
		t.Errorf("DeliveryLocation must be nil when googleMapsUrl supplied, got %+v", capturedInput.DeliveryLocation)
	}
}

func TestPlaceOrderResolver_NilCommentForwardedAsEmpty(t *testing.T) {
	var capturedComment string

	r := newResolver(&mockTMAService{
		placeOrderFn: func(_ context.Context, _ int64, input tma.PlaceOrderInput) (tma.PlaceOrderResult, error) {
			capturedComment = input.Comment
			return tma.PlaceOrderResult{OrderID: "o1", Status: "UNFULFILLED"}, nil
		},
	})

	_, err := r.Mutation().PlaceOrder(authCtx(), model.PlaceOrderInput{
		RestaurantID:  "rest-1",
		Items:         []*model.CartItemInput{{DishID: "var-1", Quantity: 1}},
		GoogleMapsURL: strPtr("https://maps.google.com/?q=1,2"),
		Comment:       nil, // explicitly nil
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if capturedComment != "" {
		t.Errorf("nil Comment should forward as empty string, got %q", capturedComment)
	}
}

func TestPlaceOrderResolver_ServiceError(t *testing.T) {
	r := newResolver(&mockTMAService{
		placeOrderFn: func(_ context.Context, _ int64, _ tma.PlaceOrderInput) (tma.PlaceOrderResult, error) {
			return tma.PlaceOrderResult{}, errors.New("saleor: channel not found")
		},
	})

	_, err := r.Mutation().PlaceOrder(authCtx(), model.PlaceOrderInput{
		RestaurantID:  "rest-1",
		Items:         []*model.CartItemInput{{DishID: "var-1", Quantity: 1}},
		GoogleMapsURL: strPtr("https://maps.google.com/?q=1,2"),
	})
	if err == nil {
		t.Fatal("expected service error, got nil")
	}
}

// ---------------------------------------------------------------------------
// Full user workflow through the resolver layer
// ---------------------------------------------------------------------------

// TestWorkflow_FullUserFlow exercises the complete user journey:
//  1. Browse restaurants.
//  2. Select a restaurant → list its dish categories.
//  3. Select a category → browse dishes with prices.
//  4. Add dishes to the basket → place the order (GPS coordinates).
func TestWorkflow_FullUserFlow(t *testing.T) {
	ctx := authCtx()

	// Fixture data.
	wantRestaurant := tma.Restaurant{
		ID:          "rest-1",
		Name:        "Pizza Palace",
		Description: "Best pizza in town",
		ImageURL:    "https://cdn.example.com/pizza.jpg",
		Tags:        []string{"pizza", "italian", "delivery"},
	}
	wantCategory := tma.Category{
		ID:           "cat-1",
		RestaurantID: "rest-1",
		Name:         "Pizzas",
		Description:  "Our pizza menu",
		ImageURL:     "https://cdn.example.com/pizzas.jpg",
	}
	wantDish := tma.Dish{
		ID:           "var-1",
		ProductID:    "prod-1",
		RestaurantID: "rest-1",
		CategoryID:   "cat-1",
		Name:         "Margherita",
		Description:  "Classic tomato and mozzarella",
		ImageURL:     "https://cdn.example.com/margherita.jpg",
		Price:        tma.Money{Amount: 12.5, Currency: "USD"},
	}
	wantOrderResult := tma.PlaceOrderResult{OrderID: "order-99", Status: "UNFULFILLED"}

	svc := &mockTMAService{
		listRestaurantsFn: func(_ context.Context, _ string) ([]tma.Restaurant, error) {
			return []tma.Restaurant{wantRestaurant}, nil
		},
		listCategoriesFn: func(_ context.Context, restaurantID string) ([]tma.Category, error) {
			if restaurantID != wantRestaurant.ID {
				t.Errorf("ListCategories called with wrong restaurantID: %q", restaurantID)
			}
			return []tma.Category{wantCategory}, nil
		},
		listDishesFn: func(_ context.Context, restaurantID, categoryID string) ([]tma.Dish, error) {
			if restaurantID != wantRestaurant.ID {
				t.Errorf("ListDishes called with wrong restaurantID: %q", restaurantID)
			}
			if categoryID != wantCategory.ID {
				t.Errorf("ListDishes called with wrong categoryID: %q", categoryID)
			}
			return []tma.Dish{wantDish}, nil
		},
		placeOrderFn: func(_ context.Context, telegramUserID int64, input tma.PlaceOrderInput) (tma.PlaceOrderResult, error) {
			if telegramUserID != 42 {
				t.Errorf("PlaceOrder telegramUserID: want 42, got %d", telegramUserID)
			}
			if input.RestaurantID != wantRestaurant.ID {
				t.Errorf("PlaceOrder input.RestaurantID: want %q, got %q", wantRestaurant.ID, input.RestaurantID)
			}
			if len(input.Items) != 1 || input.Items[0].DishID != wantDish.ID {
				t.Errorf("PlaceOrder input.Items unexpected: %+v", input.Items)
			}
			return wantOrderResult, nil
		},
	}

	resolver := newResolver(svc)
	qr := resolver.Query()
	mr := resolver.Mutation()

	// ── Step 1: list restaurants ─────────────────────────────────────────
	restaurants, err := qr.Restaurants(ctx, nil)
	if err != nil {
		t.Fatalf("Restaurants: %v", err)
	}
	if len(restaurants) != 1 {
		t.Fatalf("expected 1 restaurant, got %d", len(restaurants))
	}
	restaurantID := restaurants[0].ID
	if restaurantID != "rest-1" {
		t.Errorf("restaurant.ID: want rest-1, got %q", restaurantID)
	}

	// ── Step 2: list categories for the chosen restaurant ────────────────
	categories, err := qr.RestaurantCategories(ctx, restaurantID)
	if err != nil {
		t.Fatalf("RestaurantCategories: %v", err)
	}
	if len(categories) != 1 {
		t.Fatalf("expected 1 category, got %d", len(categories))
	}
	categoryID := categories[0].ID
	if categoryID != "cat-1" {
		t.Errorf("category.ID: want cat-1, got %q", categoryID)
	}

	// ── Step 3: list dishes in the chosen category ───────────────────────
	dishes, err := qr.CategoryDishes(ctx, restaurantID, categoryID)
	if err != nil {
		t.Fatalf("CategoryDishes: %v", err)
	}
	if len(dishes) != 1 {
		t.Fatalf("expected 1 dish, got %d", len(dishes))
	}
	dish := dishes[0]
	if dish.ID != "var-1" {
		t.Errorf("dish.ID: want var-1, got %q", dish.ID)
	}
	if dish.Price == nil || dish.Price.Amount != 12.5 {
		t.Errorf("dish.Price unexpected: %+v", dish.Price)
	}

	// ── Step 4: place order with dishes from the basket ──────────────────
	orderResult, err := mr.PlaceOrder(ctx, model.PlaceOrderInput{
		RestaurantID: restaurantID,
		Items: []*model.CartItemInput{
			{DishID: dish.ID, Quantity: 2},
		},
		DeliveryLocation: &model.DeliveryLocationInput{Lat: 55.751244, Lng: 37.618423},
		Comment:          strPtr("Ring the bell"),
	})
	if err != nil {
		t.Fatalf("PlaceOrder: %v", err)
	}
	if orderResult.OrderID != "order-99" {
		t.Errorf("orderResult.OrderID: want order-99, got %q", orderResult.OrderID)
	}
	if orderResult.Status != "UNFULFILLED" {
		t.Errorf("orderResult.Status: want UNFULFILLED, got %q", orderResult.Status)
	}
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func strPtr(s string) *string { return &s }
