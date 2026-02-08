.PHONY: build test run clean

build:
	go build -o bin/aesd ./cmd/aesd

test:
	go test ./...

run: build
	./bin/aesd

clean:
	rm -rf bin/
