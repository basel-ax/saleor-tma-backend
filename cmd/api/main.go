package main

import (
	"log"
	"net/http"
	"time"

	"saleor-tma-backend/graph"
	"saleor-tma-backend/internal/app/tma"
	"saleor-tma-backend/internal/config"
	"saleor-tma-backend/internal/saleor"
	httptransport "saleor-tma-backend/internal/transport/http"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/lru"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/vektah/gqlparser/v2/ast"
)

const defaultPort = "8080"

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	port := cfg.HTTP.Port
	if port == "" {
		port = defaultPort
	}

	saleorClient := saleor.NewClient(cfg.Saleor.APIURL, cfg.Saleor.Token)
	tmaService := tma.NewService(
		saleorClient,
		cfg.Saleor.ChannelID,
		cfg.Saleor.ChannelSlug,
		cfg.TMA.RestaurantRootCategoryID,
	)

	gqlSrv := handler.New(graph.NewExecutableSchema(graph.Config{
		Resolvers: &graph.Resolver{
			TMA: tmaService,
		},
	}))

	gqlSrv.AddTransport(transport.Options{})
	gqlSrv.AddTransport(transport.GET{})
	gqlSrv.AddTransport(transport.POST{})

	gqlSrv.SetQueryCache(lru.New[*ast.QueryDocument](1000))

	gqlSrv.Use(extension.Introspection{})
	gqlSrv.Use(extension.AutomaticPersistedQuery{
		Cache: lru.New[string](100),
	})

	mux := http.NewServeMux()
	mux.Handle("/", playground.Handler("GraphQL playground", "/query"))
	mux.Handle("/query", gqlSrv)

	authMw := httptransport.TelegramAuthMiddleware{
		BotToken: cfg.Telegram.BotToken,
		MaxAge:   10 * time.Minute,
	}

	log.Printf("connect to http://localhost:%s/ for GraphQL playground", port)
	log.Fatal(http.ListenAndServe(":"+port, authMw.Wrap(mux)))
}
