import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class AiSentiment extends BaseEndpoint {
  schema = {
    tags: ["AI"],
    summary: "(paid) Analyze sentiment of text",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text"],
            properties: {
              text: {
                type: "string" as const,
                description: "Text to analyze",
              },
              detailed: {
                type: "boolean" as const,
                default: false,
                description: "Include detailed emotion breakdown",
              },
            },
          },
        },
      },
    },
    parameters: [
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, enum: ["STX", "sBTC", "USDCx"] as const, default: "STX" },
      },
    ],
    responses: {
      "200": {
        description: "Sentiment analysis result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                sentiment: { type: "string" as const, enum: ["positive", "negative", "neutral", "mixed"] },
                confidence: { type: "number" as const },
                score: { type: "number" as const, description: "-1 (negative) to 1 (positive)" },
                emotions: { type: "object" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
      "500": { description: "AI processing error" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { text?: string; detailed?: boolean };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text, detailed = false } = body;

    if (typeof text !== "string" || text.trim().length === 0) {
      return this.errorResponse(c, "text field is required and must be a non-empty string", 400);
    }

    if (text.length > 5000) {
      return this.errorResponse(c, "text must be 5000 characters or less", 400);
    }

    try {
      const ai = c.env.AI;
      if (!ai) {
        return this.errorResponse(c, "AI service not configured", 500);
      }

      const prompt = detailed
        ? `Analyze the sentiment of the following text. Respond ONLY with a JSON object containing:
- "sentiment": one of "positive", "negative", "neutral", or "mixed"
- "confidence": a number from 0 to 1 indicating confidence
- "score": a number from -1 (very negative) to 1 (very positive)
- "emotions": an object with emotion names as keys and intensity (0-1) as values (e.g., {"joy": 0.8, "anger": 0.1})
- "reasoning": a brief explanation of the sentiment

Text to analyze:
"""
${text}
"""`
        : `Analyze the sentiment of the following text. Respond ONLY with a JSON object containing:
- "sentiment": one of "positive", "negative", "neutral", or "mixed"
- "confidence": a number from 0 to 1 indicating confidence
- "score": a number from -1 (very negative) to 1 (very positive)

Text to analyze:
"""
${text}
"""`;

      const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          {
            role: "system",
            content: "You are a sentiment analysis assistant. You only respond with valid JSON objects. Never include markdown formatting or code blocks.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
      });

      // Extract text content from response
      let responseText = "";
      if (typeof response === "object" && response !== null && "response" in response) {
        responseText = String((response as { response: string }).response);
      } else if (typeof response === "string") {
        responseText = response;
      } else {
        return this.errorResponse(c, "Unexpected AI response format", 500);
      }

      // Clean up response - remove markdown code blocks if present
      responseText = responseText.trim();
      if (responseText.startsWith("```json")) {
        responseText = responseText.slice(7);
      } else if (responseText.startsWith("```")) {
        responseText = responseText.slice(3);
      }
      if (responseText.endsWith("```")) {
        responseText = responseText.slice(0, -3);
      }
      responseText = responseText.trim();

      // Parse JSON response
      let analysis: {
        sentiment: string;
        confidence: number;
        score: number;
        emotions?: Record<string, number>;
        reasoning?: string;
      };

      try {
        analysis = JSON.parse(responseText);
      } catch {
        // If parsing fails, try to extract from the text
        return this.errorResponse(c, "Failed to parse AI response as JSON", 500);
      }

      // Validate and normalize response
      const validSentiments = ["positive", "negative", "neutral", "mixed"];
      if (!validSentiments.includes(analysis.sentiment)) {
        analysis.sentiment = "neutral";
      }

      analysis.confidence = Math.max(0, Math.min(1, Number(analysis.confidence) || 0.5));
      analysis.score = Math.max(-1, Math.min(1, Number(analysis.score) || 0));

      const result: Record<string, unknown> = {
        sentiment: analysis.sentiment,
        confidence: analysis.confidence,
        score: analysis.score,
        tokenType,
      };

      if (detailed) {
        result.emotions = analysis.emotions || {};
        result.reasoning = analysis.reasoning || null;
      }

      return c.json(result);
    } catch (error) {
      return this.errorResponse(c, `Sentiment analysis failed: ${String(error)}`, 500);
    }
  }
}
