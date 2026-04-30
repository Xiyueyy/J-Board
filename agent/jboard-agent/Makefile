BINARY := jboard-agent
VERSION := 3.0.5
LDFLAGS := -s -w

.PHONY: build build-linux clean

build:
	go build -ldflags "$(LDFLAGS)" -o $(BINARY) ./cmd/agent

build-linux:
	mkdir -p dist
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags "$(LDFLAGS)" -o dist/$(BINARY)-linux-amd64 ./cmd/agent
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -ldflags "$(LDFLAGS)" -o dist/$(BINARY)-linux-arm64 ./cmd/agent
	(cd dist && sha256sum $(BINARY)-linux-amd64 $(BINARY)-linux-arm64 > SHA256SUMS)

clean:
	rm -f $(BINARY) $(BINARY)-linux-amd64 $(BINARY)-linux-arm64 dist/$(BINARY)-linux-amd64 dist/$(BINARY)-linux-arm64 dist/SHA256SUMS
