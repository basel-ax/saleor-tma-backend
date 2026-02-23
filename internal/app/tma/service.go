package tma

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"saleor-tma-backend/internal/saleor"
)

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
	RestaurantID    string
	Items           []CartItem
	DeliveryLocation *DeliveryLocation
	GoogleMapsURL   string
	Comment         string
}

type PlaceOrderResult struct {
	OrderID string
	Status  string
}

type Service struct {
	saleor *saleor.Client
	channelID   string
	channelSlug string
	restaurantRootCategoryID string
}

func NewService(saleorClient *saleor.Client, channelID, channelSlug, restaurantRootCategoryID string) *Service {
	return &Service{
		saleor: saleorClient,
		channelID: channelID,
		channelSlug: channelSlug,
		restaurantRootCategoryID: restaurantRootCategoryID,
	}
}

func (s *Service) ListRestaurants(ctx context.Context, search string) ([]Restaurant, error) {
	if s.restaurantRootCategoryID != "" {
		return s.listRestaurantsFromRoot(ctx, s.restaurantRootCategoryID)
	}
	return s.listRestaurantsTopLevel(ctx, search)
}

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
					Node struct {
						ID              string `json:"id"`
						Name            string `json:"name"`
						Description     string `json:"description"`
						BackgroundImage *struct {
							URL string `json:"url"`
						} `json:"backgroundImage"`
					} `json:"node"`
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
		img := ""
		if e.Node.BackgroundImage != nil {
			img = e.Node.BackgroundImage.URL
		}
		out = append(out, Category{
			ID:           e.Node.ID,
			RestaurantID: restaurantID,
			Name:         e.Node.Name,
			Description:  e.Node.Description,
			ImageURL:     img,
		})
	}
	return out, nil
}

func (s *Service) ListDishes(ctx context.Context, restaurantID, categoryID string) ([]Dish, error) {
	// Validate parent relationship (best-effort, fast).
	if ok, err := s.categoryIsChildOf(ctx, categoryID, restaurantID); err != nil {
		return nil, err
	} else if !ok {
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
				Node struct {
					ID          string `json:"id"`
					Name        string `json:"name"`
					Description string `json:"description"`
					Thumbnail   *struct {
						URL string `json:"url"`
					} `json:"thumbnail"`
					Variants []struct {
						ID      string `json:"id"`
						Pricing *struct {
							Price *struct {
								Gross struct {
									Amount   float64 `json:"amount"`
									Currency string  `json:"currency"`
								} `json:"gross"`
							} `json:"price"`
						} `json:"pricing"`
					} `json:"variants"`
				} `json:"node"`
			} `json:"edges"`
		} `json:"products"`
	}

	vars := map[string]any{
		"first":     100,
		"channel":   s.channelSlug,
		"categoryId": []string{categoryID},
	}
	if err := s.saleor.Do(ctx, q, vars, &resp); err != nil {
		return nil, err
	}

	out := make([]Dish, 0, len(resp.Products.Edges))
	for _, e := range resp.Products.Edges {
		if len(e.Node.Variants) == 0 {
			continue
		}
		v := e.Node.Variants[0]
		amount := 0.0
		currency := ""
		if v.Pricing != nil && v.Pricing.Price != nil {
			amount = v.Pricing.Price.Gross.Amount
			currency = v.Pricing.Price.Gross.Currency
		}
		img := ""
		if e.Node.Thumbnail != nil {
			img = e.Node.Thumbnail.URL
		}

		out = append(out, Dish{
			ID:           v.ID,
			ProductID:    e.Node.ID,
			RestaurantID: restaurantID,
			CategoryID:   categoryID,
			Name:         e.Node.Name,
			Description:  e.Node.Description,
			ImageURL:     img,
			Price: Money{
				Amount:   amount,
				Currency: currency,
			},
		})
	}
	return out, nil
}

func (s *Service) PlaceOrder(ctx context.Context, telegramUserID int64, input PlaceOrderInput) (PlaceOrderResult, error) {
	if input.RestaurantID == "" {
		return PlaceOrderResult{}, errors.New("restaurantId is required")
	}
	if len(input.Items) == 0 {
		return PlaceOrderResult{}, errors.New("items must not be empty")
	}
	if (input.DeliveryLocation == nil) == (strings.TrimSpace(input.GoogleMapsURL) == "") {
		return PlaceOrderResult{}, errors.New("provide exactly one of deliveryLocation or googleMapsUrl")
	}

	// 1) Create draft order (no lines yet).
	const createDraft = `
mutation CreateDraft($input: DraftOrderCreateInput!) {
  draftOrderCreate(input: $input) {
    order { id status }
    errors { field message code }
  }
}`

	userEmail := fmt.Sprintf("tg-%d@tma.local", telegramUserID)

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

	var createResp struct {
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

	createVars := map[string]any{
		"input": map[string]any{
			"channelId":    s.channelID,
			"userEmail":    userEmail,
			"customerNote": input.Comment,
			"metadata":     meta,
		},
	}
	if err := s.saleor.Do(ctx, createDraft, createVars, &createResp); err != nil {
		return PlaceOrderResult{}, err
	}
	if createResp.DraftOrderCreate.Order == nil {
		if len(createResp.DraftOrderCreate.Errors) > 0 {
			return PlaceOrderResult{}, fmt.Errorf("saleor draftOrderCreate: %s", createResp.DraftOrderCreate.Errors[0].Message)
		}
		return PlaceOrderResult{}, errors.New("saleor draftOrderCreate failed")
	}
	orderID := createResp.DraftOrderCreate.Order.ID

	// 2) Add order lines.
	const addLines = `
mutation AddLines($id: ID!, $input: [OrderLineCreateInput!]!) {
  orderLinesCreate(id: $id, input: $input) {
    order { id }
    errors { field message code }
  }
}`

	lines := make([]map[string]any, 0, len(input.Items))
	for _, it := range input.Items {
		if it.Quantity <= 0 {
			return PlaceOrderResult{}, errors.New("item quantity must be >= 1")
		}
		lines = append(lines, map[string]any{
			"variantId": it.DishID,
			"quantity":  it.Quantity,
		})
	}

	var linesResp struct {
		OrderLinesCreate struct {
			Order *struct {
				ID string `json:"id"`
			} `json:"order"`
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		} `json:"orderLinesCreate"`
	}
	if err := s.saleor.Do(ctx, addLines, map[string]any{"id": orderID, "input": lines}, &linesResp); err != nil {
		return PlaceOrderResult{}, err
	}
	if linesResp.OrderLinesCreate.Order == nil && len(linesResp.OrderLinesCreate.Errors) > 0 {
		return PlaceOrderResult{}, fmt.Errorf("saleor orderLinesCreate: %s", linesResp.OrderLinesCreate.Errors[0].Message)
	}

	// 3) Complete draft order.
	const complete = `
mutation CompleteDraft($id: ID!) {
  draftOrderComplete(id: $id) {
    order { id status }
    errors { field message code }
  }
}`

	var completeResp struct {
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
	if err := s.saleor.Do(ctx, complete, map[string]any{"id": orderID}, &completeResp); err != nil {
		return PlaceOrderResult{}, err
	}
	if completeResp.DraftOrderComplete.Order == nil {
		if len(completeResp.DraftOrderComplete.Errors) > 0 {
			return PlaceOrderResult{}, fmt.Errorf("saleor draftOrderComplete: %s", completeResp.DraftOrderComplete.Errors[0].Message)
		}
		return PlaceOrderResult{}, errors.New("saleor draftOrderComplete failed")
	}

	return PlaceOrderResult{
		OrderID: completeResp.DraftOrderComplete.Order.ID,
		Status:  string(completeResp.DraftOrderComplete.Order.Status),
	}, nil
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
					Node struct {
						ID              string `json:"id"`
						Name            string `json:"name"`
						Description     string `json:"description"`
						BackgroundImage *struct {
							URL string `json:"url"`
						} `json:"backgroundImage"`
						Metadata []struct {
							Key   string `json:"key"`
							Value string `json:"value"`
						} `json:"metadata"`
					} `json:"node"`
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
	return mapRestaurants(resp.Category.Children.Edges), nil
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

	filter := map[string]any(nil)
	if strings.TrimSpace(search) != "" {
		filter = map[string]any{"search": search}
	}

	var resp struct {
		Categories struct {
			Edges []struct {
				Node struct {
					ID              string `json:"id"`
					Name            string `json:"name"`
					Description     string `json:"description"`
					BackgroundImage *struct {
						URL string `json:"url"`
					} `json:"backgroundImage"`
					Metadata []struct {
						Key   string `json:"key"`
						Value string `json:"value"`
					} `json:"metadata"`
				} `json:"node"`
			} `json:"edges"`
		} `json:"categories"`
	}

	vars := map[string]any{
		"first": 100,
		"level": 0,
		"filter": filter,
	}
	if err := s.saleor.Do(ctx, q, vars, &resp); err != nil {
		return nil, err
	}
	return mapRestaurants(resp.Categories.Edges), nil
}

func mapRestaurants(edges []struct {
	Node struct {
		ID              string `json:"id"`
		Name            string `json:"name"`
		Description     string `json:"description"`
		BackgroundImage *struct {
			URL string `json:"url"`
		} `json:"backgroundImage"`
		Metadata []struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		} `json:"metadata"`
	} `json:"node"`
}) []Restaurant {
	out := make([]Restaurant, 0, len(edges))
	for _, e := range edges {
		img := ""
		if e.Node.BackgroundImage != nil {
			img = e.Node.BackgroundImage.URL
		}
		tags := parseTagsFromMetadata(e.Node.Metadata)
		out = append(out, Restaurant{
			ID:          e.Node.ID,
			Name:        e.Node.Name,
			Description: e.Node.Description,
			ImageURL:    img,
			Tags:        tags,
		})
	}
	return out
}

func parseTagsFromMetadata(meta []struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}) []string {
	for _, m := range meta {
		if m.Key != "tma_tags" {
			continue
		}
		v := strings.TrimSpace(m.Value)
		if v == "" {
			return nil
		}
		var arr []string
		if strings.HasPrefix(v, "[") {
			if err := json.Unmarshal([]byte(v), &arr); err == nil {
				return arr
			}
		}
		parts := strings.Split(v, ",")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				out = append(out, p)
			}
		}
		return out
	}
	return nil
}

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

