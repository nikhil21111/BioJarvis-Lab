$cases = @(
  @{ name='casual_chat'; turns=@(@{question='hey can you help me think this through?'},@{question='that answer was confusing, say it simpler'},@{question='ok summarize in one line'}) },
  @{ name='ambiguous_no_anchor'; turns=@(@{question='give structure of that'}) },
  @{ name='anchored_followup'; turns=@(@{question='show the structure of EGFR with erlotinib'},@{question='give structure of that'}) },
  @{ name='smalltalk_then_anchor'; turns=@(@{question='bro random question hi'},@{question='show me EGFR structure'},@{question='give structure of that again'}) }
)

foreach ($case in $cases) {
  try {
    $payload = @{ turns = $case.turns } | ConvertTo-Json -Depth 8
    $resp = Invoke-RestMethod -Uri 'http://localhost:3000/api/test-followup' -Method Post -ContentType 'application/json' -Body $payload -ErrorAction Stop

    Write-Output "=== $($case.name) ==="
    foreach ($t in @($resp.turns)) {
      $pdb = if ($t.structure -and $t.structure.pdbId) { $t.structure.pdbId } else { '-' }
      $tools = if ($t.toolsCalled) { $t.toolsCalled -join ',' } else { '-' }
      Write-Output ("T{0} | route={1} | decision={2} | pdb={3} | tools={4}" -f $t.turn, $t.intentRoute, $t.structureDecision, $pdb, $tools)
    }
  }
  catch {
    Write-Output "=== $($case.name) ==="
    Write-Output "ERROR: $($_.Exception.Message)"
    if ($_.ErrorDetails.Message) { Write-Output $_.ErrorDetails.Message }
  }
}
