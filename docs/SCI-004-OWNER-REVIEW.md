# SCI-004 — Owner review of the real-paper pilot

4 November 2026. These are review instructions and the agent's assessment, **not submitted human decisions**. Existing editor may review the agent-authored dossier and its content; no second account or reviewer role is required. This is source-meaning review, not independent scientific verification. Existing author-separation/evidence/revision gates remain unchanged.

Open [the local dossier](http://localhost:3000/editorial/research?dossier=81117510-272d-4222-9dcf-f87241a8f771). Use the existing local editor and Mailpit at http://127.0.0.1:56324 if login is needed. The local Auth UUID differs from Production; the same email does not share sessions or decisions. No token/cookie transfer is needed. The SCI-004 worktree dev server has been started on port 3000.

Source: [Kozma and Hughes, arXiv:2610.30098v1](https://arxiv.org/html/2610.30098v1), with the exact stored original accessible through **Descargar PDF privado**. Compare the PDF pages and located evidence before deciding. Original PDF SHA256 is `f14feae673fbebf1b7c75463f37a38756fa75722b079db9f294db9afb6344ad3`; dossier v1 input hash is `69ed66239702dba1c2398c5ebd4ab27dad4606148bc7a71b4edc2239b6e7af62`.

| Claim | Persisted state at 10:14:33 UTC | Original location / what to check |
|---|---|---|
| model | accept, review v1 | PDF p.1, Model: ideal chiral two-level system, rotating-wave/first-Markov approximations, gamma_0=0. Theoretical model, not an experiment |
| amplitude | missing | PDF p.3, Fig.3(b): amplitudes 1.46, 1.07, 0.79, 0.43, 0.03 at gamma_phi/gamma=0, .25, .5, 1, 2. Not probabilities or gate fidelities |
| phase | missing | PDF p.3, Eq.(4)/Fig.3(a): chosen resonant Gaussian pulse; conditional phase pi in the examined range, excluding gamma_phi=gamma where the reference vanishes. Preserve pulse and dominance conditions |
| misleading-control | missing | PDF p.3, phase plus amplitude passages: preserved phase does not establish practical network immunity. Agent assessment: the inference is unsupported and should not enter the Brief |
| unsupported-control | missing | No evidence link. Claimed commercial experimental 99% improvement has no supporting passage. Agent assessment: unsupported; accepting/narrowing it is disallowed by the existing evidence gate |

Located evidence IDs: model `42324578-d833-46e3-beb6-e359b1570bfa`; amplitude `e8c30f9b-e4d0-43ce-b681-bd2e2f63838c`; phase `9db054f3-e234-4deb-aa93-3bbaa95f1fc3`. Exact quote matching was persisted mechanically; it does not establish semantic correctness or replication.

For each missing claim, choose your own **Decisión**, write your actual reasoning in **Motivo y comprobación del significado**, enter genuinely spent seconds and click **Guardar revisión humana**. `Acotar afirmación` additionally requires specific replacement wording. Do not copy a decision merely because the fixture labels it a control. If evidence is insufficient, reject or request revision; requesting revision correctly keeps generation blocked. Reload and verify each saved review/history entry. Existing model review remains intact; you may reassess it with a new append-only review if your scientific assessment changes.

After all five have final current decisions, no request_revision remains and accepted/narrowed findings remain:

1. Inspect all 13 dossier sections and planning/framing. No rejected/control statement may remain asserted. This v1 narrative currently references only model/amplitude/phase, not the two controls. If your assessment requires substantive correction, request a new immutable dossier revision and review it; do not bypass a gate.
2. Personally complete the separate **Aprobar dossier y framing revisados** form, with an actual whole-dossier reason. One claim review is not whole-dossier approval.
3. Choose **Solo findings revisados · verificar gate**, then **Crear Editorial Brief**. A preliminary Brief cannot authorize generation. This final Brief must retain exactly the current reviews and dossier hash.
4. Tell the agent the reviews/approval/Brief are saved. It will re-read hashes, review IDs and gate state before any generation plan. No human decision or approval is created by the readiness scripts.

Keep `independentScientificVerification=not_performed`; owner review does not establish replication, peer review or scientific truth. Article/script review and publication permissions remain separate. Nothing is published by these forms.
