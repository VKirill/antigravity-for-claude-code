package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
)

// Simple JSON-RPC structures for Model Context Protocol
type JsonRpcRequest struct {
	Jsonrpc string      `json:"jsonrpc"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params"`
	ID      int         `json:"id"`
}

type CallToolParams struct {
	Name      string      `json:"name"`
	Arguments interface{} `json:"arguments"`
}

type InitializeParams struct {
	ClientInfo ClientInfo `json:"clientInfo"`
	ProtocolVersion string `json:"protocolVersion"`
}

type ClientInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

func main() {
	// 1. Launch the Node.js MCP server process via stdio
	cmd := exec.Command("node", "../../dist/index.js")
	
	stdin, err := cmd.StdinPipe()
	if err != nil {
		panic(err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		panic(err)
	}

	if err := cmd.Start(); err != nil {
		panic(err)
	}
	defer cmd.Process.Kill()

	reader := bufio.NewReader(stdout)

	// Helper to send a JSON-RPC message
	send := func(req JsonRpcRequest) {
		data, err := json.Marshal(req)
		if err != nil {
			panic(err)
		}
		stdin.Write(data)
		stdin.Write([]byte("\n"))
	}

	// Helper to read a JSON-RPC response
	readResponse := func() string {
		line, err := reader.ReadString('\n')
		if err != nil && err != io.EOF {
			panic(err)
		}
		return line
	}

	// 2. Initialize connection
	fmt.Println("Initializing connection to MCP server...")
	initReq := JsonRpcRequest{
		Jsonrpc: "2.0",
		Method:  "initialize",
		Params: InitializeParams{
			ClientInfo: ClientInfo{Name: "Go-Mcp-Example", Version: "1.0.0"},
			ProtocolVersion: "2024-11-05",
		},
		ID: 1,
	}
	send(initReq)
	fmt.Println("Server Init Response:", readResponse())

	// 3. Call get_programming_advice tool
	fmt.Println("\n--- Requesting Programming Advice ---")
	callReq := JsonRpcRequest{
		Jsonrpc: "2.0",
		Method:  "tools/call",
		Params: CallToolParams{
			Name: "get_programming_advice",
			Arguments: map[string]string{
				"question": "What is the complexity of binary search?",
				"language": "go",
			},
		},
		ID: 2,
	}
	send(callReq)
	
	// Wait and print response
	resp := readResponse()
	fmt.Println("Tool Call Response:\n", resp)
}
