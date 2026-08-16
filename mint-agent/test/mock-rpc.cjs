// Minimal JSON-RPC mock server — just enough surface for ethers.js
// JsonRpcProvider to drive a dry-run mint through mintRunner.js without
// needing a real chain or a compiled contract. Not a general-purpose
// chain simulator.
const http = require("node:http");

let blockNumber = 100;
const nonces = {};

function hex(n) {
  return "0x" + BigInt(n).toString(16);
}

function handle(method, params) {
  switch (method) {
    case "eth_chainId":
      return hex(31337);
    case "eth_blockNumber":
      return hex(blockNumber++);
    case "eth_getBlockByNumber":
      return {
        number: hex(blockNumber),
        hash: "0x" + "11".repeat(32),
        parentHash: "0x" + "00".repeat(32),
        nonce: "0x0000000000000000",
        mixHash: "0x" + "00".repeat(32),
        sha3Uncles: "0x" + "00".repeat(32),
        logsBloom: "0x" + "00".repeat(256),
        transactionsRoot: "0x" + "00".repeat(32),
        stateRoot: "0x" + "00".repeat(32),
        receiptsRoot: "0x" + "00".repeat(32),
        miner: "0x" + "00".repeat(20),
        extraData: "0x",
        size: hex(1000),
        totalDifficulty: hex(0),
        difficulty: hex(0),
        timestamp: hex(Math.floor(Date.now() / 1000)),
        baseFeePerGas: hex(1_000_000_000), // 1 gwei
        gasLimit: hex(30_000_000),
        gasUsed: hex(1_000_000),
        transactions: [],
      };
    case "eth_gasPrice":
      return hex(2_000_000_000); // 2 gwei
    case "eth_maxPriorityFeePerGas":
      return hex(1_000_000_000); // 1 gwei
    case "eth_getTransactionCount": {
      const addr = params[0].toLowerCase();
      nonces[addr] = nonces[addr] ?? 0;
      return hex(nonces[addr]);
    }
    case "eth_getBalance":
      return hex(10n ** 20n); // plenty of test ETH
    case "eth_estimateGas":
      return hex(120_000);
    case "eth_call":
      return "0x"; // simulate success — mint() call doesn't revert
    case "eth_sendRawTransaction": {
      // Tx hash is defined as keccak256 of the raw signed transaction bytes —
      // ethers verifies the node echoes this back correctly, so we must
      // compute the real thing rather than return a random hash.
      const { keccak256 } = require("ethers");
      return keccak256(params[0]);
    }
    case "eth_getTransactionReceipt": {
      return {
        transactionHash: params[0],
        transactionIndex: hex(0),
        blockHash: "0x" + "22".repeat(32),
        blockNumber: hex(blockNumber),
        from: "0x" + "33".repeat(20),
        to: "0x" + "44".repeat(20),
        cumulativeGasUsed: hex(120_000),
        gasUsed: hex(120_000),
        effectiveGasPrice: hex(2_000_000_000),
        contractAddress: null,
        logs: [],
        logsBloom: "0x" + "00".repeat(256),
        status: "0x1",
        type: "0x2",
      };
    }
    case "net_version":
      return "31337";
    default:
      throw new Error(`mock-rpc: unhandled method ${method}`);
  }
}

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end("bad json");
      return;
    }
    const items = Array.isArray(payload) ? payload : [payload];
    const responses = items.map((item) => {
      try {
        const result = handle(item.method, item.params ?? []);
        return { jsonrpc: "2.0", id: item.id, result };
      } catch (err) {
        return { jsonrpc: "2.0", id: item.id, error: { code: -32000, message: err.message } };
      }
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(Array.isArray(payload) ? responses : responses[0]));
  });
});

const PORT = 8555;
server.listen(PORT, () => {
  console.log(`mock-rpc listening on http://127.0.0.1:${PORT}`);
});
