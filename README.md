# 🧬 BioJarvis Lab

<div align="center">

<img src="public/readme/banner.svg" alt="BioJarvis Lab Banner" width="100%" />

AI-powered bioinformatics workspace for structure-first research, evidence-aware Q&A, and pocket-level comparison.

![Platform](https://img.shields.io/badge/Platform-Next.js%2016-000000?style=for-the-badge&logo=nextdotjs)
![Language](https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Backend](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Domain](https://img.shields.io/badge/Domain-Bioinformatics-00C896?style=for-the-badge)

</div>

---

## 🖼 Product Preview

<table>
  <tr>
    <td width="50%" align="center"><b>Main Workspace</b></td>
    <td width="50%" align="center"><b>Fullscreen Structure View</b></td>
  </tr>
  <tr>
    <td><img src="public/readme/01-main-workspace.png" alt="Main Workspace Preview" /></td>
    <td><img src="public/readme/02-fullscreen-viewer.png" alt="Fullscreen Structure View Preview" /></td>
  </tr>
  <tr>
    <td width="50%" align="center"><b>Analysis Panel</b></td>
    <td width="50%" align="center"><b>Evidence Panel</b></td>
  </tr>
  <tr>
    <td><img src="public/readme/03-analysis-panel.png" alt="Analysis Panel Preview" /></td>
    <td><img src="public/readme/04-evidence-panel.png" alt="Evidence Panel Preview" /></td>
  </tr>
</table>

---

## ✨ Why BioJarvis

BioJarvis helps researchers move from question → structure → evidence faster:

- Ask complex biological questions in plain language
- Load protein structures and mutation context directly in chat flow
- Compare binding pockets side-by-side with actionable differences
- Review trust layers (facts, testable ideas, evidence) before decisions

---

## 🧪 Core Capabilities

### 1) Research Chat
- Natural-language Q&A for drugs, targets, pathways, and structures
- Context-aware follow-up memory across turns
- Intent routing (`text_only` vs `structure_required`)
- Confidence/uncertainty metadata, policy flags, and source links

### 2) Structure & Pocket Analysis
- Interactive 3D structure viewer (PDB-aware)
- Binding-site + mutation annotations
- Pocket comparison mode (overlap, drift, A/B unique residues)
- Interaction metrics table (hydrophobic/polar/charged deltas)
- Fullscreen-first analysis and structure-only screenshot export

### 3) Trust & Explainability
- Trust layers summary: Known Facts, Testable Ideas, Evidence
- Research-focused cards: Finding → Context → Confidence/Evidence → Next analysis
- Evidence/provenance drilldown for verification workflow

### 4) Productivity & Collaboration
- Notebook export (`.ipynb`) from chat
- Copy collaboration brief for handoff
- Suggested starter prompts in empty state
- Dataset upload (`.csv`, `.txt`, `.tsv`, `.json`) with mutation extraction

### 5) Account, History, and Guardrails
- Supabase auth: email/password + Google/GitHub OAuth
- Threaded query history + favorites
- Daily usage tracking and quota controls
- Benchmark accuracy + drift guard scripts

---

## 🧭 Feature Status

| Area | Status | Notes |
|---|---|---|
| Research Chat + Follow-up Memory | ✅ Implemented | Multi-turn continuity and intent routing |
| 3D Structure Viewer | ✅ Implemented | Mutation + site annotations |
| Pocket Comparison | ✅ Implemented | Overlap, drift, interaction deltas |
| Trust Layers + Evidence UI | ✅ Implemented | Fact/hypothesis/evidence separation |
| OAuth (Google/GitHub) | ✅ Implemented | Requires provider credentials in Supabase |
| Export & Collaboration | ✅ Implemented | `.ipynb` export + copy brief |
| Evidence Filtering by Tier | 🚧 In Progress | Planned advanced filter controls |
| Potency Snapshot Blocks | 🚧 In Progress | Planned faster medicinal chemistry scan |
| Multi-model fallback orchestration | 🚧 In Progress | Planned reliability/latency balancing |

### Who this helps
- **Researchers:** structure-grounded insights and evidence traceability in one workspace
- **Students/Learners:** clearer path from question to explanation to evidence
- **Teams:** faster handoff via history threads, brief export, and notebooks

---

## 🛠 Tech Stack

- **Frontend:** Next.js (App Router), React, TypeScript
- **UI:** Tailwind CSS + shadcn/ui primitives
- **Backend:** Supabase (Auth + Postgres)
- **Data Integrations:** PDB, ChEMBL, UniProt, PubMed (MCP-style clients)

---

## 🚀 Quick Start

### 1) Install

```bash
npm install
```

### 2) Configure environment

```bash
cp .env.local.example .env.local
```

Required values:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GROQ_API_KEY=...
```

### 3) Run locally

```bash
npm run dev
```

Open: http://localhost:3000

---

## 🔐 Google + GitHub OAuth Setup

The app UI is already wired. You only need provider configuration.

### Supabase URL Configuration
- **Site URL**
  - Local: `http://localhost:3000`
  - Prod: `https://your-domain.com`
- **Redirect URLs**
  - `http://localhost:3000/auth/callback`
  - `https://your-domain.com/auth/callback`

### Google OAuth
- Create OAuth Web client in Google Cloud Console
- Redirect URI:
  - `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
- Copy Client ID/Secret into Supabase → Auth → Providers → Google

### GitHub OAuth
- Create OAuth App in GitHub Developer Settings
- Authorization callback URL:
  - `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
- Copy Client ID/Secret into Supabase → Auth → Providers → GitHub

---

## 📜 Scripts

```bash
npm run dev
npm run lint
npm run build
npm run benchmark:accuracy
npm run benchmark:question-types
npm run benchmark:guard
```

---

## 📦 Deployment

### Vercel / Netlify
1. Push repo
2. Import project
3. Add environment variables
4. Deploy
5. Add production callback URL(s) in Supabase Auth settings

### Optional strict evidence mode

```env
BIOJARVIS_STRICT_EVIDENCE_POLICY=true
```

When enabled, responses are policy-guarded when primary curated evidence is missing.

---

## 🧹 Repository Hygiene

Local-only temp/design/debug artifacts are excluded via `.gitignore`.
Examples:
- logs and generated reports
- local temp folders (`tmpclaude-*`, backups)
- design/prototype assets (`stitch/`, `.fig`, `.psd`, `.lottie`, etc.)

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Make focused changes
4. Open pull request

---

## 🙏 Acknowledgments

- Anthropic
- Supabase
- 3Dmol.js
- RCSB PDB
- ChEMBL
- UniProt
- PubMed

---

<div align="center">
Built for research velocity, scientific rigor, and explainable decisions.
</div>
