const C=window.ESG_RAG_CONFIG,$=s=>document.querySelector(s);
async function invoke(body){const r=await fetch(`${C.supabaseUrl}/functions/v1/ingest-esg-document`,{method:"POST",headers:{"Content-Type":"application/json","apikey":C.anonKey,"Authorization":`Bearer ${C.anonKey}`},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d}
function row(src){return `<div class="progress-row" id="row-${src.slug}"><b>${src.short}</b><div class="track"><i></i></div><span class="state">Waiting</span></div>`}
$("#sourceProgress").innerHTML=C.sources.map(row).join("");
$("#initialize").onclick=async()=>{const btn=$("#initialize");btn.disabled=true;let doneBatches=0,total=C.sources.reduce((s,x)=>s+x.batches,0),errors=0;$("#overall").textContent=`Starting ${total} controlled ingestion batches…`;
 for(const src of C.sources){const root=$(`#row-${src.slug}`),bar=root.querySelector("i"),state=root.querySelector(".state");
  for(let b=0;b<src.batches;b++){state.textContent=`Batch ${b+1}/${src.batches}`;try{const d=await invoke({slug:src.slug,batch:b});doneBatches++;bar.style.width=`${Math.round((b+1)/src.batches*100)}%`;state.textContent=`${b+1}/${src.batches} · ${d.status}`;$("#overall").textContent=`${doneBatches}/${total} batches complete · ${errors} errors`;}catch(e){errors++;state.textContent=`Error: ${e.message}`;$("#overall").textContent=`${doneBatches}/${total} batches complete · ${errors} errors`;break}}
 }
 btn.disabled=false;$("#overall").innerHTML=errors?`Initialization finished with <b>${errors}</b> source error(s). Re-run to resume; completed batches are skipped.`:`<b>Initialization complete.</b> The vector database is ready. Return to the research assistant and run a query.`;};
