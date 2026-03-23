import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, appendFile } from "node:fs/promises";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { KNOWLEDGE_BASE } from "./knowledgeBase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });
if (!process.env.OPENAI_API_KEY) {
  dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
}

const app = express();
const port = Number(process.env.PORT || 8080);

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const jwtSecret = String(process.env.JWT_SECRET || "");
const requireAuth = String(process.env.REQUIRE_AUTH || "false").toLowerCase() === "true";
const ticketsPath = path.join(__dirname, "data", "tickets.jsonl");

const maxInputChars = Math.min(
  32000,
  Math.max(256, Number(process.env.MAX_INPUT_CHARS || 2000))
);
const maxOutputTokens = Math.min(
  4096,
  Math.max(128, Number(process.env.MAX_OUTPUT_TOKENS || 512))
);
const metrics = {
  started_at: new Date().toISOString(),
  total_requests: 0,
  success_requests: 0,
  error_requests: 0,
  handoff_requests: 0,
  total_input_chars: 0,
  total_reply_chars: 0,
  total_latency_ms: 0
};

function toBase64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64");
}

function parseJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(decodeBase64Url(headerB64).toString("utf8"));
    payload = JSON.parse(decodeBase64Url(payloadB64).toString("utf8"));
  } catch {
    return null;
  }
  if (header?.alg !== "HS256" || header?.typ !== "JWT") return null;
  const data = `${headerB64}.${payloadB64}`;
  const expectedSig = toBase64Url(createHmac("sha256", jwtSecret).update(data).digest());
  const got = Buffer.from(signatureB64);
  const expected = Buffer.from(expectedSig);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  if (typeof payload.exp === "number" && Date.now() >= payload.exp * 1000) return null;
  return payload;
}

async function createHandoffTicket({ sessionId, message, reply }) {
  const ticket = {
    ticket_id: `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    session_id: sessionId || "anonymous",
    channel: "website",
    status: "open",
    summary: (message || "").slice(0, 240),
    assistant_reply: (reply || "").slice(0, 2000)
  };
  await mkdir(path.dirname(ticketsPath), { recursive: true });
  await appendFile(ticketsPath, `${JSON.stringify(ticket)}\n`, "utf8");
  return ticket;
}

function authMiddleware(req, res, next) {
  if (!requireAuth) return next();
  if (!jwtSecret) {
    return res.status(500).json({ error: "auth_misconfigured" });
  }
  const auth = String(req.headers.authorization || "");
  const [, token] = auth.match(/^Bearer\s+(.+)$/i) || [];
  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const payload = parseJwt(token);
  if (!payload) {
    return res.status(401).json({ error: "invalid_token" });
  }
  req.auth = payload;
  return next();
}

app.get("/config", (_req, res) => {
  res.json({
    max_input_chars: maxInputChars,
    max_output_tokens: maxOutputTokens,
    require_auth: requireAuth
  });
});

app.get("/metrics", (_req, res) => {
  const avgLatencyMs =
    metrics.success_requests > 0 ? Math.round(metrics.total_latency_ms / metrics.success_requests) : 0;
  const avgInputChars =
    metrics.success_requests > 0 ? Math.round(metrics.total_input_chars / metrics.success_requests) : 0;
  const avgReplyChars =
    metrics.success_requests > 0 ? Math.round(metrics.total_reply_chars / metrics.success_requests) : 0;
  const handoffRate =
    metrics.success_requests > 0
      ? Number((metrics.handoff_requests / metrics.success_requests).toFixed(4))
      : 0;
  res.json({
    ...metrics,
    avg_latency_ms: avgLatencyMs,
    avg_input_chars: avgInputChars,
    avg_reply_chars: avgReplyChars,
    handoff_rate: handoffRate
  });
});

app.post("/chat/support", authMiddleware, async (req, res) => {
  const startedAt = Date.now();
  try {
    metrics.total_requests += 1;
    const userMessage = String(req.body?.message || "").trim();
    const sessionId = String(req.body?.session_id || req.auth?.sub || "anonymous");
    if (!userMessage) {
      metrics.error_requests += 1;
      return res.status(400).json({ error: "message is required" });
    }
    if (userMessage.length > maxInputChars) {
      metrics.error_requests += 1;
      return res.status(400).json({
        error: "message_too_long",
        max_input_chars: maxInputChars
      });
    }

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      max_output_tokens: maxOutputTokens,
      input: [
        {
          role: "system",
          content: [
            { type: "input_text", text: SYSTEM_PROMPT },
            { type: "input_text", text: `База знаний:\n${KNOWLEDGE_BASE}` }
          ]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userMessage }]
        }
      ]
    });

    const outputText = response.output_text?.trim() || "Не удалось сформировать ответ.";
    const handoffRequired = /(эскалац|передам|специалисту поддержки|оператору)/i.test(outputText);
    let ticket = null;
    if (handoffRequired) {
      ticket = await createHandoffTicket({
        sessionId,
        message: userMessage,
        reply: outputText
      });
      metrics.handoff_requests += 1;
    }
    metrics.success_requests += 1;
    metrics.total_input_chars += userMessage.length;
    metrics.total_reply_chars += outputText.length;
    metrics.total_latency_ms += Date.now() - startedAt;

    return res.json({
      reply: outputText,
      handoff_required: handoffRequired,
      ticket_id: ticket?.ticket_id || null
    });
  } catch (error) {
    metrics.error_requests += 1;
    console.error(error);
    return res.status(500).json({ error: "internal_error" });
  }
});

app.listen(port, () => {
  console.log(`Support FAQ Assistant RU — http://localhost:${port}`);
});
