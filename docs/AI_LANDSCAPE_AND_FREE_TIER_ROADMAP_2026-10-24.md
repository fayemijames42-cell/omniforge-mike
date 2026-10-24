# OMNIFORGE — AI ecosystem review and free-tier implementation roadmap
**Research date:** 24 October 2026 | **Constraint:** ₦0, no paid APIs, honest capability labels.

## Principle
Study leading products for lessons, not to clone their interfaces or claim equivalence. OMNIFORGE is a general assistant and creative workspace. Websites are **one optional artifact**, not the application's defining purpose.

## Comparative assessment (product capabilities versus design risks)
These are practical product-level observations, not benchmark rankings or claims about model IQ.

| Product | Demonstrated product strength | Limitation / risk to avoid | OMNIFORGE design response |
| --- | --- | --- | --- |
| ChatGPT / Work | Chat, project context, files, tools and multi-step deliverables in one workflow | Complexity, entitlement differences, and mistaken assumptions about connected tools | Keep one chat entry point; show tools only when usable; require real results before claiming completion |
| Claude | Self-contained artifacts, iterative editing, code and professional documents | Long artifacts can be difficult to validate and features/limits vary | Maintain artifact previews and undo; export outputs; never invent an artifact |
| Gemini / Gemini Notebook (formerly NotebookLM) | Source-based study and synthesis; broader Google ecosystem | Generated claims can still be wrong; privacy / cloud dependence; source requirements | User-selected short reference notes, cited by file/line only when grounded; local storage by default |
| Perplexity | Web-first research with citations and referenced evidence | Citations need checking; sources may be partial or irrelevant | Do not pretend to browse; only cite actual user-supplied notes until a real search tool exists |
| Microsoft 365 Copilot | Work-data grounding through permission-respecting apps | Overbroad access and enterprise licensing dependencies | Explicit opt-in per data source; no silent access to files or accounts |
| Grok | General conversation, voice, media and connectors | Advanced multimodal APIs carry costs; real-time info requires search tools | Prioritize conversation and local creatives; postpone video/media API integrations |
| Poe | Multiple models and specialized experiences in one place | Model orchestration increases latency, costs, and product complexity | Single verified free Workers AI model; lightweight task focus before multiple providers |
| Cursor | Codebase-aware actions, tested edits and checkpoints | Code execution and automatic edits require tight safeguards | Add verifiable tool permissions and rollbacks before code-running agents |
| Mistral Vibe (formerly Le Chat) | Distinct Chat / Work / Code experiences | Mode proliferation and opaque behavior | Lightweight response focus selector; clearly state the same model is used |

**First-party evidence:**
- OpenAI project/Work: https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex
- Anthropic artifacts: https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them
- Google Gemini Notebook: https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/
- Perplexity: https://www.perplexity.ai/hub
- Microsoft work grounding: https://support.microsoft.com/en-us/microsoft-365-copilot/what-information-does-copilot-use-to-answer-my-prompt
- Grok capabilities: https://docs.x.ai/grok/overview
- Poe supported bots: https://help.poe.com/hc/en-us/articles/19944206309524-Poe-FAQs
- Cursor Agent: https://prod.cursor.com/help/ai-features/agent
- Vibe modes: https://help.mistral.ai/en/articles/682992-le-chat-is-now-vibe

## Integrated in this change
1. **Response focus**: General, Learn, Write, Code, Create — one existing Workers AI model, no additional model calls. No claim of specialized models.
2. **Opt-in local reference notes**: up to 3 short TXT, Markdown, CSV or JSON notes per conversation. Notes are kept in browser storage. A user decides whether to include their contents in AI requests. Only short excerpts (at most 3,200 characters/file) are sent.
3. **Grounding behavior**: model receives clear instructions to distinguish user notes from general knowledge, avoid invented citations, and refer to actual note names/lines where applicable.
4. **Honest limits**: no PDF extraction, general live web search, voice model, image generation, terminal execution, cross-device sync or autonomous browsing has been implemented.
5. **Preserve existing work**: existing chats, title generation, search, copy/export, websites, local photos, undo and backups remain.

## Free-tier cost guardrails
- Model remains `@cf/meta/llama-3.1-8b-instruct-fp8`, using the existing Workers AI binding; no paid provider is called.
- No second inference simply to choose a response focus.
- Stored notes **only** go to the model if explicitly included when sending a message; disable the checkbox to exclude them.
- Notes are text-only, small, and capped, avoiding unnecessary prompt/Neuron consumption. The free allowance is **10,000 neurons/day** and resets at 00:00 UTC. Work stops on quota exhaustion; never auto-upgrade.
- Never claim live search or source citations absent a real search integration.
- Avoid secret keys in browser code or source repositories.
- Browser storage may disappear if the user clears site data. Export backups.

Cloudflare pricing reference (updated October 2026): https://developers.cloudflare.com/workers-ai/platform/pricing/

## Next development stages (not yet delivered)
**P1 — Reliability**: end-to-end browser test of each response focus and notes; small-session usage telemetry without storing private message text; better error/status handling; verify truncated website responses never overwrite saved content.

**P2 — General artifacts**: document/text artifact with editable preview and Markdown export; clean separation of conversation, multiple artifacts and websites; reliable save/undo per artifact.

**P3 — Learning & files**: optional client-side PDF extraction with a thoroughly vetted parser, source excerpts and clickable references; no unsupported claim of understanding image-only scanned PDFs.

**P4 — Tools**: deterministic calculator, diagrams and code preview with strict sandbox; provenance on each action. User approval for external writes.

**P5 — Advanced AI**: evaluate free-plan model quality/latency and optional real, source-cited web retrieval, conditioned on pricing/legal allowances. Image and video generation deferred until a genuinely affordable, permissioned provider exists.

## Validation expectations
- Ensure builds pass `npm run check` and `npm test` and check the deployed UI.
- Test: select Learn, ask a concept; select Code, ask an algorithm; attach `.txt` note, ask question from it; disable sources and ask again; reload and verify saved chat settings and notes.
- Don't call a model inference or a cloud deployment verified until the deployed app actually responds.
