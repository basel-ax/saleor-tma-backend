package tma

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"saleor-tma-backend/internal/saleor"
)

// ---------------------------------------------------------------------------
// Domain types (passed to/from resolvers)
// ---------------------------------------------------------------------------

type Money struct {
	Amount   float64
	Currency string
}

type Restaurant struct {
	ID          string
	Name        string
	Description string
	ImageURL    string
	Tags        []string
}

type Category struct {
	ID           string
	RestaurantID string
	Name         string
	Description  string
	ImageURL     string
}

type Dish struct {
	ID           string // Saleor variant ID
	ProductID    string
	RestaurantID string
	CategoryID   string
	Name         string
	Description  string
	ImageURL     string
	Price        Money
}

type CartItem struct {
	DishID   string
	Quantity int
}

type DeliveryLocation struct {
	Lat float64
	Lng float64
}

type PlaceOrderInput struct {
	RestaurantID     string
	Items            []CartItem
	DeliveryLocation *DeliveryLocation
	GoogleMapsURL    string
	Comment          string
}

type PlaceOrderResult struct {
	OrderID string
	Status  string
}

// ---------------------------------------------------------------------------
// Private Saleor response types — reused across multiple query response structs
// ---------------------------------------------------------------------------

// saleorImage represents a Saleor image node (backgroundImage, thumbnail).
type saleorImage struct {
	URL string `json:"url"`
}

// saleorMeta represents one Saleor metadata key-value pair.
type saleorMeta struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// saleorRestaurantNode is the shape of a Saleor category used as a restaurant.
// Used by both listRestaurantsFromRoot and listRestaurantsTopLevel.
type saleorRestaurantNode struct {
	ID              string       `json:"id"`
	Name            string       `json:"name"`
	Description     string       `json:"description"`
	BackgroundImage *saleorImage `json:"backgroundImage"`
	Metadata        []saleorMeta `json:"metadata"`
}

// saleorCategoryNode is the shape of a Saleor child category (dish category).
type saleorCategoryNode struct {
	ID              string       `json:"id"`
	Name            string       `json:"name"`
	Description     string       `json:"description"`
	BackgroundImage *saleorImage `json:"backgroundImage"`
}

// saleorVariant holds a single Saleor product variant with pricing.
type saleorVariant struct {
	ID      string `json:"id"`
	Pricing *struct {
		Price *struct {
			Gross struct {
				Amount   float64 `json:"amount"`
				Currency string  `json:"currency"`
			} `json:"gross"`
		} `json:"price"`
	} `json:"pricing"`
}

// saleorProductNode is the shape of a Saleor product returned by the dishes query.
type saleorProductNode struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Thumbnail   *saleorImage    `json:"thumbnail"`
	Variants    []saleorVariant `json:"variants"`
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

type Service struct {
	saleor                   *saleor.Client
	channelID                string
	channelSlug              string
	restaurantRootCategoryID string
}

func NewService(saleorClient *saleor.Client, channelID, channelSlug, restaurantRootCategoryID string) *Service {
	return &Service{
		saleor:                   saleorClient,
		channelID:                channelID,
		channelSlug:              channelSlug,
		restaurantRootCategoryID: restaurantRootCategoryID,
	}
}

// ---------------------------------------------------------------------------
// ListRestaurants
// ---------------------------------------------------------------------------

func (s *Service) ListRestaurants(ctx context.Context, search string) ([]Restaurant, error) {
	if s.restaurantRootCategoryID != "" {
		return s.listRestaurantsFromRoot(ctx, s.restaurantRootCategoryID)
	}
	return s.listRestaurantsTopLevel(ctx, search)
}

func (s *Service) listRestaurantsFromRoot(ctx context.Context, rootID string) ([]Restaurant, error) {
	const q = `
query RestaurantsFromRoot($id: ID!) {
  category(id: $id) {
    children(first: 100) {
      edges {
        node {
          id
          name
          description
          backgroundImage { url }
          metadata { key value }
        }
      }
    }
  }
}`

	var resp struct {
		Category *struct {
			Children struct {
				Edges []struct {
					Node saleorRestaurantNode `json:"node"`
				} `json:"edges"`
			} `json:"children"`
		} `json:"category"`
	}

	if err := s.saleor.Do(ctx, q, map[string]any{"id": rootID}, &resp); err != nil {
		return nil, err
	}
	if resp.Category == nil {
		return nil, errors.New("root category not found")
	}

	nodes := make([]saleorRestaurantNode, 0, len(resp.Category.Children.Edges))
	for _, e := range resp.Category.Children.Edges {
		nodes = append(nodes, e.Node)
	}
	return mapRestaurants(nodes), nil
}

func (s *Service) listRestaurantsTopLevel(ctx context.Context, search string) ([]Restaurant, error) {
	const q = `
query RestaurantsTopLevel($first: Int!, $level: Int!, $filter: CategoryFilterInput) {
  categories(first: $first, level: $level, filter: $filter) {
    edges {
      node {
        id
        name
        description
        backgroundImage { url }
        metadata { key value }
      }
    }
  }
}`

	var filter map[string]any
	if strings.TrimSpace(search) != "" {
		filter = map[string]any{"search": search}
	}

	var resp struct {
		Categories struct {
			Edges []struct {
				Node saleorRestaurantNode `json:"node"`
			} `json:"edges"`
		} `json:"categories"`
	}

	vars := map[string]any{
		"first":  100,
		"level":  0,
		"filter": filter,
	}
	if err := s.saleor.Do(ctx, q, vars, &resp); err != nil {
		return nil, err
	}

	nodes := make([]saleorRestaurantNode, 0, len(resp.Categories.Edges))
	for _, e := range resp.Categories.Edges {
		nodes = append(nodes, e.Node)
	}
	return mapRestaurants(nodes), nil
}

// mapRestaurants converts a slice of Saleor category nodes to the domain type.
func mapRestaurants(nodes []saleorRestaurantNode) []Restaurant {
	out := make([]Restaurant, 0, len(nodes))
	for _, n := range nodes {
		img := ""
		if n.BackgroundImage != nil {
			img = n.BackgroundImage.URL
		}
		out = append(out, Restaurant{
			ID:          n.ID,
			Name:        n.Name,
			Description: n.Description,
			ImageURL:    img,
			Tags:        parseTagsFromMetadata(n.Metadata),
		})
	}
	return out
}

// parseTagsFromMetadata extracts the tma_tags value from Saleor metadata.
// The value may be a comma-separated string or a JSON array.
func parseTagsFromMetadata(meta []saleorMeta) []string {
	for _, m := range meta {
		if m.Key != "tma_tags" {
			continue
		}
		v := strings.TrimSpace(m.Value)
		if v == "" {
			return nil
		}
		// Try JSON array first.
		if strings.HasPrefix(v, "[") {
			var arr []string
			if err := json.Unmarshal([]byte(v), &arr); err == nil {
				return arr
			}
		}
		// Fall back to comma-separated.
		parts := strings.Split(v, ",")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			if p = strings.TrimSpace(p); p != "" {
				out = append(out, p)
			}
		}
		return out
	}
	return nil
}

// ---------------------------------------------------------------------------
// ListCategories
// ---------------------------------------------------------------------------

func (s *Service) ListCategories(ctx context.Context, restaurantID string) ([]Category, error) {
	const q = `
query RestaurantCategories($id: ID!) {
  category(id: $id) {
    id
    children(first: 100) {
      edges {
        node {
          id
          name
          description
          backgroundImage { url }
        }
      }
    }
  }
}`

	var resp struct {
		Category *struct {
			ID       string `json:"id"`
			Children struct {
				Edges []struct {
					Node saleorCategoryNode `json:"node"`
				} `json:"edges"`
			} `json:"children"`
		} `json:"category"`
	}

	if err := s.saleor.Do(ctx, q, map[string]any{"id": restaurantID}, &resp); err != nil {
		return nil, err
	}
	if resp.Category == nil {
		return nil, errors.New("restaurant category not found")
	}

	out := make([]Category, 0, len(resp.Category.Children.Edges))
	for _, e := range resp.Category.Children.Edges {
		n := e.Node
		img := ""
		if n.BackgroundImage != nil {
			img = n.BackgroundImage.URL
		}
		out = append(out, Category{
			ID:           n.ID,
			RestaurantID: restaurantID,
			Name:         n.Name,
			Description:  n.Description,
			ImageURL:     img,
		})
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// ListDishes
// ---------------------------------------------------------------------------

func (s *Service) ListDishes(ctx context.Context, restaurantID, categoryID string) ([]Dish, error) {
	// Validate parent relationship (best-effort, fast).
	ok, err := s.categoryIsChildOf(ctx, categoryID, restaurantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errors.New("category does not belong to restaurant")
	}

	const q = `
query CategoryDishes($first: Int!, $channel: String!, $categoryId: [ID!]) {
  products(first: $first, channel: $channel, filter: { categories: $categoryId }) {
    edges {
      node {
        id
        name
        description
        thumbnail(size: 512) { url }
        variants {
          id
          pricing {
            price {
              gross { amount currency }
            }
          }
        }
      }
    }
  }
}`

	var resp struct {
		Products struct {
			Edges []struct {
				Node saleorProductNode `json:"node"`
			} `json:"edges"`
		} `json:"products"`
	}

	vars := map[string]any{
		"first":      100,
		"channel":    s.channelSlug,
		"categoryId": []string{categoryID},
	}
	if err := s.saleor.Do(ctx, q, vars, &resp); err != nil {
		return nil, err
	}

	out := make([]Dish, 0, len(resp.Products.Edges))
	for _, e := range resp.Products.Edges {
		n := e.Node
		if len(n.Variants) == 0 {
			continue
		}
		v := n.Variants[0]

		amount := 0.0
		currency := ""
		if v.Pricing != nil && v.Pricing.Price != nil {
			amount = v.Pricing.Price.Gross.Amount
			currency = v.Pricing.Price.Gross.Currency
		}

		img := ""
		if n.Thumbnail != nil {
			img = n.Thumbnail.URL
		}

		out = append(out, Dish{
			ID:           v.ID,
			ProductID:    n.ID,
			RestaurantID: restaurantID,
			CategoryID:   categoryID,
			Name:         n.Name,
			Description:  n.Description,
			ImageURL:     img,
			Price: Money{
				Amount:   amount,
				Currency: currency,
			},
		})
	}
	return out, nil
}

// categoryIsChildOf checks whether categoryID is a direct child of expectedParentID.
func (s *Service) categoryIsChildOf(ctx context.Context, categoryID, expectedParentID string) (bool, error) {
	const q = `
query CategoryParent($id: ID!) {
  category(id: $id) {
    id
    parent { id }
  }
}`

	var resp struct {
		Category *struct {
			Parent *struct {
				ID string `json:"id"`
			} `json:"parent"`
		} `json:"category"`
	}

	if err := s.saleor.Do(ctx, q, map[string]any{"id": categoryID}, &resp); err != nil {
		return false, err
	}
	if resp.Category == nil || resp.Category.Parent == nil {
		return false, nil
	}
	return resp.Category.Parent.ID == expectedParentID, nil
}

// ---------------------------------------------------------------------------
// PlaceOrder
// ---------------------------------------------------------------------------

func (s *Service) PlaceOrder(ctx context.Context, telegramUserID int64, input PlaceOrderInput) (PlaceOrderResult, error) {
	if err := validatePlaceOrderInput(input); err != nil {
		return PlaceOrderResult{}, err
	}

	orderID, err := s.createDraftOrder(ctx, telegramUserID, input)
	if err != nil {
		return PlaceOrderResult{}, err
	}

	if err := s.addOrderLines(ctx, orderID, input.Items); err != nil {
		return PlaceOrderResult{}, err
	}

	return s.completeDraftOrder(ctx, orderID)
}

// validatePlaceOrderInput checks business rules before any Saleor calls.
func validatePlaceOrderInput(input PlaceOrderInput) error {
	if input.RestaurantID == "" {
		return errors.New("restaurantId is required")
	}
	if len(input.Items) == 0 {
		return errors.New("items must not be empty")
	}
	hasCoords := input.DeliveryLocation != nil
	hasMapsURL := strings.TrimSpace(input.GoogleMapsURL) != ""
	if hasCoords == hasMapsURL {
		return errors.New("provide exactly one of deliveryLocation or googleMapsUrl")
	}
	return nil
}

func (s *Service) createDraftOrder(ctx context.Context, telegramUserID int64, input PlaceOrderInput) (string, error) {
	const q = `
mutation CreateDraft($input: DraftOrderCreateInput!) {
  draftOrderCreate(input: $input) {
    order { id status }
    errors { field message code }
  }
}`

	meta := buildOrderMetadata(telegramUserID, input)

	var resp struct {
		DraftOrderCreate struct {
			Order *struct {
				ID     string `json:"id"`
				Status string `json:"status"`
			} `json:"order"`
			Errors []struct {
				Field   string `json:"field"`
				Message string `json:"message"`
				Code    string `json:"code"`
			} `json:"errors"`
		} `json:"draftOrderCreate"`
	}

	vars := map[string]any{
		"input": map[string]any{
			"channelId":    s.channelID,
			"userEmail":    fmt.Sprintf("tg-%d@tma.local", telegramUserID),
			"customerNote": input.Comment,
			"metadata":     meta,
		},
	}
	if err := s.saleor.Do(ctx, q, vars, &resp); err != nil {
		return "", err
	}
	if resp.DraftOrderCreate.Order == nil {
		if len(resp.DraftOrderCreate.Errors) > 0 {
			return "", fmt.Errorf("saleor draftOrderCreate: %s", resp.DraftOrderCreate.Errors[0].Message)
		}
		return "", errors.New("saleor draftOrderCreate: no order returned")
	}
	return resp.DraftOrderCreate.Order.ID, nil
}

func (s *Service) addOrderLines(ctx context.Context, orderID string, items []CartItem) error {
	const q = `
mutation AddLines($id: ID!, $input: [OrderLineCreateInput!]!) {
  orderLinesCreate(id: $id, input: $input) {
    order { id }
    errors { field message code }
  }
}`

	lines := make([]map[string]any, 0, len(items))
	for _, it := range items {
		if it.Quantity <= 0 {
			return errors.New("item quantity must be >= 1")
		}
		lines = append(lines, map[string]any{
			"variantId": it.DishID,
			"quantity":  it.Quantity,
		})
	}

	var resp struct {
		OrderLinesCreate struct {
			Order *struct {
				ID string `json:"id"`
			} `json:"order"`
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		} `json:"orderLinesCreate"`
	}

	if err := s.saleor.Do(ctx, q, map[string]any{"id": orderID, "input": lines}, &resp); err != nil {
		return err
	}
	if resp.OrderLinesCreate.Order == nil && len(resp.OrderLinesCreate.Errors) > 0 {
		return fmt.Errorf("saleor orderLinesCreate: %s", resp.OrderLinesCreate.Errors[0].Message)
	}
	return nil
}

func (s *Service) completeDraftOrder(ctx context.Context, orderID string) (PlaceOrderResult, error) {
	const q = `
mutation CompleteDraft($id: ID!) {
  draftOrderComplete(id: $id) {
    order { id status }
    errors { field message code }
  }
}`

	var resp struct {
		DraftOrderComplete struct {
			Order *struct {
				ID     string `json:"id"`
				Status string `json:"status"`
			} `json:"order"`
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		} `json:"draftOrderComplete"`
	}

	if err := s.saleor.Do(ctx, q, map[string]any{"id": orderID}, &resp); err != nil {
		return PlaceOrderResult{}, err
	}
	if resp.DraftOrderComplete.Order == nil {
		if len(resp.DraftOrderComplete.Errors) > 0 {
			return PlaceOrderResult{}, fmt.Errorf("saleor draftOrderComplete: %s", resp.DraftOrderComplete.Errors[0].Message)
		}
		return PlaceOrderResult{}, errors.New("saleor draftOrderComplete: no order returned")
	}
	return PlaceOrderResult{
		OrderID: resp.DraftOrderComplete.Order.ID,
		Status:  resp.DraftOrderComplete.Order.Status,
	}, nil
}

// buildOrderMetadata assembles the Saleor metadata slice for a new order.
func buildOrderMetadata(telegramUserID int64, input PlaceOrderInput) []map[string]string {
	meta := []map[string]string{
		{"key": "tma.telegramUserId", "value": fmt.Sprintf("%d", telegramUserID)},
		{"key": "tma.restaurantId", "value": input.RestaurantID},
	}
	if input.DeliveryLocation != nil {
		meta = append(meta,
			map[string]string{"key": "tma.delivery.lat", "value": fmt.Sprintf("%f", input.DeliveryLocation.Lat)},
			map[string]string{"key": "tma.delivery.lng", "value": fmt.Sprintf("%f", input.DeliveryLocation.Lng)},
		)
	} else {
		meta = append(meta, map[string]string{"key": "tma.delivery.googleMapsUrl", "value": input.GoogleMapsURL})
	}
	return meta
}
