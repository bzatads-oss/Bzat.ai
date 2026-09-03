const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
}

async function callOpenRouter(env, model, messages) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENROUTER_API_KEY_2}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://bzat.ai",
        "X-Title": "BZAT.ai",
      },
      body: JSON.stringify({
        model,
        messages,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message ||
      "OpenRouter request failed"
    );
  }

  return result;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (request.method === "GET") {
      return json({
        success: true,
        service: "BZAT.ai API",
        status: "online",
        features: [
          "writing",
          "prompt",
          "image"
        ],
      });
    }

    if (request.method !== "POST") {
      return json(
        {
          success: false,
          error: "Only POST requests are supported.",
        },
        405
      );
    }

    try {
      const body = await request.json();

      const type =
        body.type ||
        body.action ||
        "writing";

      const prompt =
        body.prompt ||
        body.topic ||
        body.text ||
        "";

      if (!prompt) {
        return json(
          {
            success: false,
            error: "Prompt or topic is required.",
          },
          400
        );
      }

      // =========================
      // AI WRITING
      // =========================

      if (
        type === "writing" ||
        type === "write" ||
        type === "content"
      ) {
        const result = await callOpenRouter(
          env,
          "google/gemini-2.5-flash",
          [
            {
              role: "system",
              content:
                "You are BZAT.ai, a professional AI content writer. Create original, useful, accurate, engaging and well-structured content. Follow the user's instructions exactly.",
            },
            {
              role: "user",
              content: prompt,
            },
          ]
        );

        return json({
          success: true,
          type: "writing",
          output:
            result?.choices?.[0]?.message?.content || "",
        });
      }

      // =========================
      // PROMPT GENERATION
      // =========================

      if (
        type === "prompt" ||
        type === "prompt-generation"
      ) {
        const result = await callOpenRouter(
          env,
          "google/gemini-2.5-flash",
          [
            {
              role: "system",
              content:
                "You are an expert AI prompt engineer. Turn the user's idea into a detailed, professional, production-ready prompt. Include subject, environment, composition, lighting, camera, style and important details when useful.",
            },
            {
              role: "user",
              content: prompt,
            },
          ]
        );

        return json({
          success: true,
          type: "prompt",
          output:
            result?.choices?.[0]?.message?.content || "",
        });
      }

      // =========================
      // IMAGE GENERATION
      // =========================

      if (
        type === "image" ||
        type === "image-generation" ||
        type === "generate-image"
      ) {
        const result = await callOpenRouter(
          env,
          "google/gemini-2.5-flash-image",
          [
            {
              role: "user",
              content: prompt,
            },
          ]
        );

        const content =
          result?.choices?.[0]?.message?.content;

        return json({
          success: true,
          type: "image",
          output: content || "",
        });
      }

      return json(
        {
          success: false,
          error:
            "Unknown type. Use writing, prompt, or image.",
        },
        400
      );

    } catch (error) {
      return json(
        {
          success: false,
          error:
            error?.message ||
            "Internal server error",
        },
        500
      );
    }
  },
};
