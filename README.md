# BioJarvis

BioJarvis is an AI-assisted bioinformatics workspace for asking research questions, exploring protein structures, and comparing binding pockets in one interface.

## Features

### Research Chat

- Natural-language Q&A for drugs, targets, pathways, and structures
- Multi-turn follow-up memory with conversation-aware routing
- Intent routing for `text_only` vs `structure_required` responses
- Source links and evidence claims attached to assistant replies
- Confidence metadata, uncertainty notes, and policy flags in responses

### Structure & Analysis

- Interactive 3D structure visualization from PDB-linked responses
- Mutation and binding-site annotation rendering
- Pocket comparison mode (A/B overlap, drift, common vs unique positions)
- Interaction breakdown metrics (residue classes and deltas)
- Compare shortcut: “Compare newest 2” directly from chat header
- Structure session cap handling with user warning when the max is reached

### Trust & Explainability

- Trust layers summary: Known Facts, Testable Ideas, Evidence
- Research-focused card format: Finding, Context, Confidence/Evidence, Next analysis
- Hypothesis cards with mutation-specific, ligand-aware action text
- Evidence/provenance-focused details for verification workflow

### Workflow & Productivity

- Notebook export (`.ipynb`) from chat session
- Collaboration brief copy-to-clipboard for handoff
- Suggested starter questions in empty-state chat
- File upload from chat input (`.csv`, `.txt`, `.tsv`, `.json`) with mutation extraction

### Account & Data

- Email/password auth via Supabase
- OAuth sign-in/sign-up: Google and GitHub
- Query history page with threaded conversation grouping
- Favorites save/remove flow
- Daily usage tracking and quota enforcement

### Quality & Guardrails

- Accuracy benchmark, question-type audit, and drift guard scripts
- Cached-response layer with stale-cache skip protections
- Conversation IDs persisted for reliable thread continuity
- Safer local dev startup flow for stale lock recovery

## Feature Status (Implemented / In Progress)

### ✅ Implemented (research-ready)

- Research chat with follow-up memory and intent routing
- 3D structure viewer with mutation + binding-site annotations
- Pocket comparison mode with overlap/drift + interaction delta table
- Trust-layer cards for facts, testable ideas, and evidence review
- Source-linked answers with confidence and uncertainty hints
- History threads, favorites, notebook export, and collaboration brief
- Supabase auth (email/password + Google/GitHub OAuth)
- Benchmark guard scripts for quality monitoring

### 🚧 In Progress (high-value next additions)

- Rich evidence filtering in details view (by tier/source type)
- Compact potency/affinity snapshot blocks for faster screening
- More robust multi-model routing and fallback orchestration
- Enhanced publication-style summary templates for researcher reports

### Why this helps researchers and others

- **Researchers:** faster hypothesis generation, structure-grounded analysis, and evidence traceability in one workflow.
- **Students/learners:** clearer explanations and guided analysis flow from question to evidence.
- **Teams:** easier handoff via history threads, copied briefs, and notebook export.

## Tech Stack

- Next.js (App Router), React, TypeScript
- Tailwind CSS + shadcn/ui primitives
- Supabase (Auth + Postgres)
- MCP-style integrations for PDB, ChEMBL, UniProt, PubMed

## Quick Start

1) Install dependencies

```bash
npm install
```

2) Configure environment

```bash
cp .env.local.example .env.local
```

Required variables:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GROQ_API_KEY=...
```

3) Run locally

```bash
npm run dev
```

Open: `http://localhost:3000`

## Authentication (Google + GitHub)

The app already includes OAuth buttons and callback handling. You only need provider configuration.

1) Supabase URL configuration

- Site URL:
  - Local: `http://localhost:3000`
  - Production: `https://your-domain.com`
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `https://your-domain.com/auth/callback`

2) Google OAuth

- In Google Cloud Console, create OAuth client (Web)
- Redirect URI:
  - `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
- Copy client ID/secret into Supabase → Authentication → Providers → Google

3) GitHub OAuth

- In GitHub Developer Settings → OAuth Apps, create app
- Authorization callback URL:
  - `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
- Copy client ID/secret into Supabase → Authentication → Providers → GitHub

## Useful Scripts

```bash
npm run dev
npm run lint
npm run build
npm run benchmark:accuracy
npm run benchmark:question-types
npm run benchmark:guard
```

## Repository Hygiene

Local temp/log/report files are ignored via `.gitignore` and remain on your machine.

Ignored examples:

- local logs (`*.log`, `build_log*.txt`, `lint*.log`)
- local temp folders (`tmpclaude-*`, `backups/`)
- generated local test reports (`question-type-audit-report.json`, etc.)

## Deployment

Deploy to Vercel or Netlify with the same env vars as local.

After deployment, add production callback URLs in Supabase Auth settings.

Optional strict evidence guard:

```env
BIOJARVIS_STRICT_EVIDENCE_POLICY=true
```

When strict policy is enabled and no primary curated evidence is available, the assistant returns a policy-guarded response instead of a high-confidence factual conclusion.

## 📂 Dataset Upload (Starter)

- Use the paperclip button in chat input to upload `.csv`, `.txt`, `.tsv`, or `.json` files.
- The app extracts mutation patterns (e.g., `T790M`) and sends a structured analysis prompt automatically.

## 🚢 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy

### Docker

```bash
docker build -t biojarvis .
docker run -p 3000:3000 --env-file .env.local biojarvis
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com) for Claude AI
- [Supabase](https://supabase.com) for backend infrastructure
- [3Dmol.js](https://3dmol.csb.pitt.edu/) for 3D visualization
- [RCSB PDB](https://www.rcsb.org/) for protein structures
- [ChEMBL](https://www.ebi.ac.uk/chembl/) for drug data
- [UniProt](https://www.uniprot.org/) for protein information
- [PubMed](https://pubmed.ncbi.nlm.nih.gov/) for research literature

---

Built with ❤️ for the bioinformatics community
