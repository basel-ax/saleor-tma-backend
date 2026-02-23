package graph

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require
// here.

import "saleor-tma-backend/internal/app/tma"

type Resolver struct {
	TMA *tma.Service
}
