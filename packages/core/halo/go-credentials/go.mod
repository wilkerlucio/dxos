module github.com/dxos/dxos/util/credentials

go 1.21.0

toolchain go1.21.7

require (
	github.com/dxos/dxos/proto v0.0.0-00010101000000-000000000000
	github.com/dxos/dxos/utils/keys v0.0.0-00010101000000-000000000000
	google.golang.org/protobuf v1.34.2
)

require (
	github.com/dxos/dxos/dxrpc v0.0.0-00010101000000-000000000000 // indirect
	github.com/gorilla/websocket v1.5.3 // indirect
	go.uber.org/multierr v1.11.0 // indirect
	go.uber.org/zap v1.26.0 // indirect
)

replace github.com/dxos/dxos/proto => ../../protocols

replace github.com/dxos/dxos/dxrpc => ../../mesh/go-rpc

replace github.com/dxos/dxos/utils/keys => ../../../common/go-keys
