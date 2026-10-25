# MIKEE quality gate — public beta acceptance
**Purpose:** evaluate MIKEE as one general-purpose assistant, not by the number of AI connections. This is an acceptance checklist, **not** a report that every test already passed.

## What is implemented
- NEXUS parses the latest user goal and preserves a bounded number of earlier context turns.
- Deterministic calculators handle supported arithmetic and symbolic math without unnecessary model calls.
- Connected language models handle explanation, coding, writing and creation; the free pool can switch services.
- Search retrieves bounded public source snippets when research is selected. These snippets are not guaranteed true.
- Every retrieved-source answer now records which source identifiers the model **actually cited**. If no sources are cited, MIKEE must show a caveat; `factChecked` remains false in all cases. This check uses no extra model or paid service.

## Regression prompts and acceptance criteria
Use a **fresh conversation** for tests 1–8, then a continued conversation for tests 9–11. Avoid confidential data, and record the actual provider/model, source status and any errors. Real model tests consume the shared free allowance; automated fixtures do not.

| ID | Test prompt | Acceptance condition |
|---|---|---|
| 1 | Hello, MIKEE. What can you do? | Natural reply describing only implemented capabilities; no claim of complete internet access. |
| 2 | Explain why the sky looks blue in language a 13-year-old understands. | Accurate, understandable physical explanation; user level respected. |
| 3 | Who invented the point-contact transistor, and when was it first successfully demonstrated? | Distinguishes Bardeen and Brattain from Shockley's later contribution; distinguishes December 16 from December 23, 1947; links sources if retrieved. |
| 4 | Compare a diode and a transistor: purpose, terminals, and one example application each. | Both components and all three criteria addressed; avoids saying all transistors have a base/collector/emitter. |
| 5 | Differentiate 5x^4 - 3x^2 + 7. | Local symbolic result 20x^3 - 6x, with correct rule and explicit local-tool attribution. |
| 6 | Calculate 18*24, then explain the result with an everyday example. | Actual calculator value 432, correct explanation; live model used only for requested synthesis, if applicable. |
| 7 | Explain what the sentence “The teacher gave a book to the student who was reading a novel” means, and identify the clause. | The relative clause modifies “student”; the recipient phrase is not misrepresented as an ordinary double-object indirect object. |
| 8 | What is the current price of an item in my country? | Must identify missing item and location/details or limitations; must not invent live prices. |
| 9 | Remember for this conversation: our fictional project is called Maple Kites and its budget is zero naira. | Acknowledges within-chat context, not permanent account memory. |
| 10 | Give an affordable plan for that project in five steps. | Uses Maple Kites and zero-naira constraint from previous turns. |
| 11 | Actually, change step three only; keep the rest. | Updates precisely the requested part; no invented prior plan details. |
| 12 | Create a complete simple website for a stationery business. | Clearly distinguish produced HTML from live deployment; responsive, preview loads, export works, no unsolicited external scripts. |

## Evaluation method
Score each item 0–2: **0** = failed or fabricated; **1** = partially correct/unclear; **2** = correct, on-topic and properly qualified. Maximum = 24 points. A good score on one model or one day does not imply reliability across providers. Re-run when changing the router, model list, prompt guidance, citation handling or storage.

**Critical fail regardless of score:** pretending a request was researched when it wasn't; claiming a model/tool ran when it did not; performing a paid fallback; losing a saved project; breaking sandbox isolation; attributing specific historic facts to retrieved sources without checking whether those sources support them.

## Evidence interpretation
The terms **source retrieved**, **source cited**, and **fact independently verified** are different:
1. Retrieved: search returned a record with a link/snippet.
2. Cited: the reply names one or more retrieved source IDs, e.g. [1].
3. Verified: a fact has actually been checked against sufficiently authoritative, relevant evidence; MIKEE does not currently provide automatic independent claim-level verification.

The application's new citation-use check therefore warns about missing/invalid citations but **never** labels an answer fact-checked.

## Next engineering gates
- Validate production text responses through an intentional, limited live-owner test (not a fixture or merely a green build).
- Check source retrieval reliability on actual production egress, with a zero-cost fallback or explicit failure.
- Verify complete website export/restore with browser storage, test small Android layout and ensure owner API credentials remain server-side.
- Only invite broad public traffic after security, account recovery and shared resource usage protections have been tested.
