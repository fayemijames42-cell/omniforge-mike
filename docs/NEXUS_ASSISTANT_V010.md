# MIKEE / NEXUS assistant update — 25 October 2026

OMNIFORGE is the platform. MIKEE is its general-purpose AI assistant. NEXUS coordinates conversation context, connected models, references and tools. Models generate language and explanations; the deterministic coordination code does not replace the model or train new model weights.

## Delivered behavior

- A bounded response brief retains the requested parts of a compound question, with guidance for comparisons and learner-appropriate explanations. This prepares a model request; it is not a guarantee that every answer is complete.
- The browser and server share artifact-intent rules. Explaining how to create a website stays in chat. Editing a report after creating a site does not attach that site's HTML. An unsolicited complete HTML example cannot replace the project. Incomplete website output preserves the previous accepted version.
- Earlier user requirements and recent conversation are selected from this project's last 100 retained messages. At most 12 turns and 9,000 characters are sent; early anchors use up to 1,200 characters each, other turns up to 1,800. Errors, privileged-role injections and repeated full website outputs are excluded. This is bounded context, not permanent or unlimited memory.
- A factual compound request can search at most two public queries derived from the current message. Each query reserves a separate unit of the existing shared daily research allowance. Results are interleaved, deduplicated and limited to four sources. A second-topic failure is disclosed without inventing references or discarding usable evidence.
- Private prompts and references to earlier conversation do not trigger automatic search. Attached notes disable automatic lookup; an explicit public research request can still use it. Conversation history and attached-note contents are never substituted into search queries.
- The existing arithmetic parser now also runs on the server. Pure supported expressions return an actual calculator result with `live:false` and no model call. A compound calculation/explanation supplies the observed calculator result to one model synthesis call. Arbitrary JavaScript and guessed word-problem expressions are not executed.
- Text responses with retrieved evidence are checked for citation identifiers outside the actual source list. Invalid identifiers are removed with a warning. Code and literal code blocks are preserved. This checks identifiers, not whether each claim is supported by its source; `factChecked` remains `false`.
- Optional response details list only resources actually used. The chat status says MIKEE replied, rather than implying that a successful API response proves factual accuracy.

All existing free-provider accounting, credential encryption, local knowledge, notes, calculators, symbolic mathematics, images, audio, SVG and code workspace features remain. No new paid service, dependency, additional planning-model call or automatic verifier-model call was added.

## Verification

The normal build passed 132 automated tests, retaining the concurrent upstream research-fallback tests and adding NEXUS integration cases. Tests cover original-context retention, private and note-based requests, balanced research and partial failures, per-query budget enforcement, observed calculations, code-safe citation checks and artifact preservation.

A 360 × 780 browser smoke test passed with explicit provider fixtures: website creation/editing; incomplete-output preservation; a full HTML explanation remaining in chat; image storage/placement/export; encrypted owner connection; and audio transcript drafts. Fixture responses do not establish live model quality.

The actual Cloudflare workerd runtime loaded the shared context/calculator modules and existing bindings. A request for `Calculate 18*24` returned `18*24 = 432`, `live:false`, using only the calculator. No external model was called during that runtime check. Wrangler deployment dry run also passed with the existing bindings and migrations intact.

Three real, keyless Pollinations API calls were made through the development Worker and coordinator, reporting `gpt-oss-20b`:

| Check | Observed result |
| --- | --- |
| Arithmetic + explanation + everyday example | Correctly returned 432, explained 360 + 72, and gave a sticker example in 87 words against a 90-word limit. |
| Earlier conversation requirements | Recalled Maple Kites and its zero-naira budget after 18 intervening fixture turns, in one sentence. |
| Supplied notes and missing information | Derived 10 kits from 20 sheets at two sheets each; cited the actual note names and said marker availability had not been recorded. |

The last two initial literal-string matchers did not account for narrow whitespace or the phrase “not been recorded”. The matchers were corrected against the saved responses and the responses reviewed manually; no replacement model calls were made. See [the sanitized acceptance record](verification/nexus-live-2026-10-25.json).

These are limited development acceptance samples, with visitor limiter fixtures for the real-model calls. They do not demonstrate broad model superiority, complete school syllabus coverage, or consistent production accuracy. Production URL inference remains separately unverified. Authenticated providers still require their owner's free account access and successful live checks.
