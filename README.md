# ESG RAG Intelligence — Supabase pgvector edition

This is the database-backed version of the ESG RAG portfolio project.

## Live backend already created

Supabase project: **ESG RAG System**

Backend components already created:
- PostgreSQL document/company schema
- `pgvector` extension
- `vector(384)` document embeddings
- HNSW vector index
- PostgreSQL full-text `tsvector` + GIN index
- hybrid semantic + keyword retrieval with Reciprocal Rank Fusion
- Row Level Security
- retrieval logs
- evaluation tables
- JWT-protected `ingest-esg-document` Edge Function
- JWT-protected `search-esg-rag` Edge Function

## Real source corpus

The database source register currently contains:
1. SEBI BRSR Reporting Framework (2021)
2. NSE-hosted Industry Standards Note on BRSR Core (2024)
3. Infosys ESG Report 2024–25
4. Tata Motors BRSR 2024–25
5. Reliance Industries Integrated Annual Report 2024–25

No synthetic ESG facts are inserted by the ingestion function.

## First-time initialization

Deploy the site or serve it locally and open `setup.html`.

Click **Initialize / resume database**.

The browser invokes the JWT-protected ingestion function. The Edge Function—not the browser—fetches only the allow-listed official source URLs already registered in PostgreSQL. It extracts selected PDF pages, chunks them, generates 384-dimensional `gte-small` embeddings and inserts them into pgvector.

Initialization is batched and resumable.

## Netlify deployment

No frontend build command is required.

Publish directory:
`.`

Add this environment variable to enable answer generation:

`OPENAI_API_KEY = <your key>`

Optional:

`OPENAI_MODEL = gpt-5.6`

Do not place your OpenAI API key in `config.js` or any client-side file.

## Local serving

`python -m http.server 8080`

Then open:
- `http://localhost:8080/setup.html` for one-time ingestion
- `http://localhost:8080/` for the application

Note: browser calls to Supabase require internet access.

## What is safe to claim

> Built a database-backed ESG RAG system using PostgreSQL/pgvector, 384-dimensional semantic embeddings, PostgreSQL full-text search and Reciprocal Rank Fusion over SEBI BRSR/BRSR Core and corporate sustainability disclosures, with source/page citations and retrieval evaluation.

Do not claim Pinecone, FAISS, LangChain or OpenAI embeddings: this version uses **Supabase pgvector + Supabase gte-small embeddings**.
