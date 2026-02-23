package saleor

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	apiURL string
	token  string
	http   *http.Client
}

func NewClient(apiURL string, token string) *Client {
	return &Client{
		apiURL: apiURL,
		token:  token,
		http: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

type graphQLRequest struct {
	Query     string                 `json:"query"`
	Variables map[string]any         `json:"variables,omitempty"`
	Operation string                 `json:"operationName,omitempty"`
}

type graphQLError struct {
	Message    string         `json:"message"`
	Path       []any          `json:"path,omitempty"`
	Extensions map[string]any `json:"extensions,omitempty"`
}

type graphQLResponse[T any] struct {
	Data   T            `json:"data"`
	Errors []graphQLError `json:"errors,omitempty"`
}

func (c *Client) Do(ctx context.Context, query string, variables map[string]any, out any) error {
	reqBody, err := json.Marshal(graphQLRequest{
		Query:     query,
		Variables: variables,
	})
	if err != nil {
		return fmt.Errorf("marshal graphql request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiURL, bytes.NewReader(reqBody))
	if err != nil {
		return fmt.Errorf("create http request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("saleor request: %w", err)
	}
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read saleor response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("saleor non-2xx (%d): %s", resp.StatusCode, string(b))
	}

	var envelope graphQLResponse[json.RawMessage]
	if err := json.Unmarshal(b, &envelope); err != nil {
		return fmt.Errorf("decode saleor graphql envelope: %w", err)
	}
	if len(envelope.Errors) > 0 {
		// Keep it human-readable. Detailed mapping can be added later.
		return fmt.Errorf("saleor graphql error: %s", envelope.Errors[0].Message)
	}
	if err := json.Unmarshal(envelope.Data, out); err != nil {
		return fmt.Errorf("decode saleor graphql data: %w", err)
	}
	return nil
}

