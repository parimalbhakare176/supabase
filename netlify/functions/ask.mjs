export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();

    const question = String(body.question || "")
      .trim()
      .slice(0, 1500);

    const evidence = Array.isArray(body.evidence)
      ? body.evidence.slice(0, 6)
      : [];

    if (!question || !evidence.length) {
      return Response.json(
        {
          error: "Question and retrieved evidence are required.",
        },
        { status: 400 }
      );
    }

    const key = Netlify.env.get("GROQ_API_KEY");

    if (!key) {
      return Response.json(
        {
          error:
            "GROQ_API_KEY is not configured. Hybrid pgvector retrieval is working; add the Groq key in Netlify Environment Variables to enable grounded answer generation.",
        },
        { status: 503 }
      );
    }

    const model =
      Netlify.env.get("GROQ_MODEL") || "openai/gpt-oss-20b";

    const packet = evidence
      .map(
        (e, i) =>
          `[E${i + 1}] ${e.source_name} — ${e.document_title}, PDF page ${
            e.page_start
          }\n${String(e.chunk_text || "").slice(0, 1300)}`
      )
      .join("\n\n");

    const system = `
You are ESG RAG Intelligence, a source-grounded sustainability research assistant.

Use ONLY the retrieved evidence supplied in the user message.

Rules:
1. Every material factual claim must cite one or more evidence IDs such as [E1] or [E2].
2. Never invent ESG metrics, targets, assurance status, dates, emissions, ratings, scores, or company claims.
3. Distinguish regulatory requirements from company-reported claims.
4. Identify reporting-year, scope, methodology, or boundary differences when comparing sources.
5. If the evidence is insufficient, explicitly state what is missing and abstain from guessing.
6. Do not provide investment advice.
7. Keep the answer concise and analytical.
8. Use a compact comparison table only when useful.
9. Do not use outside knowledge, browsing, tools, or unstated assumptions.
`;

    const user = `
QUESTION:
${question}

RETRIEVED EVIDENCE:
${packet}
`;

    const r = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          model,

          messages: [
            {
              role: "system",
              content: system,
            },
            {
              role: "user",
              content: user,
            },
          ],

          max_completion_tokens: 700,
          reasoning_effort: "low",
          temperature: 0.2,
          top_p: 1,
          stream: false,
        }),
      }
    );

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      if (r.status === 429) {
        const retryAfter = r.headers.get("retry-after");

        return Response.json(
          {
            error: `The free Groq generation quota is temporarily exhausted${
              retryAfter
                ? `; retry in about ${retryAfter} seconds`
                : ""
            }. The pgvector retrieval evidence below is still fully available.`,
          },
          { status: 503 }
        );
      }

      return Response.json(
        {
          error:
            data?.error?.message ||
            `Groq API request failed (${r.status}).`,
        },
        { status: r.status }
      );
    }

    const text =
      data?.choices?.[0]?.message?.content || "";

    return Response.json({
      answer: text || "No answer text returned.",
      model,
      provider: "Groq",
      usage: data?.usage || null,
    });
  } catch (e) {
    return Response.json(
      {
        error: String(e?.message || e),
      },
      { status: 500 }
    );
  }
};

export const config = {
  path: "/api/ask",
};
