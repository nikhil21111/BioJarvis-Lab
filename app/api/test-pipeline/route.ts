import { NextRequest, NextResponse } from 'next/server';
import { pdbGetStructure, pdbSearchProtein, pdbGetBindingSites } from '@/lib/mcp/pdb-client';
import { pubmedSearch, pubmedSearchDrugMechanism } from '@/lib/mcp/pubmed-client';
import { chemblGetTargets } from '@/lib/mcp/chembl-client';

// Complex test cases that stress different parts of the pipeline
const TEST_CASES = [
  {
    id: 'imatinib',
    name: 'Imatinib (BCR-ABL Kinase Inhibitor)',
    description: 'Tests drug name extraction → PDB search → binding site → PubMed → ChEMBL',
    drug: 'Imatinib',
    protein: 'BCR-ABL',
    expectedPdbId: '1IEP',
  },
  {
    id: 'aspirin',
    name: 'Aspirin (COX-1 Inhibitor)',
    description: 'Tests classic drug → known PDB → binding site with ligand ASA',
    drug: 'Aspirin',
    protein: 'COX-1',
    expectedPdbId: '1EQG',
  },
  {
    id: 'insulin',
    name: 'Insulin Structure',  
    description: 'Tests protein name search → PDB structure with no drug',
    drug: null,
    protein: 'insulin',
    expectedPdbId: null, // any insulin PDB
  },
  {
    id: 'erlotinib',
    name: 'Erlotinib (EGFR Inhibitor)',
    description: 'Tests cancer drug → EGFR kinase → binding site',
    drug: 'Erlotinib',
    protein: 'EGFR',
    expectedPdbId: null,
  },
  {
    id: 'metformin',
    name: 'Metformin (Diabetes Drug)',
    description: 'Tests diabetes drug → AMPK → may not have a crystal structure with drug',
    drug: 'Metformin',
    protein: null,
    expectedPdbId: null,
  },
];

interface TestResult {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'partial';
  steps: StepResult[];
  duration: number;
}

interface StepResult {
  step: string;
  status: 'pass' | 'fail' | 'skip';
  data?: unknown;
  error?: string;
  duration: number;
}

async function runTest(test: typeof TEST_CASES[0]): Promise<TestResult> {
  const testStart = Date.now();
  const steps: StepResult[] = [];

  // Step 1: PDB Search
  let pdbId: string | null = null;
  let ligandName: string | null = null;
  {
    const start = Date.now();
    try {
      const searchTerm = test.drug || test.protein || '';
      const result = await pdbSearchProtein(searchTerm);
      if (result.success && result.data && result.data.length > 0) {
        pdbId = result.data[0].pdbId;
        ligandName = result.data[0].ligands?.[0]?.name || null;
        steps.push({
          step: `PDB Search ("${searchTerm}")`,
          status: 'pass',
          data: { 
            pdbId, 
            title: result.data[0].title,
            resolution: result.data[0].resolution,
            ligands: result.data[0].ligands,
            totalResults: result.data.length,
          },
          duration: Date.now() - start,
        });
      } else {
        steps.push({
          step: `PDB Search ("${searchTerm}")`,
          status: 'fail',
          error: result.error || 'No results found',
          duration: Date.now() - start,
        });
      }
    } catch (err) {
      steps.push({
        step: 'PDB Search',
        status: 'fail',
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      });
    }
  }

  // Step 2: PDB Get Structure (if we have an ID)
  if (pdbId) {
    const start = Date.now();
    try {
      const result = await pdbGetStructure(pdbId);
      if (result.success && result.data) {
        steps.push({
          step: `PDB Get Structure (${pdbId})`,
          status: 'pass',
          data: {
            pdbId: result.data.pdbId,
            title: result.data.title,
            resolution: result.data.resolution,
            method: result.data.method,
            organism: result.data.organism,
            ligandsCount: result.data.ligands?.length || 0,
          },
          duration: Date.now() - start,
        });
      } else {
        steps.push({
          step: `PDB Get Structure (${pdbId})`,
          status: 'fail',
          error: result.error,
          duration: Date.now() - start,
        });
      }
    } catch (err) {
      steps.push({
        step: 'PDB Get Structure',
        status: 'fail',
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      });
    }
  }

  // Step 3: Binding Sites
  if (pdbId) {
    const start = Date.now();
    try {
      const result = await pdbGetBindingSites(pdbId, ligandName || undefined);
      if (result.success && result.data) {
        const residueCount = result.data.residues?.length || 0;
        steps.push({
          step: `Binding Sites (${pdbId}, ligand: ${ligandName || 'auto'})`,
          status: residueCount > 0 ? 'pass' : 'fail',
          data: {
            residueCount,
            sampleResidues: result.data.residues?.slice(0, 5).map(r => `${r.name}${r.number} (chain ${r.chain})`) || [],
          },
          duration: Date.now() - start,
        });
      } else {
        steps.push({
          step: `Binding Sites (${pdbId})`,
          status: 'fail',
          error: result.error || 'No binding site data returned',
          duration: Date.now() - start,
        });
      }
    } catch (err) {
      steps.push({
        step: 'Binding Sites',
        status: 'fail',
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      });
    }
  }

  // Step 4: PubMed Search
  {
    const start = Date.now();
    try {
      let result;
      if (test.drug) {
        result = await pubmedSearchDrugMechanism(test.drug, test.protein || undefined, 3);
      } else {
        result = await pubmedSearch(test.protein || test.name, 3);
      }
      if (result.success && result.data && result.data.length > 0) {
        steps.push({
          step: `PubMed Search (${test.drug || test.protein || test.name})`,
          status: 'pass',
          data: {
            articleCount: result.data.length,
            articles: result.data.map(a => ({
              title: a.title.substring(0, 80) + (a.title.length > 80 ? '...' : ''),
              journal: a.journal,
              year: a.publicationDate,
            })),
          },
          duration: Date.now() - start,
        });
      } else {
        steps.push({
          step: 'PubMed Search',
          status: 'fail',
          error: result.error || 'No articles found',
          duration: Date.now() - start,
        });
      }
    } catch (err) {
      steps.push({
        step: 'PubMed Search',
        status: 'fail',
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      });
    }
  }

  // Step 5: ChEMBL Targets (only for drugs)
  if (test.drug) {
    const start = Date.now();
    try {
      const result = await chemblGetTargets(test.drug);
      if (result.success && result.data) {
        steps.push({
          step: `ChEMBL Targets (${test.drug})`,
          status: 'pass',
          data: result.data,
          duration: Date.now() - start,
        });
      } else {
        steps.push({
          step: `ChEMBL Targets (${test.drug})`,
          status: 'fail',
          error: result.error || 'No target data',
          duration: Date.now() - start,
        });
      }
    } catch (err) {
      steps.push({
        step: 'ChEMBL Targets',
        status: 'fail',
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      });
    }
  }

  // Determine overall status
  const passCount = steps.filter(s => s.status === 'pass').length;
  const totalSteps = steps.length;
  const overallStatus = passCount === totalSteps ? 'pass' : passCount > 0 ? 'partial' : 'fail';

  return {
    id: test.id,
    name: test.name,
    status: overallStatus,
    steps,
    duration: Date.now() - testStart,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testId = searchParams.get('test');

  // Run specific test or all tests
  const testsToRun = testId
    ? TEST_CASES.filter(t => t.id === testId)
    : TEST_CASES;

  if (testsToRun.length === 0) {
    return NextResponse.json({ error: `Unknown test: ${testId}`, availableTests: TEST_CASES.map(t => t.id) }, { status: 400 });
  }

  const results: TestResult[] = [];
  for (const test of testsToRun) {
    const result = await runTest(test);
    results.push(result);
  }

  const summary = {
    totalTests: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    partial: results.filter(r => r.status === 'partial').length,
    failed: results.filter(r => r.status === 'fail').length,
    totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
  };

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    summary,
    results,
  }, { status: 200 });
}
