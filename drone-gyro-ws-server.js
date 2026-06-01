/**
 * 无人机陀螺仪姿态模拟 WebSocket 广播服务
 * 纯 Node.js 内置模块，无 npm 依赖
 *
 * 启动: node drone-gyro-ws-server.js
 * 默认: ws://127.0.0.1:8765
 *
 * 二进制帧格式 (16 字节, little-endian):
 *   [0-3]   float32  pitch  俯仰角 (度)
 *   [4-7]   float32  roll   横滚角 (度)
 *   [8-11]  float32  yaw    偏航角 (度, 0~360)
 *   [12-15] uint32   timestamp  毫秒时间戳 (自 epoch)
 */

'use strict';

const http = require('http');
const crypto = require('crypto');

const HOST = process.env.WS_HOST || '127.0.0.1';
const PORT = Number(process.env.WS_PORT || 8765);
const FRAME_INTERVAL_MS = 16; // ~60 fps
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** @type {Set<import('net').Socket>} */
const clients = new Set();

// ── 姿态模拟状态 ──────────────────────────────────────────────
const sim = {
  pitch: 0,
  roll: 0,
  yaw: 0,
  startMs: Date.now(),
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function noise(amplitude) {
  return (Math.random() - 0.5) * 2 * amplitude;
}

/** 每帧更新模拟姿态：慢速正弦漂移 + 随机抖动 */
function tickAttitude() {
  const t = (Date.now() - sim.startMs) / 1000;

  // 缓慢变化的“真实”姿态（模拟悬停微调）
  const basePitch = 8 * Math.sin(t * 0.45) + 3 * Math.sin(t * 1.1);
  const baseRoll = 6 * Math.sin(t * 0.62 + 1.2) + 2 * Math.cos(t * 0.9);
  const baseYaw = ((t * 12) % 360 + 360) % 360; // 缓慢自转

  // 叠加陀螺仪高频抖动噪声
  sim.pitch = clamp(basePitch + noise(0.35), -30, 30);
  sim.roll = clamp(baseRoll + noise(0.28), -25, 25);
  sim.yaw = ((baseYaw + noise(0.4) + 360) % 360);
}

/** 打包为 16 字节二进制 payload */
function packGyroFrame() {
  const buf = Buffer.allocUnsafe(16);
  buf.writeFloatLE(sim.pitch, 0);
  buf.writeFloatLE(sim.roll, 4);
  buf.writeFloatLE(sim.yaw, 8);
  buf.writeUInt32LE(Date.now() >>> 0, 12);
  return buf;
}

// ── WebSocket 协议 (RFC 6455) ─────────────────────────────────
function acceptKey(secKey) {
  return crypto
    .createHash('sha1')
    .update(secKey + WS_MAGIC)
    .digest('base64');
}

/** 服务端 → 客户端 二进制帧 (无 mask) */
function encodeBinaryFrame(payload) {
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | 0x02; // FIN + binary opcode
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | 0x02;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | 0x02;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payload]);
}

function encodePongFrame(payload) {
  const len = payload.length;
  const header = Buffer.alloc(2);
  header[0] = 0x80 | 0x0a; // FIN + pong
  header[1] = len;
  return Buffer.concat([header, payload]);
}

function encodeCloseFrame(code = 1000, reason = '') {
  const body = Buffer.alloc(2 + Buffer.byteLength(reason));
  body.writeUInt16BE(code, 0);
  if (reason) body.write(reason, 2);
  const header = Buffer.alloc(2);
  header[0] = 0x80 | 0x08;
  header[1] = body.length;
  return Buffer.concat([header, body]);
}

/** 解析客户端发来的 WebSocket 帧（处理 ping / close） */
function attachClientParser(socket) {
  let buffer = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.length >= 2) {
      const b0 = buffer[0];
      const b1 = buffer[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let payloadLen = b1 & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (buffer.length < 4) return;
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buffer.length < 10) return;
        payloadLen = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }

      const maskLen = masked ? 4 : 0;
      const frameLen = offset + maskLen + payloadLen;
      if (buffer.length < frameLen) return;

      let payload = buffer.subarray(offset + maskLen, frameLen);
      if (masked) {
        const mask = buffer.subarray(offset, offset + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= mask[i % 4];
        }
      }

      buffer = buffer.subarray(frameLen);

      if (opcode === 0x08) {
        // close
        try {
          socket.write(encodeCloseFrame());
        } catch (_) { /* ignore */ }
        socket.destroy();
        return;
      }

      if (opcode === 0x09) {
        // ping → pong
        try {
          socket.write(encodePongFrame(payload));
        } catch (_) { /* ignore */ }
      }

      // text/binary/op continuation: 广播服务不处理客户端数据，忽略即可
    }
  });
}

function handleUpgrade(req, socket, head) {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = acceptKey(key);
  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '',
    '',
  ].join('\r\n');

  socket.write(headers);
  if (head && head.length) socket.write(head);

  clients.add(socket);
  attachClientParser(socket);

  const addr = `${req.socket.remoteAddress}:${req.socket.remoteAddressPort ?? '?'}`;
  console.log(`[+] 客户端连接  当前在线: ${clients.size}  (${addr})`);

  socket.on('close', () => {
    clients.delete(socket);
    console.log(`[-] 客户端断开  当前在线: ${clients.size}`);
  });

  socket.on('error', () => {
    clients.delete(socket);
  });
}

// ── HTTP + WebSocket 升级 ───────────────────────────────────────
const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(
    `Drone Gyro WebSocket Server\n` +
    `Connect: ws://${HOST}:${PORT}\n` +
    `Frame: 16 bytes binary @ ${FRAME_INTERVAL_MS}ms (~60fps)\n` +
    `Fields: float32 pitch, roll, yaw (deg) + uint32 timestamp\n`
  );
});

server.on('upgrade', handleUpgrade);

// ── 60fps 广播循环 ────────────────────────────────────────────
let frameSeq = 0;
let broadcastTimer = null;

function broadcastGyroFrame() {
  if (clients.size === 0) return;

  tickAttitude();
  const payload = packGyroFrame();
  const frame = encodeBinaryFrame(payload);
  frameSeq++;

  for (const client of clients) {
    if (client.destroyed || !client.writable) {
      clients.delete(client);
      continue;
    }
    try {
      client.write(frame);
    } catch (_) {
      clients.delete(client);
    }
  }

  if (frameSeq % 60 === 0) {
    console.log(
      `[~] #${frameSeq}  pitch=${sim.pitch.toFixed(2)}°  ` +
      `roll=${sim.roll.toFixed(2)}°  yaw=${sim.yaw.toFixed(2)}°  ` +
      `clients=${clients.size}`
    );
  }
}

function startBroadcast() {
  if (broadcastTimer) return;

  // 使用 setInterval 16ms；Node 在 Windows 上实际精度约 15~16ms
  broadcastTimer = setInterval(broadcastGyroFrame, FRAME_INTERVAL_MS);
  console.log(`[*] 广播已启动  间隔 ${FRAME_INTERVAL_MS}ms (~${Math.round(1000 / FRAME_INTERVAL_MS)} fps)`);
}

function stopBroadcast() {
  if (broadcastTimer) {
    clearInterval(broadcastTimer);
    broadcastTimer = null;
  }
}

function shutdown() {
  console.log('\n[!] 正在关闭服务…');
  stopBroadcast();
  for (const client of clients) {
    try {
      client.write(encodeCloseFrame(1001, 'server shutdown'));
      client.destroy();
    } catch (_) { /* ignore */ }
  }
  clients.clear();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, HOST, () => {
  console.log('═══════════════════════════════════════════════');
  console.log('  无人机陀螺仪姿态 WebSocket 模拟广播');
  console.log(`  ws://${HOST}:${PORT}`);
  console.log('  二进制帧: 16B = pitch(f32) roll(f32) yaw(f32) ts(u32)');
  console.log('═══════════════════════════════════════════════');
  startBroadcast();
});
