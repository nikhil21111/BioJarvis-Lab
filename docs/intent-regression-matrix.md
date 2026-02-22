# Intent Routing Regression Matrix

Date: 2026-02-19
Scope: Chat intent routing (`text_only` vs `structure_required`), structure generation gate, follow-up grounding, and confidence behavior.

## Expected Rules

- Generate structure only when the query has explicit structure intent (PDB, binding site, residues, docking, 3D visualization, mutation mapping on structure).
- For non-structure research questions, return text-only answer.
- For ambiguous/low-confidence structure retrieval, return best-effort structure with low-confidence warning.
- Follow-up questions should leverage previous generated structure context and prior assistant answer context.
- Mutations should be sourced from validated UniProt variants only.

## Test Cases

| ID  | Prompt                                                      | Context                                              | Expected Route       | Expected Structure | Expected Notes                                                       |
| --- | ----------------------------------------------------------- | ---------------------------------------------------- | -------------------- | ------------------ | -------------------------------------------------------------------- |
| 1   | What is the mechanism of action of venetoclax in CLL?       | none                                                 | `text_only`          | no                 | Includes target/mechanism from ChEMBL/UniProt/PubMed where available |
| 2   | Show me the 3D structure of EGFR with erlotinib             | none                                                 | `structure_required` | yes                | Returns structure + binding residues if available                    |
| 3   | Explain BRCA1 function in DNA repair                        | none                                                 | `text_only`          | no                 | No structure payload                                                 |
| 4   | Give PDB 1M17 and list key binding residues                 | none                                                 | `structure_required` | yes                | Direct PDB lookup path                                               |
| 5   | Which pathways are altered by TP53 loss?                    | none                                                 | `text_only`          | no                 | General pathway answer only                                          |
| 6   | Visualize pembrolizumab complex and mark interface residues | none                                                 | `structure_required` | yes                | Structure + interface/binding annotations if available               |
| 7   | What are common resistance mutations to osimertinib?        | none                                                 | `text_only`          | no                 | Mutations from UniProt-validated data only                           |
| 8   | Map T790M on EGFR structure                                 | none                                                 | `structure_required` | yes                | Structure request explicit via mapping language                      |
| 9   | Is semaglutide effective for weight loss and diabetes?      | none                                                 | `text_only`          | no                 | Clinical summary only                                                |
| 10  | Docking pocket residues for BCL2 with venetoclax?           | none                                                 | `structure_required` | yes                | Explicit pocket/residue intent                                       |
| 11  | Tell me more about its binding site                         | Previous assistant message contains structure `6O0K` | `structure_required` | yes                | Follow-up should reuse prior structure context                       |
| 12  | Tell me more about adverse effects and dosing               | Previous assistant message contains structure `6O0K` | `text_only`          | no                 | Follow-up not structure-specific                                     |
| 13  | What does this structure suggest about selectivity?         | Previous assistant message contains structure        | `structure_required` | yes                | Uses follow-up memory                                                |
| 14  | Compare venetoclax vs navitoclax clinically                 | none                                                 | `text_only`          | no                 | Comparative text answer                                              |
| 15  | Show active-site residues for this PDB                      | Previous context contains `pdbId`                    | `structure_required` | yes                | Should resolve PDB from follow-up memory                             |

## Acceptance Checklist

- `text_only` route responses do not include `structure` payload.
- `structure_required` route responses include `structure` payload when retrieval finds candidate.
- Low-confidence structure candidates include warning in answer text and metadata confidence flag.
- Route decision appears in metadata (`intentRoute`, `structureDecision`).
- Feedback controls (dev mode) can mark route as correct/wrong and update local analytics counters.
- Follow-up with previous structure context correctly resolves entity/PDB without user restating full details.
- Mutation annotations appear only when backed by UniProt variant records.
