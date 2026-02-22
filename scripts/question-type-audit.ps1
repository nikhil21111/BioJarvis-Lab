$cases = @(
  @{ type='drug_mechanism'; question='How does venetoclax work in CLL?'; expectedRoute='text_only' },
  @{ type='protein_function'; question='Explain BRCA1 function in DNA repair'; expectedRoute='text_only' },
  @{ type='structure_protein'; question='Show me EGFR structure with erlotinib'; expectedRoute='structure_required' },
  @{ type='structure_pdb_direct'; question='Give PDB 1M17 and key binding residues'; expectedRoute='structure_required' },
  @{ type='binding_site'; question='What are the binding site residues for aspirin on COX-1?'; expectedRoute='structure_required' },
  @{ type='mutation_mapping'; question='Map T790M on EGFR structure'; expectedRoute='structure_required' },
  @{ type='clinical_compare'; question='Compare venetoclax vs navitoclax clinically'; expectedRoute='text_only' },
  @{ type='structure_compare'; question='Compare EGFR and HER2 binding pockets'; expectedRoute='structure_required' },
  @{ type='followup_non_structure'; turns=@(@{question='Show me EGFR structure with erlotinib'},@{question='What about adverse effects and dosing?'}); expectedLastRoute='text_only' },
  @{ type='followup_structure'; turns=@(@{question='Show me EGFR structure with erlotinib'},@{question='Tell me more about its binding site'}); expectedLastRoute='structure_required' },
  @{ type='ambiguous_followup'; question='give structure of that'; expectedRoute='structure_required'; expectedDecisionContains='missing resolvable anchor' },
  @{ type='casual_chat'; question='hey can you simplify that in one line?'; expectedRoute='text_only' },
  @{ type='typo_heavy_structure'; question='plz show strucutre of egfr and bindng site residues'; expectedRoute='structure_required' },
  @{ type='mixed_language_structure'; question='EGFR ka structure dikhao with erlotinib'; expectedRoute='structure_required' },
  @{ type='short_followup_structure'; turns=@(@{question='Show me EGFR structure with erlotinib'},@{question='show same one now'}); expectedLastRoute='structure_required' },
  @{ type='negated_structure_request'; question="don't show structure, just explain mechanism"; expectedRoute='text_only' },
  @{ type='noisy_slang_structure'; question='yo 😂 give me egfr structure pls'; expectedRoute='structure_required' }
)

$results = @()

foreach ($case in $cases) {
  try {
    if ($case.turns) {
      $payload = @{ turns = $case.turns } | ConvertTo-Json -Depth 8
      $resp = Invoke-RestMethod -Uri 'http://localhost:3000/api/test-followup' -Method Post -ContentType 'application/json' -Body $payload -ErrorAction Stop
      $last = @($resp.turns)[-1]
      $ok = $last.intentRoute -eq $case.expectedLastRoute

      $results += [PSCustomObject]@{
        type = $case.type
        expected = $case.expectedLastRoute
        actual = $last.intentRoute
        pdb = $(if ($last.structure -and $last.structure.pdbId) { $last.structure.pdbId } else { '-' })
        decision = $last.structureDecision
        status = $(if ($ok) { 'PASS' } else { 'FAIL' })
      }
    }
    else {
      $payload = @{ turns = @(@{ question = $case.question }) } | ConvertTo-Json -Depth 8
      $resp = Invoke-RestMethod -Uri 'http://localhost:3000/api/test-followup' -Method Post -ContentType 'application/json' -Body $payload -ErrorAction Stop
      $turn = @($resp.turns)[0]

      $ok = $turn.intentRoute -eq $case.expectedRoute
      if ($ok -and $case.expectedDecisionContains) {
        $ok = (($turn.structureDecision | Out-String).ToLower().Contains(($case.expectedDecisionContains | Out-String).ToLower().Trim()))
      }

      $results += [PSCustomObject]@{
        type = $case.type
        expected = $case.expectedRoute
        actual = $turn.intentRoute
        pdb = $(if ($turn.structure -and $turn.structure.pdbId) { $turn.structure.pdbId } else { '-' })
        decision = $turn.structureDecision
        status = $(if ($ok) { 'PASS' } else { 'FAIL' })
      }
    }
  }
  catch {
    $results += [PSCustomObject]@{
      type = $case.type
      expected = $(if ($case.expectedRoute) { $case.expectedRoute } else { $case.expectedLastRoute })
      actual = 'ERROR'
      pdb = '-'
      decision = $_.Exception.Message
      status = 'FAIL'
    }
  }
}

$results | Format-Table -AutoSize

$summary = [PSCustomObject]@{
  total = $results.Count
  pass = @($results | Where-Object { $_.status -eq 'PASS' }).Count
  fail = @($results | Where-Object { $_.status -eq 'FAIL' }).Count
}

"`nSummary: $($summary.pass)/$($summary.total) passed"
