package tma

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"saleor-tma-backend/internal/saleor"
)

// ---------------------------------------------------------------------------
// Mock-server helpers
// ---------------------------------------------------------------------------

type routeEntry struct {
	keyword string // substring searched in the raw GraphQL query
	data    any    // value placed under "data" in the JSON response
}

// routingServer dispatches each incoming GraphQL request to the first route
// whose keyword is found anywhere in the raw query string.
// Routes are evaluated in order; the first match wins.
// If no route matches, the test is marked as failed.
func routingServer(t *testing.T, routes []routeEntry) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("routingServer: read body: %v", err)
			http.Error(w, "read error", 500)
			return
		}
		var req struct {
			Query string `json:"query"`
		}
		if err := json.Unmarshal(body, &req); err != nil {
			t.Errorf("routingServer: unmarshal: %v", err)
			http.Error(w, "decode error", 500)
			return
		}
		for _, route := range routes {
			if strings.Contains(req.Query, route.keyword) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(map[string]any{"data": route.data})
				return
			}
		}
		t.Errorf("routingServer: no route matched query:\n%s", req.Query)
		http.Error(w, "no route", 500)
	}))
	t.Cleanup(srv.Close)
	return srv
}

// gqlErrorServer always returns a top-level GraphQL protocol error.
func gqlErrorServer(t *testing.T, msg string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"errors": []map[string]any{{"message": msg}},
		})
	}))
	t.Cleanup(srv.Close)
	return srv
}

// newSvc creates a real *Service backed by a saleor.Client aimed at srv.URL.
func newSvc(t *testing.T, srv *httptest.Server, rootCategoryID string) *Service {
	t.Helper()
	sc := saleor.NewClient(srv.URL, "test-token")
	return NewService(sc, "CH1", "default-channel", rootCategoryID)
}

// ---------------------------------------------------------------------------
// Canned Saleor response payloads
// ---------------------------------------------------------------------------

var restaurantNode = map[string]any{
	"id":          "rest-1",
	"name":        "Pizza Palace",
	"description": "Best pizza in town",
	"backgroundImage": map[string]any{
		"url": "https://cdn.example.com/pizza.jpg",
	},
	"metadata": []map[string]any{
		{"key": "tma_tags", "value": "pizza,italian,delivery"},
	},
}

var restaurantsFromRootResp = map[string]any{
	"category": map[string]any{
		"children": map[string]any{
			"edges": []map[string]any{{"node": restaurantNode}},
		},
	},
}

var restaurantsTopLevelResp = map[string]any{
	"categories": map[string]any{
		"edges": []map[string]any{{"node": restaurantNode}},
	},
}

var categoriesResp = map[string]any{
	"category": map[string]any{
		"id": "rest-1",
		"children": map[string]any{
			"edges": []map[string]any{
				{"node": map[string]any{
					"id":          "cat-1",
					"name":        "Pizzas",
					"description": "Our pizza menu",
					"backgroundImage": map[string]any{
						"url": "https://cdn.example.com/pizzas.jpg",
					},
				}},
			},
		},
	},
}

var categoryParentResp = map[string]any{
	"category": map[string]any{
		"parent": map[string]any{"id": "rest-1"},
	},
}

var dishesResp = map[string]any{
	"products": map[string]any{
		"edges": []map[string]any{
			{"node": map[string]any{
				"id":          "prod-1",
				"name":        "Margherita",
				"description": "Classic tomato and mozzarella",
				"thumbnail":   map[string]any{"url": "https://cdn.example.com/margherita.jpg"},
				"variants": []map[string]any{
					{
						"id": "var-1",
						"pricing": map[string]any{
							"price": map[string]any{
								"gross": map[string]any{"amount": 12.5, "currency": "USD"},
							},
						},
					},
				},
			}},
		},
	},
}

var draftOrderCreateResp = map[string]any{
	"draftOrderCreate": map[string]any{
		"order":  map[string]any{"id": "order-99", "status": "DRAFT"},
		"errors": []map[string]any{},
	},
}

var orderLinesCreateResp = map[string]any{
	"orderLinesCreate": map[string]any{
		"order":  map[string]any{"id": "order-99"},
		"errors": []map[string]any{},
	},
}

var draftOrderCompleteResp = map[string]any{
	"draftOrderComplete": map[string]any{
		"order":  map[string]any{"id": "order-99", "status": "UNFULFILLED"},
		"errors": []map[string]any{},
	},
}

// ---------------------------------------------------------------------------
// Full user workflow
// ---------------------------------------------------------------------------

// TestFullUserWorkflow simulates the complete journey a user takes:
//  1. Browse the restaurant list (root-category path).
//  2. Open a restaurant → list its dish categories.
//  3. Open a category → browse dishes with prices.
//  4. Place an order with GPS coordinates.
func TestFullUserWorkflow(t *testing.T) {
	ctx := context.Background()

	// A single routing server handles every query type in the flow.
	// Operation names / unique keywords in each Saleor query guarantee that
	// the right canned response is returned.
	srv := routingServer(t, []routeEntry{
		{keyword: "RestaurantsFromRoot", data: restaurantsFromRootResp},
		{keyword: "RestaurantCategories", data: categoriesResp},
		{keyword: "CategoryParent", data: categoryParentResp},
		{keyword: "CategoryDishes", data: dishesResp},
		{keyword: "draftOrderCreate", data: draftOrderCreateResp},
		{keyword: "orderLinesCreate", data: orderLinesCreateResp},
		{keyword: "draftOrderComplete", data: draftOrderCompleteResp},
	})

	svc := newSvc(t, srv, "root-cat-id")

	// ── Step 1: list restaurants ──────────────────────────────────────────
	restaurants, err := svc.ListRestaurants(ctx, "")
	if err != nil {
		t.Fatalf("ListRestaurants: %v", err)
	}
	if len(restaurants) != 1 {
		t.Fatalf("expected 1 restaurant, got %d", len(restaurants))
	}
	r := restaurants[0]
	if r.ID != "rest-1" {
		t.Errorf("restaurant.ID: want rest-1, got %q", r.ID)
	}
	if r.Name != "Pizza Palace" {
		t.Errorf("restaurant.Name: want 'Pizza Palace', got %q", r.Name)
	}
	if r.ImageURL != "https://cdn.example.com/pizza.jpg" {
		t.Errorf("restaurant.ImageURL unexpected: %q", r.ImageURL)
	}
	if len(r.Tags) != 3 || r.Tags[0] != "pizza" || r.Tags[1] != "italian" || r.Tags[2] != "delivery" {
		t.Errorf("restaurant.Tags: want [pizza italian delivery], got %v", r.Tags)
	}

	// ── Step 2: list categories ───────────────────────────────────────────
	categories, err := svc.ListCategories(ctx, r.ID)
	if err != nil {
		t.Fatalf("ListCategories: %v", err)
	}
	if len(categories) != 1 {
		t.Fatalf("expected 1 category, got %d", len(categories))
	}
	cat := categories[0]
	if cat.ID != "cat-1" {
		t.Errorf("category.ID: want cat-1, got %q", cat.ID)
	}
	if cat.RestaurantID != r.ID {
		t.Errorf("category.RestaurantID: want %q, got %q", r.ID, cat.RestaurantID)
	}
	if cat.Name != "Pizzas" {
		t.Errorf("category.Name: want Pizzas, got %q", cat.Name)
	}

	// ── Step 3: list dishes ───────────────────────────────────────────────
	// Internally calls categoryIsChildOf (CategoryParent) then products (CategoryDishes).
	dishes, err := svc.ListDishes(ctx, r.ID, cat.ID)
	if err != nil {
		t.Fatalf("ListDishes: %v", err)
	}
	if len(dishes) != 1 {
		t.Fatalf("expected 1 dish, got %d", len(dishes))
	}
	d := dishes[0]
	if d.ID != "var-1" {
		t.Errorf("dish.ID (variant): want var-1, got %q", d.ID)
	}
	if d.ProductID != "prod-1" {
		t.Errorf("dish.ProductID: want prod-1, got %q", d.ProductID)
	}
	if d.RestaurantID != r.ID {
		t.Errorf("dish.RestaurantID: want %q, got %q", r.ID, d.RestaurantID)
	}
	if d.CategoryID != cat.ID {
		t.Errorf("dish.CategoryID: want %q, got %q", cat.ID, d.CategoryID)
	}
	if d.Name != "Margherita" {
		t.Errorf("dish.Name: want Margherita, got %q", d.Name)
	}
	if d.Price.Amount != 12.5 {
		t.Errorf("dish.Price.Amount: want 12.5, got %f", d.Price.Amount)
	}
	if d.Price.Currency != "USD" {
		t.Errorf("dish.Price.Currency: want USD, got %q", d.Price.Currency)
	}

	// ── Step 4: place order with GPS coordinates ──────────────────────────
	result, err := svc.PlaceOrder(ctx, 12345, PlaceOrderInput{
		RestaurantID: r.ID,
		Items:        []CartItem{{DishID: d.ID, Quantity: 2}},
		DeliveryLocation: &DeliveryLocation{
			Lat: 55.751244,
			Lng: 37.618423,
		},
		Comment: "Ring the bell",
	})
	if err != nil {
		t.Fatalf("PlaceOrder (coordinates): %v", err)
	}
	if result.OrderID != "order-99" {
		t.Errorf("result.OrderID: want order-99, got %q", result.OrderID)
	}
	if result.Status != "UNFULFILLED" {
		t.Errorf("result.Status: want UNFULFILLED, got %q", result.Status)
	}
}

// TestFullUserWorkflow_GoogleMapsUrl repeats the order step using a Google
// Maps URL instead of raw GPS coordinates.
func TestFullUserWorkflow_GoogleMapsUrl(t *testing.T) {
	ctx := context.Background()

	srv := routingServer(t, []routeEntry{
		{keyword: "draftOrderCreate", data: draftOrderCreateResp},
		{keyword: "orderLinesCreate", data: orderLinesCreateResp},
		{keyword: "draftOrderComplete", data: draftOrderCompleteResp},
	})

	svc := newSvc(t, srv, "")

	result, err := svc.PlaceOrder(ctx, 99, PlaceOrderInput{
		RestaurantID:  "rest-1",
		Items:         []CartItem{{DishID: "var-1", Quantity: 1}},
		GoogleMapsURL: "https://maps.google.com/?q=55.75,37.62",
	})
	if err != nil {
		t.Fatalf("PlaceOrder (google maps url): %v", err)
	}
	if result.OrderID != "order-99" {
		t.Errorf("result.OrderID: want order-99, got %q", result.OrderID)
	}
	if result.Status != "UNFULFILLED" {
		t.Errorf("result.Status: want UNFULFILLED, got %q", result.Status)
	}
}

// TestFullUserWorkflow_MultipleItems places an order with multiple cart items.
func TestFullUserWorkflow_MultipleItems(t *testing.T) {
	ctx := context.Background()

	srv := routingServer(t, []routeEntry{
		{keyword: "draftOrderCreate", data: draftOrderCreateResp},
		{keyword: "orderLinesCreate", data: orderLinesCreateResp},
		{keyword: "draftOrderComplete", data: draftOrderCompleteResp},
	})

	svc := newSvc(t, srv, "")

	result, err := svc.PlaceOrder(ctx, 777, PlaceOrderInput{
		RestaurantID: "rest-1",
		Items: []CartItem{
			{DishID: "var-1", Quantity: 2},
			{DishID: "var-2", Quantity: 1},
			{DishID: "var-3", Quantity: 3},
		},
		DeliveryLocation: &DeliveryLocation{Lat: 48.85, Lng: 2.35},
		Comment:          "No onions please",
	})
	if err != nil {
		t.Fatalf("PlaceOrder (multiple items): %v", err)
	}
	if result.OrderID == "" {
		t.Error("expected non-empty OrderID")
	}
}

// ---------------------------------------------------------------------------
// ListRestaurants
// ---------------------------------------------------------------------------

func TestListRestaurants_FromRootCategory(t *testing.T) {
	srv := routingServer(t, []routeEntry{
		{keyword: "RestaurantsFromRoot", data: restaurantsFromRootResp},
	})
	svc := newSvc(t, srv, "root-42")

	rs, err := svc.ListRestaurants(context.Background(), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(rs) != 1 || rs[0].Name != "Pizza Palace" {
		t.Errorf("unexpected restaurants: %+v", rs)
	}
}

func TestListRestaurants_TopLevel(t *testing.T) {
	srv := routingServer(t, []routeEntry{
		{keyword: "RestaurantsTopLevel", data: restaurantsTopLevelResp},
	})
	svc := newSvc(t, srv, "") // no root → top-level path

	rs, err := svc.ListRestaurants(context.Background(), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(rs) != 1 {
		t.Fatalf("expected 1 restaurant, got %d", len(rs))
	}
}

func TestListRestaurants_TopLevelWithSearch(t *testing.T) {
	srv := routingServer(t, []routeEntry{
		{keyword: "RestaurantsTopLevel", data: restaurantsTopLevelResp},
	})
	svc := newSvc(t, srv, "")

	rs, err := svc.ListRestaurants(context.Background(), "pizza")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(rs) == 0 {
		t.Error("expected at least one restaurant")
	}
}

func TestListRestaurants_RootCategoryNotFound(t *testing.T) {
	notFoundResp := map[string]any{"category": nil}
	srv := routingServer(t, []routeEntry{
		{keyword: "RestaurantsFromRoot", data: notFoundResp},
	})
	svc := newSvc(t, srv, "missing-root")

	_, err := svc.ListRestaurants(context.Background(), "")
	if err == nil {
		t.Fatal("expected error for missing root category, got nil")
	}
}

func TestListRestaurants_EmptyList(t *testing.T) {
	emptyResp := map[string]any{
		"categories": map[string]any{
			"edges": []map[string]any{},
		},
	}
	srv := routingServer(t, []routeEntry{
		{keyword: "RestaurantsTopLevel", data: emptyResp},
	})
	svc := newSvc(t, srv, "")

	rs, err := svc.ListRestaurants(context.Background(), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(rs) != 0 {
		t.Errorf("expected empty list, got %d items", len(rs))
	}
}

func TestListRestaurants_SaleorGQLError(t *testing.T) {
	srv := gqlErrorServer(t, "permission denied")
	svc := newSvc(t, srv, "")

	_, err := svc.ListRestaurants(context.Background(), "")
	if err == nil {
		t.Fatal("expected error from Saleor, got nil")
	}
	if !strings.Contains(err.Error(), "permission denied") {
		t.Errorf("error should mention 'permission denied', got: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Tags parsing (tested via ListRestaurants)
// ---------------------------------------------------------------------------

func TestRestaurantTags_CommaSeparated(t *testing.T) {
	resp := map[string]any{
		"categories": map[string]any{
			"edges": []map[string]any{
				{"node": map[string]any{
					"id": "r1", "name": "R1", "description": "",
					"backgroundImage": nil,
					"metadata": []map[string]any{
						{"key": "tma_tags", "value": "burgers,fast food,delivery"},
					},
				}},
			},
		},
	}
	srv := routingServer(t, []routeEntry{{keyword: "RestaurantsTopLevel", data: resp}})
	svc := newSvc(t, srv, "")

	rs, err := svc.ListRestaurants(context.Background(), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(rs[0].Tags) != 3 {
		t.Errorf("expected 3 tags, got %v", rs[0].Tags)
	}
	if rs[0].Tags[1] != "fast food" {
		t.Errorf("expected 'fast food', got %q", rs[0].Tags[1])
	}
}

func TestRestaurantTags_JSONArray(t *testing.T) {
	resp := map[string]any{
		"categories": map[string]any{
			"edges": []map[string]any{
				{"node": map[string]any{
					"id": "r1", "name": "R1", "description": "",
					"backgroundImage": nil,
					"metadata": []map[string]any{
						{"key": "tma_tags", "value": `["sushi","japanese","premium"]`},
					},
				}},
			},
		},
	}
	srv := routingServer(t, []routeEntry{{keyword: "RestaurantsTopLevel", data: resp}})
	svc := newSvc(t, srv, "")

	rs, err := svc.ListRestaurants(context.Background(), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(rs[0].Tags) != 3 || rs[0].Tags[2] != "premium" {
		t.Errorf("unexpected tags from JSON array: %v", rs[0].Tags)
	}
}

func TestRestaurantTags_EmptyMetadata(t *testing.T) {
	resp := map[string]any{
		"categories": map[string]any{
			"edges": []map[string]any{
				{"node": map[string]any{
					"id": "r1", "name": "R1", "description": "",
					"backgroundImage": nil,
					"metadata":        []map[string]any{},
				}},
			},
		},
	}
	srv := routingServer(t, []routeEntry{{keyword: "RestaurantsTopLevel", data: resp}})
	svc := newSvc(t, srv, "")

	rs, err := svc.ListRestaurants(context.Background(), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(rs[0].Tags) != 0 {
		t.Errorf("expected empty tags, got %v", rs[0].Tags)
	}
}

func TestRestaurantTags_NoImageURL(t *testing.T) {
	resp := map[string]any{
		"categories": map[string]any{
			"edges": []map[string]any{
				{"node": map[string]any{
					"id": "r1", "name": "R1", "description": "",
					"backgroundImage": nil,
					"metadata":        []map[string]any{},
				}},
			},
		},
	}
	srv := routingServer(t, []routeEntry{{keyword: "RestaurantsTopLevel", data: resp}})
	svc := newSvc(t, srv, "")

	rs, err := svc.ListRestaurants(context.Background(), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rs[0].ImageURL != "" {
		t.Errorf("expected empty ImageURL for nil backgroundImage, got %q", rs[0].ImageURL)
	}
}

// ---------------------------------------------------------------------------
// ListCategories
// ---------------------------------------------------------------------------

func TestListCategories_Success(t *testing.T) {
	srv := routingServer(t, []routeEntry{
		{keyword: "RestaurantCategories", data: categoriesResp},
	})
	svc := newSvc(t, srv, "")

	cats, err := svc.ListCategories(context.Background(), "rest-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cats) != 1 {
		t.Fatalf("expected 1 category, got %d", len(cats))
	}
	c := cats[0]
	if c.ID != "cat-1" {
		t.Errorf("category.ID: want cat-1, got %q", c.ID)
	}
	if c.RestaurantID != "rest-1" {
		t.Errorf("category.RestaurantID: want rest-1, got %q", c.RestaurantID)
	}
	if c.Name != "Pizzas" {
		t.Errorf("category.Name: want Pizzas, got %q", c.Name)
	}
	if c.Description != "Our pizza menu" {
		t.Errorf("category.Description: want 'Our pizza menu', got %q", c.Description)
	}
	if c.ImageURL != "https://cdn.example.com/pizzas.jpg" {
		t.Errorf("category.ImageURL unexpected: %q", c.ImageURL)
	}
}

func TestListCategories_RestaurantNotFound(t *testing.T) {
	notFoundResp := map[string]any{"category": nil}
	srv := routingServer(t, []routeEntry{
		{keyword: "RestaurantCategories", data: notFoundResp},
	})
	svc := newSvc(t, srv, "")

	_, err := svc.ListCategories(context.Background(), "missing-restaurant")
	if err == nil {
		t.Fatal("expected error for missing restaurant category, got nil")
	}
}

func TestListCategories_EmptyChildren(t *testing.T) {
	resp := map[string]any{
		"category": map[string]any{
			"id": "rest-1",
			"children": map[string]any{
				"edges": []map[string]any{},
			},
		},
	}
	srv := routingServer(t, []routeEntry{
		{keyword: "RestaurantCategories", data: resp},
	})
	svc := newSvc(t, srv, "")

	cats, err := svc.ListCategories(context.Background(), "rest-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cats) != 0 {
		t.Errorf("expected empty list, got %d items", len(cats))
	}
}

func TestListCategories_SaleorGQLError(t *testing.T) {
	srv := gqlErrorServer(t, "category not accessible")
	svc := newSvc(t, srv, "")

	_, err := svc.ListCategories(context.Background(), "rest-1")
	if err == nil {
		t.Fatal("expected error from Saleor, got nil")
	}
}

// ---------------------------------------------------------------------------
// ListDishes
// ---------------------------------------------------------------------------

func TestListDishes_Success(t *testing.T) {
	srv := routingServer(t, []routeEntry{
		{keyword: "CategoryParent", data: categoryParentResp},
		{keyword: "CategoryDishes", data: dishesResp},
	})
	svc := newSvc(t, srv, "")

	dishes, err := svc.ListDishes(context.Background(), "rest-1", "cat-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(dishes) != 1 {
		t.Fatalf("expected 1 dish, got %d", len(dishes))
	}
	d := dishes[0]
	if d.ID != "var-1" {
		t.Errorf("dish.ID: want var-1, got %q", d.ID)
	}
	if d.ProductID != "prod-1" {
		t.Errorf("dish.ProductID: want prod-1, got %q", d.ProductID)
	}
	if d.Name != "Margherita" {
		t.Errorf("dish.Name: want Margherita, got %q", d.Name)
	}
	if d.Description != "Classic tomato and mozzarella" {
		t.Errorf("dish.Description unexpected: %q", d.Description)
	}
	if d.ImageURL != "https://cdn.example.com/margherita.jpg" {
		t.Errorf("dish.ImageURL unexpected: %q", d.ImageURL)
	}
	if d.Price.Amount != 12.5 || d.Price.Currency != "USD" {
		t.Errorf("dish.Price: want 12.5 USD, got %f %s", d.Price.Amount, d.Price.Currency)
	}
	if d.RestaurantID != "rest-1" {
		t.Errorf("dish.RestaurantID: want rest-1, got %q", d.RestaurantID)
	}
	if d.CategoryID != "cat-1" {
		t.Errorf("dish.CategoryID: want cat-1, got %q", d.CategoryID)
	}
}

func TestListDishes_CategoryNotInRestaurant(t *testing.T) {
	wrongParentResp := map[string]any{
		"category": map[string]any{
			"parent": map[string]any{"id": "other-restaurant"},
		},
	}
	srv := routingServer(t, []routeEntry{
		{keyword: "CategoryParent", data: wrongParentResp},
	})
	svc := newSvc(t, srv, "")

	_, err := svc.ListDishes(context.Background(), "rest-1", "cat-1")
	if err == nil {
		t.Fatal("expected error when category doesn't belong to restaurant, got nil")
	}
}

func TestListDishes_CategoryHasNoParent(t *testing.T) {
	noParentResp := map[string]any{
		"category": map[string]any{"parent": nil},
	}
	srv := routingServer(t, []routeEntry{
		{keyword: "CategoryParent", data: noParentResp},
	})
	svc := newSvc(t, srv, "")

	_, err := svc.ListDishes(context.Background(), "rest-1", "cat-orphan")
	if err == nil {
		t.Fatal("expected error when category has no parent, got nil")
	}
}

func TestListDishes_ProductWithoutVariants_Skipped(t *testing.T) {
	// Products without variants must be silently skipped.
	resp := map[string]any{
		"products": map[string]any{
			"edges": []map[string]any{
				{"node": map[string]any{
					"id": "prod-2", "name": "Invisible Dish", "description": "no variants",
					"thumbnail": nil, "variants": []map[string]any{},
				}},
			},
		},
	}
	srv := routingServer(t, []routeEntry{
		{keyword: "CategoryParent", data: categoryParentResp},
		{keyword: "CategoryDishes", data: resp},
	})
	svc := newSvc(t, srv, "")

	dishes, err := svc.ListDishes(context.Background(), "rest-1", "cat-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(dishes) != 0 {
		t.Errorf("expected 0 dishes (all skipped), got %d", len(dishes))
	}
}

func TestListDishes_SaleorGQLError(t *testing.T) {
	srv := routingServer(t, []routeEntry{
		{keyword: "CategoryParent", data: categoryParentResp},
	})
	// After CategoryParent succeeds, the products query will hit the same
	// server — but there is no route for "CategoryDishes", so the server
	// returns 500. The service must propagate that as an error.
	_ = srv
	// Use a dedicated server that always returns a GQL error.
	errSrv := gqlErrorServer(t, "products not accessible")
	svc := newSvc(t, errSrv, "")

	_, err := svc.ListDishes(context.Background(), "rest-1", "cat-1")
	if err == nil {
		t.Fatal("expected error from Saleor, got nil")
	}
}

// ---------------------------------------------------------------------------
// PlaceOrder — validation (no Saleor calls should be made)
// ---------------------------------------------------------------------------

func TestPlaceOrder_MissingRestaurantID(t *testing.T) {
	srv := routingServer(t, nil) // no requests expected
	svc := newSvc(t, srv, "")

	_, err := svc.PlaceOrder(context.Background(), 1, PlaceOrderInput{
		Items:         []CartItem{{DishID: "var-1", Quantity: 1}},
		GoogleMapsURL: "https://maps.google.com/?q=1,2",
	})
	if err == nil {
		t.Fatal("expected error for missing restaurantId, got nil")
	}
}

func TestPlaceOrder_EmptyItems(t *testing.T) {
	srv := routingServer(t, nil)
	svc := newSvc(t, srv, "")

	_, err := svc.PlaceOrder(context.Background(), 1, PlaceOrderInput{
		RestaurantID:  "rest-1",
		Items:         []CartItem{},
		GoogleMapsURL: "https://maps.google.com/?q=1,2",
	})
	if err == nil {
		t.Fatal("expected error for empty items, got nil")
	}
}

func TestPlaceOrder_BothDeliveryOptions_Rejected(t *testing.T) {
	srv := routingServer(t, nil)
	svc := newSvc(t, srv, "")

	_, err := svc.PlaceOrder(context.Background(), 1, PlaceOrderInput{
		RestaurantID:     "rest-1",
		Items:            []CartItem{{DishID: "var-1", Quantity: 1}},
		DeliveryLocation: &DeliveryLocation{Lat: 55.7, Lng: 37.6},
		GoogleMapsURL:    "https://maps.google.com/?q=55.7,37.6",
	})
	if err == nil {
		t.Fatal("expected error when both delivery options provided, got nil")
	}
}

func TestPlaceOrder_NeitherDeliveryOption_Rejected(t *testing.T) {
	srv := routingServer(t, nil)
	svc := newSvc(t, srv, "")

	_, err := svc.PlaceOrder(context.Background(), 1, PlaceOrderInput{
		RestaurantID: "rest-1",
		Items:        []CartItem{{DishID: "var-1", Quantity: 1}},
		// Neither DeliveryLocation nor GoogleMapsURL.
	})
	if err == nil {
		t.Fatal("expected error when neither delivery option provided, got nil")
	}
}

func TestPlaceOrder_ZeroQuantity_Rejected(t *testing.T) {
	// Validation happens after draft creation, so two Saleor calls occur.
	srv := routingServer(t, []routeEntry{
		{keyword: "draftOrderCreate", data: draftOrderCreateResp},
	})
	svc := newSvc(t, srv, "")

	_, err := svc.PlaceOrder(context.Background(), 1, PlaceOrderInput{
		RestaurantID:  "rest-1",
		Items:         []CartItem{{DishID: "var-1", Quantity: 0}},
		GoogleMapsURL: "https://maps.google.com/?q=1,2",
	})
	if err == nil {
		t.Fatal("expected error for zero quantity, got nil")
	}
}

// ---------------------------------------------------------------------------
// PlaceOrder — Saleor-level errors
// ---------------------------------------------------------------------------

func TestPlaceOrder_DraftCreateSaleorError(t *testing.T) {
	// Saleor returns a mutation-level error in the errors array.
	errResp := map[string]any{
		"draftOrderCreate": map[string]any{
			"order": nil,
			"errors": []map[string]any{
				{"field": "channel", "message": "channel not found", "code": "NOT_FOUND"},
			},
		},
	}
	srv := routingServer(t, []routeEntry{
		{keyword: "draftOrderCreate", data: errResp},
	})
	svc := newSvc(t, srv, "")

	_, err := svc.PlaceOrder(context.Background(), 1, PlaceOrderInput{
		RestaurantID:  "rest-1",
		Items:         []CartItem{{DishID: "var-1", Quantity: 1}},
		GoogleMapsURL: "https://maps.google.com/?q=1,2",
	})
	if err == nil {
		t.Fatal("expected error from Saleor draftOrderCreate, got nil")
	}
	if !strings.Contains(err.Error(), "channel not found") {
		t.Errorf("error should mention 'channel not found', got: %v", err)
	}
}

func TestPlaceOrder_AddLinesSaleorError(t *testing.T) {
	errLinesResp := map[string]any{
		"orderLinesCreate": map[string]any{
			"order": nil,
			"errors": []map[string]any{
				{"message": "variant not available in channel"},
			},
		},
	}
	srv := routingServer(t, []routeEntry{
		{keyword: "draftOrderCreate", data: draftOrderCreateResp},
		{keyword: "orderLinesCreate", data: errLinesResp},
	})
	svc := newSvc(t, srv, "")

	_, err := svc.PlaceOrder(context.Background(), 1, PlaceOrderInput{
		RestaurantID:  "rest-1",
		Items:         []CartItem{{DishID: "var-bad", Quantity: 1}},
		GoogleMapsURL: "https://maps.google.com/?q=1,2",
	})
	if err == nil {
		t.Fatal("expected error from Saleor orderLinesCreate, got nil")
	}
	if !strings.Contains(err.Error(), "variant not available in channel") {
		t.Errorf("error should mention variant problem, got: %v", err)
	}
}

func TestPlaceOrder_CompleteOrderSaleorError(t *testing.T) {
	errCompleteResp := map[string]any{
		"draftOrderComplete": map[string]any{
			"order": nil,
			"errors": []map[string]any{
				{"message": "order cannot be completed: missing address"},
			},
		},
	}
	srv := routingServer(t, []routeEntry{
		{keyword: "draftOrderCreate", data: draftOrderCreateResp},
		{keyword: "orderLinesCreate", data: orderLinesCreateResp},
		{keyword: "draftOrderComplete", data: errCompleteResp},
	})
	svc := newSvc(t, srv, "")

	_, err := svc.PlaceOrder(context.Background(), 1, PlaceOrderInput{
		RestaurantID:  "rest-1",
		Items:         []CartItem{{DishID: "var-1", Quantity: 1}},
		GoogleMapsURL: "https://maps.google.com/?q=1,2",
	})
	if err == nil {
		t.Fatal("expected error from Saleor draftOrderComplete, got nil")
	}
	if !strings.Contains(err.Error(), "missing address") {
		t.Errorf("error should mention 'missing address', got: %v", err)
	}
}

func TestPlaceOrder_NetworkError(t *testing.T) {
	// Create a server and immediately close it to simulate a network failure.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	srv.Close() // closed immediately

	sc := saleor.NewClient(srv.URL, "test-token")
	svc := NewService(sc, "CH1", "default-channel", "")

	_, err := svc.PlaceOrder(context.Background(), 1, PlaceOrderInput{
		RestaurantID:  "rest-1",
		Items:         []CartItem{{DishID: "var-1", Quantity: 1}},
		GoogleMapsURL: "https://maps.google.com/?q=1,2",
	})
	if err == nil {
		t.Fatal("expected network error, got nil")
	}
}

// ---------------------------------------------------------------------------
// PlaceOrder — metadata / email convention
// ---------------------------------------------------------------------------

// TestPlaceOrder_TelegramEmailConvention verifies that the draft order is
// created with the tg-<userID>@tma.local email pattern by inspecting the
// raw request body sent to Saleor.
func TestPlaceOrder_TelegramEmailConvention(t *testing.T) {
	const telegramUserID = int64(987654321)
	expectedEmail := "tg-987654321@tma.local"

	var capturedBody []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		if capturedBody == nil {
			capturedBody = b // capture the first (draftOrderCreate) request
		}
		var req struct {
			Query string `json:"query"`
		}
		_ = json.Unmarshal(b, &req)

		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.Contains(req.Query, "draftOrderCreate"):
			_ = json.NewEncoder(w).Encode(map[string]any{"data": draftOrderCreateResp})
		case strings.Contains(req.Query, "orderLinesCreate"):
			_ = json.NewEncoder(w).Encode(map[string]any{"data": orderLinesCreateResp})
		case strings.Contains(req.Query, "draftOrderComplete"):
			_ = json.NewEncoder(w).Encode(map[string]any{"data": draftOrderCompleteResp})
		default:
			http.Error(w, "unexpected", 500)
		}
	}))
	t.Cleanup(srv.Close)

	sc := saleor.NewClient(srv.URL, "test-token")
	svc := NewService(sc, "CH1", "default-channel", "")

	_, err := svc.PlaceOrder(context.Background(), telegramUserID, PlaceOrderInput{
		RestaurantID:  "rest-1",
		Items:         []CartItem{{DishID: "var-1", Quantity: 1}},
		GoogleMapsURL: "https://maps.google.com/?q=1,2",
	})
	if err != nil {
		t.Fatalf("PlaceOrder: %v", err)
	}

	if !strings.Contains(string(capturedBody), expectedEmail) {
		t.Errorf("expected email %q in Saleor request body, got: %s", expectedEmail, string(capturedBody))
	}
}

// TestPlaceOrder_MetadataKeys verifies that the correct metadata keys are
// sent to Saleor for both coordinate-based and Google-Maps-URL delivery.
func TestPlaceOrder_MetadataKeys_Coordinates(t *testing.T) {
	var capturedBody []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		var req struct {
			Query string `json:"query"`
		}
		_ = json.Unmarshal(b, &req)
		if strings.Contains(req.Query, "draftOrderCreate") && capturedBody == nil {
			capturedBody = b
		}
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.Contains(req.Query, "draftOrderCreate"):
			_ = json.NewEncoder(w).Encode(map[string]any{"data": draftOrderCreateResp})
		case strings.Contains(req.Query, "orderLinesCreate"):
			_ = json.NewEncoder(w).Encode(map[string]any{"data": orderLinesCreateResp})
		case strings.Contains(req.Query, "draftOrderComplete"):
			_ = json.NewEncoder(w).Encode(map[string]any{"data": draftOrderCompleteResp})
		default:
			http.Error(w, "unexpected", 500)
		}
	}))
	t.Cleanup(srv.Close)

	sc := saleor.NewClient(srv.URL, "test-token")
	svc := NewService(sc, "CH1", "default-channel", "")

	_, err := svc.PlaceOrder(context.Background(), 42, PlaceOrderInput{
		RestaurantID:     "rest-1",
		Items:            []CartItem{{DishID: "var-1", Quantity: 1}},
		DeliveryLocation: &DeliveryLocation{Lat: 55.751244, Lng: 37.618423},
	})
	if err != nil {
		t.Fatalf("PlaceOrder: %v", err)
	}

	body := string(capturedBody)
	for _, key := range []string{"tma.telegramUserId", "tma.restaurantId", "tma.delivery.lat", "tma.delivery.lng"} {
		if !strings.Contains(body, key) {
			t.Errorf("expected metadata key %q in Saleor request, not found in: %s", key, body)
		}
	}
	if strings.Contains(body, "tma.delivery.googleMapsUrl") {
		t.Error("googleMapsUrl key must NOT be present when coordinates are supplied")
	}
}

func TestPlaceOrder_MetadataKeys_GoogleMapsUrl(t *testing.T) {
	const mapsURL = "https://maps.google.com/?q=55.75,37.62"
	var capturedBody []byte

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		var req struct {
			Query string `json:"query"`
		}
		_ = json.Unmarshal(b, &req)
		if strings.Contains(req.Query, "draftOrderCreate") && capturedBody == nil {
			capturedBody = b
		}
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.Contains(req.Query, "draftOrderCreate"):
			_ = json.NewEncoder(w).Encode(map[string]any{"data": draftOrderCreateResp})
		case strings.Contains(req.Query, "orderLinesCreate"):
			_ = json.NewEncoder(w).Encode(map[string]any{"data": orderLinesCreateResp})
		case strings.Contains(req.Query, "draftOrderComplete"):
			_ = json.NewEncoder(w).Encode(map[string]any{"data": draftOrderCompleteResp})
		default:
			http.Error(w, "unexpected", 500)
		}
	}))
	t.Cleanup(srv.Close)

	sc := saleor.NewClient(srv.URL, "test-token")
	svc := NewService(sc, "CH1", "default-channel", "")

	_, err := svc.PlaceOrder(context.Background(), 42, PlaceOrderInput{
		RestaurantID:  "rest-1",
		Items:         []CartItem{{DishID: "var-1", Quantity: 1}},
		GoogleMapsURL: mapsURL,
	})
	if err != nil {
		t.Fatalf("PlaceOrder: %v", err)
	}

	body := string(capturedBody)
	if !strings.Contains(body, "tma.delivery.googleMapsUrl") {
		t.Errorf("expected metadata key 'tma.delivery.googleMapsUrl', not found in: %s", body)
	}
	if strings.Contains(body, "tma.delivery.lat") || strings.Contains(body, "tma.delivery.lng") {
		t.Error("lat/lng keys must NOT be present when googleMapsUrl is supplied")
	}
}
