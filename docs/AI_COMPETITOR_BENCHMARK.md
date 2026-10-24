# OMNIFORGE — AI Benchmark and Free-Tier Engineering Rules
Updated 24 October 2026 | Product: MIKEE / NEXUS | Budget: NGN 0

## North star
OMNIFORGE is a general-purpose AI workspace. Conversation is the primary interface; websites, documents, diagrams, images, and simulations are **artifacts**, not assumptions made for every chat. Learning from leading products does not imply reproducing proprietary designs or copying their branding.

## Evidence-informed competitive lessons

| Product | Capability worth learning from | Limitation/trade-off to avoid | Low-cost OMNIFORGE response |
| --- | --- | --- | --- |
| ChatGPT | Organized projects, searchable chats, continuity within a workspace | A broad platform can become difficult to navigate when every tool is surfaced at once | Search chats locally; keep creation tools contextual and conversations central |
| Claude | Iterative, versioned artifacts beside conversation | Long generated artifacts and dependencies can be resource-intensive; complex interactive output must be sandboxed | Preserve undo/version history and isolated HTML previews; add wider artifact types later |
| Gemini | Conversational editing, Canvas workflows, research features | Advanced models and research are quota-intensive or subscription dependent | Reuse local editors; avoid automatic expensive research/multi-agent sweeps |
| Grok | Time-sensitive questions benefit from real-time source retrieval | Social/web inputs can be incomplete or misleading; public web integration requires provider and privacy review | Do not claim live news/web research until a real verifiable retrieval service is connected |
| Perplexity | Source-first research with links/citations | Fake or low-quality citations create misplaced confidence; search APIs can cost money | Never fabricate links; label unverified/current questions plainly; plan an opt-in sourced research mode |
| NotebookLM | Answers grounded in explicitly selected sources, reviewable citations | Source-limited results may fail outside the uploaded corpus | Future opt-in text/PDF source-grounded study workspace with clear source boundaries |
| Microsoft Copilot | Persistent Pages and conversion of conversation into reusable content | Collaboration and connected-app dependence complicate privacy and permissions | Local export and reusable artifacts first; no implicit account integrations |
| Canva | Editable designs with templates and visual structure | Remote model-based visual generation and heavy editor UI can exceed free limits | Keep lightweight local image manipulation and templates; don't promise full AI image generation |
| Cursor | Separate ask-only and write/edit modes, code-aware workflows | Unreviewed autonomous edits and arbitrary code execution add risk | Keep code evaluation sandboxed and require explicit approval before edits/publication |

Sources: https://help.openai.com/en/articles/10169521-projects-in-chatgpt
https://support.anthropic.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them
https://support.google.com/gemini/answer/16047321
https://help.x.com/en/using-x/about-grok
https://www.perplexity.ai/en-GB/hub/products/search
https://support.google.com/gemininotebook/answer/16179559
https://support.microsoft.com/en-us/microsoft-365-copilot/how-microsoft-365-copilot-pages-works
https://www.canva.com/help/use-magic-design/
https://docs.cursor.com/en/agent/modes

These are publicly documented features. The limitations column is an OMNIFORGE engineering assessment, not a controlled head-to-head benchmark of model accuracy.

## Hard budget gates

- Workers AI Free: **10,000 neurons per day** across the account, resetting at 00:00 UTC. Some models are paid-only. See https://developers.cloudflare.com/workers-ai/platform/pricing/
- Workers Free: **100,000 requests/day, 10 ms CPU execution per request, 128 MB memory**, subject to platform changes. See https://developers.cloudflare.com/workers/platform/limits/
- No paid API keys, billing upgrades, third-party proxy inference, or forced subscriptions.
- Never claim that a fallback rule is a live model. Show errors when a real AI call fails.
- A local title should cost zero model calls. Titles should be manually editable.
- Bound payload sizes, chat history lengths and output tokens; preserve usable error messages.
- No remote persistence, public sharing of user files, or third-party integration without clear informed consent.
- Keep local files/photos on the device. Warn users that clearing browser data removes local work; support explicit export.
- Clearly separate factual retrieval from model-generation. No synthetic citations or claim of browsing without a tool.
- Do not run, deploy, publish, or modify external resources without authorization. Preview generated sites in a sandbox.

## Implemented in this release (code committed; production rollout separately verified)

1. Local chat search across titles and saved message text (zero AI calls).
2. Copy assistant replies, rendered text and fenced code blocks (escaped to prevent HTML injection).
3. Export conversations as Markdown, locally, without any server-side storage.
4. Chat titles determined locally; automatic extra model call for title refinement removed.
5. Smaller default output budget for general chat than full-site generation.
6. Shorter history excerpts with a bounded model context; general-purpose system instruction warns against fabricated browsing, citations, tests or tool use.
7. Existing: browser IndexedDB history, conversation-first mobile UI, a real Cloudflare Workers AI binding, isolated website preview, and local file/photo features.

## Next increments (not implemented)

**Phase A — reliability and tests (free)**: browser smoke tests for chat search, export, copy, reload, switching tabs, title preservation; deployment/version display; errors for exhausted AI quota.

**Phase B — general artifacts (local-first)**: persistent documents/notes with draft editing; separate artifacts from conversations and project records; export plain text/HTML/CSV before considering more complex formats.

**Phase C — tool coordinator (bounded)**: explicit commands for local calculators, previews, and editors with honest tool-result messages. No autonomous external writes, unbounded loops, or pay-per-call chains.

**Phase D — source-grounded research (optional)**: ingest text files in-browser and cite exact lines. Only add web retrieval once a genuinely no-charge sustainable source is found and verified; never label internal model text as web citations.

**Phase E — additional media (conditional)**: assess performance, quota and privacy before speech/image/video workflows. Do not imply these are functional until verified.

## Release acceptance checklist

- [ ] JavaScript parse and automated tests pass (tests are present but deployment build may not run them automatically).
- [ ] GitHub commit deployed to connected Cloudflare production Worker.
- [ ] New general conversation does not create an unwanted website.
- [ ] Search finds a title and a message, and opens the correct chat.
- [ ] Copy reply and Markdown export work on Android.
- [ ] AI response/typing state remains clear; Free-tier failures are shown.
- [ ] Website creation and preview still work.
- [ ] No additional title-inference charges after sending the first topic.

Do not label a check complete without a real verification.