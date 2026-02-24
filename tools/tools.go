//go:build tools

package tools

import (
	// github.com/99designs/gqlgen is a main package (program).
	// Importing it here is the canonical Go "tools" pattern:
	// https://github.com/golang/go/wiki/Modules#how-can-i-track-tool-dependencies-for-a-module
	//
	// `go mod tidy` processes this import to populate go.sum with all entries
	// needed by `go run github.com/99designs/gqlgen generate` (including
	// transitive deps such as github.com/urfave/cli/v3).
	//
	// The gopls "not an importable package" diagnostic is a known false positive
	// for this pattern and can be safely ignored.
	_ "github.com/99designs/gqlgen"
	_ "github.com/99designs/gqlgen/codegen/config"
	_ "golang.org/x/text/cases"
	_ "golang.org/x/tools/go/packages"
	_ "golang.org/x/tools/imports"
)
