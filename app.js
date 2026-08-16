const C=window.ESG_RAG_CONFIG,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let DOCS=[],EVALS=[];
const themes=["Climate & emissions","Energy","Water","Waste & circularity","Workforce","Governance & ethics","Privacy & cybersecurity","Assurance & reporting"];
function esc(x){return String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
async function sbFetch(path,opt={}){const headers={"apikey":C.anonKey,"Authorization":`Bearer ${C.anonKey}`,...(opt.headers||{})};return fetch(C.supabaseUrl+path,{...opt,headers})}
async function invoke(name,body){const r=await sbFetch(`/functions/v1/${name}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||`Supabase function failed (${r.status})`);return d}
async function loadDocs(){
 const r=await sbFetch("/rest/v1/documents?select=slug,title,source_name,document_type,reporting_year,source_url,source_domain,page_count,company_id&order=source_name.asc");
 if(!r.ok)throw new Error("Could not load Supabase documents");DOCS=await r.json();
 const sr=await sbFetch("/rest/v1/document_chunks?select=id,document_id,embedding_model&page_start=gte.0",{headers:{"Prefer":"count=exact","Range":"0-0"}});
 const cr=sr.headers.get("content-range")||"0/0";const count=Number(cr.split("/")[1]||0);
 $("#dbStatus").textContent=count?`Vector corpus online`:"Corpus not initialized";$("#dbMeta").textContent=count?`${count.toLocaleString()} embedded chunks · PostgreSQL`:"Run Database setup once";$("#dbDot").classList.toggle("ok",count>0);
 $("#heroKpis").innerHTML=`<div class="mini"><span>Database</span><strong>Postgres</strong><small>Supabase hosted</small></div><div class="mini"><span>Vector extension</span><strong>pgvector</strong><small>384 dimensions</small></div><div class="mini"><span>Source documents</span><strong>${DOCS.length}</strong><small>official / company-hosted</small></div><div class="mini"><span>Embedded chunks</span><strong>${count.toLocaleString()}</strong><small>${count?"live vector corpus":"initialize first"}</small></div>`;
 $("#sourceFilter").innerHTML='<option value="">All sources</option>'+DOCS.map(d=>`<option value="${esc(d.slug)}">${esc(d.source_name)}</option>`).join("");
 $("#corpusGrid").innerHTML=DOCS.map(d=>`<article class="source-card"><span class="eyebrow">${esc(d.document_type)} · ${esc(d.reporting_year||"")}</span><h3>${esc(d.title)}</h3><p>${esc(d.source_domain)} · ${d.page_count||"—"} PDF pages in source document.</p><div class="source-stats"><div><b>${esc(d.source_name)}</b><span>publisher / filing source</span></div><div><b>${esc(d.reporting_year||"—")}</b><span>reporting year</span></div></div><p><a href="${esc(d.source_url)}" target="_blank" rel="noreferrer">Open original source ↗</a></p></article>`).join("");
}
async function runQuery(){
 const query=$("#question").value.trim();if(!query)return;$("#run").disabled=true;$("#answerStatus").textContent="Retrieving…";
 try{
  const source=$("#sourceFilter").value,theme=$("#themeFilter").value;
  const ret=await invoke("search-esg-rag",{query,match_count:Number($("#topK").value),source_slugs:source?[source]:null,themes:theme?[theme]:null});
  renderEvidence(ret.results||[],ret);
  if(!(ret.results||[]).length){$("#answer").className="answer";$("#answer").textContent="No evidence was returned. If this is a new deployment, initialize the vector database first. Otherwise broaden your filters.";$("#answerStatus").textContent="Abstained";return}
  $("#answerStatus").textContent="Generating…";$("#answer").className="answer";$("#answer").textContent="Retrieved evidence successfully. Generating a source-grounded response…";
  const r=await fetch("/api/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:query,evidence:ret.results})});
  const d=await r.json();if(!r.ok)throw new Error(d.error||"Generation endpoint unavailable");
  $("#answer").textContent=d.answer;$("#answerStatus").textContent=`Grounded · ${d.model}`;
 }catch(e){$("#answer").className="answer";$("#answer").textContent=`Retrieval/generation status:\n\n${e.message}\n\nIf retrieval succeeded but generation failed, configure OPENAI_API_KEY in Netlify. If the corpus is empty, open Database setup and initialize it.`;$("#answerStatus").textContent="Check setup"}
 finally{$("#run").disabled=false}
}
function renderEvidence(rows,meta){$("#retrievalStatus").textContent=`${rows.length} results · ${meta.latency_ms||"—"} ms`;$("#evidence").className=rows.length?"evidence":"evidence empty-evidence";$("#evidence").innerHTML=rows.length?rows.map((e,i)=>`<article class="ev"><div class="ev-top"><b>[E${i+1}] ${esc(e.source_name)}</b><span>RRF ${Number(e.hybrid_score||0).toFixed(4)}</span></div><h4>${esc(e.document_title)}</h4><p>${esc(e.chunk_text)}</p><div class="scores">PDF p.${e.page_start}${e.page_end!==e.page_start?`–${e.page_end}`:""} · semantic ${Number(e.semantic_similarity||0).toFixed(3)} · FTS ${Number(e.full_text_rank||0).toFixed(3)} · <a href="${esc(e.source_url)}" target="_blank" rel="noreferrer">source ↗</a></div></article>`).join(""):"No evidence returned."}
async function loadEvals(){
 const r=await sbFetch("/rest/v1/retrieval_eval_queries?select=id,question,expected_source_slugs,expected_themes&order=id.asc");if(r.ok)EVALS=await r.json();
 $("#evalKpis").innerHTML=`<div class="mini"><span>Evaluation questions</span><strong>${EVALS.length}</strong><small>stored in PostgreSQL</small></div><div class="mini"><span>Metric</span><strong>Hit@5</strong><small>expected source retrieval</small></div><div class="mini"><span>Run type</span><strong>Live</strong><small>current vector index</small></div>`;
 $("#evalTable").innerHTML=EVALS.map(e=>`<tr><td>${esc(e.question)}</td><td>${esc((e.expected_source_slugs||[]).join(", "))}</td><td>Not run</td><td>—</td></tr>`).join("");
}
async function runEval(){
 if(!EVALS.length)return;$("#runEval").disabled=true;$("#evalState").textContent="Running live hybrid retrieval…";
 let rows=[],hits=0;
 for(const e of EVALS){try{const r=await invoke("search-esg-rag",{query:e.question,match_count:5});const got=[...new Set((r.results||[]).map(x=>x.document_slug))];const hit=(e.expected_source_slugs||[]).some(x=>got.includes(x));if(hit)hits++;rows.push({e,got,hit})}catch(err){rows.push({e,got:[`ERROR: ${err.message}`],hit:false})}}
 $("#evalTable").innerHTML=rows.map(x=>`<tr><td>${esc(x.e.question)}</td><td>${esc((x.e.expected_source_slugs||[]).join(", "))}</td><td>${esc(x.got.join(" · "))}</td><td class="${x.hit?"hit":"miss"}">${x.hit?"PASS":"MISS"}</td></tr>`).join("");
 $("#evalState").textContent=`Expected-source Hit@5: ${hits}/${EVALS.length} (${Math.round(hits/EVALS.length*100)}%)`;$("#runEval").disabled=false;
}
const sugg=["Compare Infosys and Reliance on climate-related performance.","What does BRSR require on Scope 1 and Scope 2 emissions?","What does BRSR Core say about assurance or assessment?","What does Tata Motors disclose about Scope 1 and Scope 2 emissions?","How does Infosys discuss privacy and cybersecurity?"];
$("#suggestions").innerHTML=sugg.map(x=>`<button>${x}</button>`).join("");$$(".suggestions button").forEach(b=>b.onclick=()=>{$("#question").value=b.textContent;runQuery()});
$("#theme").onclick=()=>document.body.classList.toggle("light");$("#run").onclick=runQuery;$("#question").addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")runQuery()});$("#copy").onclick=()=>navigator.clipboard.writeText($("#answer").innerText);$("#runEval").onclick=runEval;
$("#themeFilter").innerHTML='<option value="">All ESG themes</option>'+themes.map(x=>`<option>${x}</option>`).join("");
$$(".nav").forEach(b=>b.onclick=()=>{$$(".nav").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".view").forEach(v=>v.classList.remove("active"));$("#"+b.dataset.view).classList.add("active");const t={research:"Evidence before generation.",corpus:"Every chunk has a source.",evaluation:"Evaluate retrieval on the live index.",architecture:"A real vector RAG stack."};$("#pageTitle").textContent=t[b.dataset.view]});
Promise.all([loadDocs(),loadEvals()]).catch(e=>{$("#dbStatus").textContent="Database connection issue";$("#dbMeta").textContent=e.message});
