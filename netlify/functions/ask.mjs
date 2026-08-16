export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed",{status:405});
  try{
    const body=await req.json();const question=String(body.question||"").slice(0,3000);const evidence=Array.isArray(body.evidence)?body.evidence.slice(0,12):[];
    if(!question||!evidence.length)return Response.json({error:"Question and retrieved evidence are required."},{status:400});
    const key=Netlify.env.get("OPENAI_API_KEY");if(!key)return Response.json({error:"OPENAI_API_KEY is not configured. Vector retrieval is working; add the key in Netlify Environment Variables to enable generation."},{status:503});
    const model=Netlify.env.get("OPENAI_MODEL")||"gpt-5.6";
    const packet=evidence.map((e,i)=>`[E${i+1}] ${e.source_name} — ${e.document_title}, PDF page ${e.page_start}\n${String(e.chunk_text||"").slice(0,1800)}`).join("\n\n");
    const instructions=`You are ESG RAG Intelligence, a source-grounded sustainability research assistant.
Use ONLY the retrieved evidence supplied by the user.
Rules:
1. Every material factual claim must cite evidence IDs such as [E1] or [E2].
2. Never invent ESG metrics, targets, assurance status, dates, emissions, ratings or scores.
3. Distinguish regulatory requirements from company-reported claims.
4. Identify reporting-year, scope or boundary differences when comparing sources.
5. If retrieved evidence is insufficient, state what is missing and abstain from guessing.
6. Do not provide investment advice.
7. Prefer analytical prose; use a compact comparison table when it materially improves clarity.`;
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,instructions,input:`QUESTION:\n${question}\n\nRETRIEVED EVIDENCE:\n${packet}`})});
    const data=await r.json();if(!r.ok)return Response.json({error:data?.error?.message||"OpenAI API request failed."},{status:r.status});
    let text=data.output_text;if(!text&&Array.isArray(data.output))text=data.output.flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n");
    return Response.json({answer:text||"No answer text returned.",model});
  }catch(e){return Response.json({error:String(e?.message||e)},{status:500})}
};
export const config={path:"/api/ask"};
