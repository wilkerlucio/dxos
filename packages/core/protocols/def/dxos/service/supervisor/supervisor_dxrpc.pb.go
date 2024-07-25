// Code generated by protoc-gen-go-dxrpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-dxrpc v0.0.1
// - protoc              v4.24.4
// source: dxos/service/supervisor.proto

package supervisor

import (
	context "context"
	errors "errors"
	dxrpc "github.com/dxos/dxos/dxrpc"
	proto "google.golang.org/protobuf/proto"
	emptypb "google.golang.org/protobuf/types/known/emptypb"
)

// This is a compile-time assertion to ensure that this generated file
// is compatible with the dxrpc package it is being compiled against.
const _ = dxrpc.SupportPackageIsVersion1

// SupervisorClient is the client API for Supervisor service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://pkg.go.dev/google.golang.org/grpc/?tab=doc#ClientConn.NewStream.
type SupervisorClient interface {
	// Authenticate with KUBE.
	Authenticate(ctx context.Context, in *Authentication, opts ...dxrpc.CallOption) (*AuthenticateResponse, error)
	// Init authentication sequence. Used to obtain nonce & KUBE identity (public key).
	InitAuthSequence(ctx context.Context, in *emptypb.Empty, opts ...dxrpc.CallOption) (*InitAuthSequenceResponse, error)
	// Read KUBE config.
	GetConfig(ctx context.Context, in *emptypb.Empty, opts ...dxrpc.CallOption) (*GetConfigResponse, error)
	// Set KUBE config.
	SetConfig(ctx context.Context, in *SetConfigRequest, opts ...dxrpc.CallOption) (*SetConfigResponse, error)
	// Obtain KUBE status & list running services.
	Status(ctx context.Context, in *emptypb.Empty, opts ...dxrpc.CallOption) (*Services, error)
}

type supervisorClient struct {
	cc dxrpc.ClientConnInterface
}

func NewSupervisorClient(cc dxrpc.ClientConnInterface) SupervisorClient {
	return &supervisorClient{cc}
}

func (c *supervisorClient) Authenticate(ctx context.Context, in *Authentication, opts ...dxrpc.CallOption) (*AuthenticateResponse, error) {
	out := new(AuthenticateResponse)
	err := c.cc.Invoke(ctx, "dxos.service.supervisor.Supervisor.Authenticate", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *supervisorClient) InitAuthSequence(ctx context.Context, in *emptypb.Empty, opts ...dxrpc.CallOption) (*InitAuthSequenceResponse, error) {
	out := new(InitAuthSequenceResponse)
	err := c.cc.Invoke(ctx, "dxos.service.supervisor.Supervisor.InitAuthSequence", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *supervisorClient) GetConfig(ctx context.Context, in *emptypb.Empty, opts ...dxrpc.CallOption) (*GetConfigResponse, error) {
	out := new(GetConfigResponse)
	err := c.cc.Invoke(ctx, "dxos.service.supervisor.Supervisor.GetConfig", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *supervisorClient) SetConfig(ctx context.Context, in *SetConfigRequest, opts ...dxrpc.CallOption) (*SetConfigResponse, error) {
	out := new(SetConfigResponse)
	err := c.cc.Invoke(ctx, "dxos.service.supervisor.Supervisor.SetConfig", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *supervisorClient) Status(ctx context.Context, in *emptypb.Empty, opts ...dxrpc.CallOption) (*Services, error) {
	out := new(Services)
	err := c.cc.Invoke(ctx, "dxos.service.supervisor.Supervisor.Status", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// SupervisorServer is the server API for Supervisor service.
// All implementations must embed UnimplementedSupervisorServer
// for forward compatibility
type SupervisorServer interface {
	// Authenticate with KUBE.
	Authenticate(context.Context, *Authentication) (*AuthenticateResponse, error)
	// Init authentication sequence. Used to obtain nonce & KUBE identity (public key).
	InitAuthSequence(context.Context, *emptypb.Empty) (*InitAuthSequenceResponse, error)
	// Read KUBE config.
	GetConfig(context.Context, *emptypb.Empty) (*GetConfigResponse, error)
	// Set KUBE config.
	SetConfig(context.Context, *SetConfigRequest) (*SetConfigResponse, error)
	// Obtain KUBE status & list running services.
	Status(context.Context, *emptypb.Empty) (*Services, error)
	mustEmbedUnimplementedSupervisorServer()
}

// UnimplementedSupervisorServer must be embedded to have forward compatible implementations.
type UnimplementedSupervisorServer struct {
}

func (UnimplementedSupervisorServer) Authenticate(context.Context, *Authentication) (*AuthenticateResponse, error) {
	return nil, errors.New("method Authenticate not implemented")
}
func (UnimplementedSupervisorServer) InitAuthSequence(context.Context, *emptypb.Empty) (*InitAuthSequenceResponse, error) {
	return nil, errors.New("method InitAuthSequence not implemented")
}
func (UnimplementedSupervisorServer) GetConfig(context.Context, *emptypb.Empty) (*GetConfigResponse, error) {
	return nil, errors.New("method GetConfig not implemented")
}
func (UnimplementedSupervisorServer) SetConfig(context.Context, *SetConfigRequest) (*SetConfigResponse, error) {
	return nil, errors.New("method SetConfig not implemented")
}
func (UnimplementedSupervisorServer) Status(context.Context, *emptypb.Empty) (*Services, error) {
	return nil, errors.New("method Status not implemented")
}
func (UnimplementedSupervisorServer) mustEmbedUnimplementedSupervisorServer() {}

// UnsafeSupervisorServer may be embedded to opt out of forward compatibility for this service.
// Use of this interface is not recommended, as added methods to SupervisorServer will
// result in compilation errors.
type UnsafeSupervisorServer interface {
	mustEmbedUnimplementedSupervisorServer()
}

func RegisterSupervisorServer(s dxrpc.ServiceRegistrar, srv SupervisorServer) {
	s.RegisterService(&Supervisor_ServiceDesc, srv)
}

func _Supervisor_Authenticate_Handler(srv interface{}, ctx context.Context, dec func(proto.Message) error) (proto.Message, error) {
	in := new(Authentication)
	if err := dec(in); err != nil {
		return nil, err
	}
	return srv.(SupervisorServer).Authenticate(ctx, in)
}

func _Supervisor_InitAuthSequence_Handler(srv interface{}, ctx context.Context, dec func(proto.Message) error) (proto.Message, error) {
	in := new(emptypb.Empty)
	if err := dec(in); err != nil {
		return nil, err
	}
	return srv.(SupervisorServer).InitAuthSequence(ctx, in)
}

func _Supervisor_GetConfig_Handler(srv interface{}, ctx context.Context, dec func(proto.Message) error) (proto.Message, error) {
	in := new(emptypb.Empty)
	if err := dec(in); err != nil {
		return nil, err
	}
	return srv.(SupervisorServer).GetConfig(ctx, in)
}

func _Supervisor_SetConfig_Handler(srv interface{}, ctx context.Context, dec func(proto.Message) error) (proto.Message, error) {
	in := new(SetConfigRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	return srv.(SupervisorServer).SetConfig(ctx, in)
}

func _Supervisor_Status_Handler(srv interface{}, ctx context.Context, dec func(proto.Message) error) (proto.Message, error) {
	in := new(emptypb.Empty)
	if err := dec(in); err != nil {
		return nil, err
	}
	return srv.(SupervisorServer).Status(ctx, in)
}

// Supervisor_ServiceDesc is the dxrpc.ServiceDesc for Supervisor service.
// It's only intended for direct use with dxrpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var Supervisor_ServiceDesc = dxrpc.ServiceDesc{
	ServiceName: "dxos.service.supervisor.Supervisor",
	HandlerType: (*SupervisorServer)(nil),
	Methods: []dxrpc.MethodDesc{
		{
			MethodName: "Authenticate",
			Handler:    _Supervisor_Authenticate_Handler,
		},
		{
			MethodName: "InitAuthSequence",
			Handler:    _Supervisor_InitAuthSequence_Handler,
		},
		{
			MethodName: "GetConfig",
			Handler:    _Supervisor_GetConfig_Handler,
		},
		{
			MethodName: "SetConfig",
			Handler:    _Supervisor_SetConfig_Handler,
		},
		{
			MethodName: "Status",
			Handler:    _Supervisor_Status_Handler,
		},
	},
	Streams:  []dxrpc.StreamDesc{},
	Metadata: "dxos/service/supervisor.proto",
}