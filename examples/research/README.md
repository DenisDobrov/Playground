# Real-paper pilot input — not an approved scientific publication

Source: Matthew Kozma and Stephen Hughes, *Pure dephasing destroys two-photon amplitude, not nonlinear phase*, [arXiv:2610.30098v1](https://arxiv.org/abs/2610.30098v1). The arXiv page links [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), checked 31 October 2026. Exact short quotations retain PDF text-layer whitespace/line breaks; framing and claims are an AI-assisted editorial interpretation, not text authored or approved by the paper's authors.

The original eight-page PDF stays in ignored local artifacts/private Storage, not Git. Observed SHA-256: `f14feae673fbebf1b7c75463f37a38756fa75722b079db9f294db9afb6344ad3`. Pages 1 and 3 were visually inspected against extraction. No figures are republished or cleared automatically for downstream video.

`photonic-draft.json` has thirteen dossier sections, proposed editorial planning, three literal passages and five claims. **misleading-control** and **unsupported-control** are intentionally false controls for rejection. A valid quote alone does not make the former scientifically supported. The final claim has no supporting evidence and the SQL approval gate rejects accept/narrow for it.

Human review and whole-dossier approval are required. Do not mark the fixture as human-reviewed or publish these controls. Claims retain `unverified` independent-scientific status even after source-meaning review.

After placing the actual operator-provided PDF at the configured ignored path and ensuring the existing local Source and budget month are available:

```powershell
npm run research:local:prepare -- examples/research/photonic-pilot.json
```

No arbitrary URL is fetched by this file-intake command. Only the existing allowlisted SCI-002 arXiv metadata adapter may refresh the canonical identity. The CLI is hard-bound to API `127.0.0.1:56321`; local extraction/persistence is accounted as zero provider charge in the existing ledger. Repeated settled input is held under its original operation identity.

Read docs/SCI-003.md for review, export, constraints and next-slice readiness. The application does not automatically derive a scientifically valid dossier from a PDF; the structured extraction is deliberately curated and then checked mechanically and by an independent human.
