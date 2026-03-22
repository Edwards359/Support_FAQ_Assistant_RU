import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const maxInputChars = Math.min(
  32000,
  Math.max(256, Number(process.env.MAX_INPUT_CHARS || 2000))
);
const maxOutputTokens = Math.min(
  4096,
  Math.max(128, Number(process.env.MAX_OUTPUT_TOKENS || 512))
);

app.get("/config", (_req, res) => {
  res.json({ max_input_chars: maxInputChars, max_output_tokens: maxOutputTokens });
});

app.post("/chat/support", async (req, res) => {
  try {
    const userMessage = String(req.body?.message || "").trim();
    if (!userMessage) {
      return res.status(400).json({ error: "message is required" });
    }
    if (userMessage.length > maxInputChars) {
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
    const handoffRequired = outputText.includes("эскалац");

    return res.json({
      reply: outputText,
      handoff_required: handoffRequired
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "internal_error" });
  }
});

app.listen(port, () => {
  console.log(`Support FAQ Assistant RU — http://localhost:${port}`);
});
