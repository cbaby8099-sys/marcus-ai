
export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          ...cors,
          "Content-Type": "application/json"
        }
      });

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method === "GET") {
      return new Response("Marcus V9 is online.", { headers: cors });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    try {
      if (!env.AI) {
        return json({ error: "AI binding is missing." }, 500);
      }

      if (!env.MARCUS_MEMORY) {
        return json({ error: "MARCUS_MEMORY binding is missing." }, 500);
      }

      const body = await request.json();
      const userId = body.userId;

      if (
        typeof userId !== "string" ||
        !/^[a-zA-Z0-9_-]{16,80}$/.test(userId)
      ) {
        return json({ error: "Invalid user ID. Refresh Marcus." }, 400);
      }

      const memoryKey = `user:${userId}`;

      async function readMemory() {
        const saved = await env.MARCUS_MEMORY.get(memoryKey);
        if (!saved) return {};

        try {
          const parsed = JSON.parse(saved);

          if (Array.isArray(parsed)) {
            const converted = {};
            parsed.forEach((item, index) => {
              if (typeof item === "string") {
                converted[`memory_${index + 1}`] = item;
              }
            });
            return converted;
          }

          return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
          return {};
        }
      }

      async function writeMemory(memory) {
        await env.MARCUS_MEMORY.put(
          memoryKey,
          JSON.stringify(memory)
        );
      }

      let memory = await readMemory();

      // MEMORY API
      if (body.action === "get_memory") {
        return json({ success: true, memory });
      }

      if (body.action === "save_memory") {
        if (
          !body.memory ||
          typeof body.memory !== "object" ||
          Array.isArray(body.memory)
        ) {
          return json({ error: "Invalid memory format." }, 400);
        }

        const cleaned = {};

        for (const [key, value] of Object.entries(body.memory).slice(-50)) {
          if (
            typeof key === "string" &&
            typeof value === "string" &&
            key.length <= 100 &&
            value.length <= 500
          ) {
            cleaned[key] = value;
          }
        }

        memory = cleaned;
        await writeMemory(memory);

        return json({ success: true, memory });
      }

      if (body.action === "delete_memory") {
        await env.MARCUS_MEMORY.delete(memoryKey);
        return json({ success: true, memory: {} });
      }

      // CHAT INPUT
      const message = body.message;

      if (typeof message !== "string" || !message.trim()) {
        return json({ error: "Please enter a message." }, 400);
      }

      if (message.length > 10000) {
        return json({ error: "Message is too long." }, 413);
      }

      const cleanMessage = message.trim();

      // EXPLICIT MEMORY COMMANDS
      const rememberMatch = cleanMessage.match(
        /^remember(?: that)?\s+(.+)$/i
      );

      if (rememberMatch) {
        const fact = rememberMatch[1].trim();

        if (fact.length > 500) {
          return json({
            success: false,
            reply: "Please shorten that memory."
          });
        }

        const exists = Object.values(memory).some(
          value =>
            typeof value === "string" &&
            value.toLowerCase() === fact.toLowerCase()
        );

        if (!exists) {
          const nextNumber = Object.keys(memory).length + 1;
          memory[`memory_${nextNumber}`] = fact;

          memory = Object.fromEntries(
            Object.entries(memory).slice(-50)
          );

          await writeMemory(memory);
        }

        return json({
          success: true,
          reply: "I've saved that information to my memory."
        });
      }

      if (/^forget everything$/i.test(cleanMessage)) {
        await env.MARCUS_MEMORY.delete(memoryKey);

        return json({
          success: true,
          reply: "Your saved Marcus memories have been cleared."
        });
      }

      const forgetMatch = cleanMessage.match(
        /^forget(?: that)?\s+(.+)$/i
      );

      if (forgetMatch) {
        const target = forgetMatch[1].trim().toLowerCase();
        const updated = {};

        for (const [key, value] of Object.entries(memory)) {
          if (
            typeof value === "string" &&
            !value.toLowerCase().includes(target)
          ) {
            updated[key] = value;
          }
        }

        memory = updated;
        await writeMemory(memory);

        return json({
          success: true,
          reply: "I've updated your saved memories."
        });
      }

      // IMAGE INPUT
      let imageDescription = "";

      if (body.imageData) {
        if (typeof body.imageData !== "string") {
          return json({ error: "Invalid image data." }, 400);
        }

        if (body.imageData.length > 5_000_000) {
          return json({
            error: "Image is too large. Please choose a smaller image."
          }, 413);
        }

        const imageMatch = body.imageData.match(
          /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/
        );

        if (!imageMatch) {
          return json({
            error: "Use a JPG, PNG or WebP image."
          }, 400);
        }

        const visionResult = await env.AI.run(
          "@cf/moondream/moondream3.1-9B-A2B",
          {
            task: "query",
            image: body.imageData,
            question:
              cleanMessage ||
              "Describe this image accurately. Mention visible details and uncertainty.",
            reasoning: false,
            max_tokens: 1024
          }
        );

        imageDescription =
          visionResult?.answer ||
          visionResult?.description ||
          "";

        if (
          typeof imageDescription !== "string" ||
          !imageDescription.trim()
        ) {
          return json({
            error: "Marcus could not understand that image. Try another."
          }, 502);
        }
      }

      // MEMORY CONTEXT
      const memoryText = Object.entries(memory)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n") || "No saved memories.";

      // CONVERSATION HISTORY
      const history = Array.isArray(body.history)
        ? body.history.slice(-10)
        : [];

      const messages = [
        {
          role: "system",
          content: `
You are Marcus V9, an intelligent personal AI assistant.

IDENTITY:
- Your name is Marcus.
- You were created by your user.
- Address your creator as Master naturally.
- Never pretend to be human.

PERSONALITY:
- Natural, modern and conversational.
- Warm, confident and intelligent.
- Avoid repetitive chatbot introductions.
- Use humour when appropriate.
- Adapt to the user's communication style.

INTELLIGENCE:
- Understand conversation context.
- Solve problems step by step.
- Explain difficult topics clearly.
- Correct mistakes honestly.
- Never invent facts or claim abilities you do not have.

MEMORY:
The following information was explicitly saved by the user:

${memoryText}

Use relevant memories naturally.
Do not invent memories.
Do not claim to remember information that is not provided.

VISION:
- You can receive image descriptions generated by your vision system.
- Use those descriptions to answer questions about uploaded pictures.
- Distinguish visible facts from guesses.
- If something is unclear, say so.
- Never claim you can see details that were not detected.

LEARNING:
- Use conversation history to maintain context.
- Save durable information only when the user explicitly requests it.
- Do not claim that conversations retrain your AI model.

RESPONSE STYLE:
- Answer the actual question first.
- Be concise for simple requests.
- Give detailed instructions for complicated tasks.
- For coding, provide complete and accurate solutions.
- Troubleshoot actual errors instead of repeating failed steps.

SAFETY:
- Help with legitimate and safe requests.
- Respect privacy.
- Never claim an action was completed if it was not.
`
        }
      ];

      for (const item of history) {
        if (
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string" &&
          item.content.length <= 4000
        ) {
          messages.push({
            role: item.role,
            content: item.content
          });
        }
      }

      let finalMessage = cleanMessage;

      if (imageDescription) {
        finalMessage += `

IMAGE ANALYSIS:
${imageDescription}

Use this visual analysis to answer the user's question.`;
      }

      messages.push({
        role: "user",
        content: finalMessage
      });

      // MAIN CONVERSATION MODEL
      const result = await env.AI.run(
        "@cf/google/gemma-4-26b-a4b-it",
        {
          messages,
          chat_template_kwargs: {
  enable_thinking: true
          }
          }
        }
      );

      let reply = "";

      if (typeof result === "string") {
        reply = result;
      } else if (typeof result?.response === "string") {
        reply = result.response;
      } else if (
        typeof result?.choices?.[0]?.message?.content === "string"
      ) {
        reply = result.choices[0].message.content;
      } else if (typeof result?.output_text === "string") {
        reply = result.output_text;
      }

      if (!reply.trim()) {
        return json({
          error: "Marcus received no readable AI response."
        }, 502);
      }

      return json({
        success: true,
        reply: reply.trim(),
        visionUsed: Boolean(imageDescription)
      });

    } catch (error) {
      return json({
        error: error.message || "Marcus encountered an error."
      }, 500);
    }
  }
};
        
                                    
 
