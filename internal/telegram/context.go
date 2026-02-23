package telegram

import "context"

type ctxKey struct{}

func WithAuth(ctx context.Context, a AuthResult) context.Context {
	return context.WithValue(ctx, ctxKey{}, a)
}

func FromContext(ctx context.Context) (AuthResult, bool) {
	v := ctx.Value(ctxKey{})
	if v == nil {
		return AuthResult{}, false
	}
	a, ok := v.(AuthResult)
	return a, ok
}

