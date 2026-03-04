import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type ApiMode = "openai" | "anthropic" | "hybrid";

type Payload = {
  apiMode: ApiMode;
  openaiKey?: string;
  anthropicKey?: string;
  pass1Model?: string;
  input: {
    region: string;
    shGrade?: string;
    shGoal?: string;
    topicTitle: string;
    intent?: string;
  };
};

type BlogPostOutput = {
  titles: string[];
  body: string;
  hashtags: string[];
};

type ValidationDetail = {
  titlesOk: boolean;
  bodyOk: boolean;
  bodyLength: number;
  hashtagsOk: boolean;
  keywordOk: boolean;
  faqOk: boolean;
  headingsOk: boolean;
  firstParaChecked: string;
};

type ParseResult =
  | { success: true; data: BlogPostOutput }
  | { success: false; reason: string; detail?: ValidationDetail };

type LLMResult = { ok: boolean; text: string; status: number };

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const OPENAI_PASS1_DEFAULT    = "gpt-4.1-mini";
const ANTHROPIC_PASS1_DEFAULT = "claude-sonnet-4-5";
const OPENAI_PASS2_MODEL      = "gpt-4.1-mini";
const ANTHROPIC_PASS2_MODEL   = "claude-haiku-4-5";

const MIN_BODY_LENGTH    = 1100;
const MAX_BODY_LENGTH    = 4000;
const MAX_FIRST_PARA_LEN = 150;

// ─────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `
당신은 관리형독서실 전문 네이버 블로그 콘텐츠 작가입니다.
관리형독서실은 학원이 아닙니다. 학생이 스스로 공부하면서 전과목 학습 관리, 교재 선정, 학습인증, 질문 해결을 지원받는 공간입니다.

[핵심 원칙]
- 입시 전략·수능 최저·전형 분석 등 정확한 수치가 필요한 내용은 절대 쓰지 않는다.
- 학습 관리, 공부 습관, 루틴, 멘탈, 환경, 교재 선정에 집중한다.
- 학부모의 현실적인 고민에 공감하며 답한다.

[문장 규칙]
- 자연스러운 구어체: "~거든요", "~더라고요", "~해요"
- AI 냄새 절대 금지: "먼저~, 또한~, 마지막으로~" 나열 구조 사용 금지
- 이모지(emoji) 사용 절대 금지
- 과장·보장 표현 금지

[구조 — 반드시 지킬 것]
- 소제목: 줄 맨 앞 【소제목】 겹낫표 형식, 반드시 4~6개 (【】 이외 형식 사용 금지)
- FAQ: Q: / A: 형식, 반드시 3~4쌍. 각 A: 답변 3~4문장 이상.
- 본문 길이: 반드시 1500자 이상 2800자 이하
  → 출력 전 글자 수를 반드시 세어볼 것. 1500자 미만이면 각 소제목 아래 내용을 보강 후 재출력.
  → 각 소제목 아래 최소 3~5문장 이상 작성.

[출력 전 자가 체크리스트 — 반드시 확인 후 출력]
☑ 소제목(【소제목】 형식)이 4~6개인가?
☑ FAQ (Q:/A:) 쌍이 3~4개인가?
☑ 본문이 1500자 이상인가? (미만이면 보강 후 재출력)
☑ 핵심 키워드가 첫 문단에 정확히 1회 포함됐는가?
☑ 해시태그가 정확히 20개인가?

[출력 형식]
반드시 아래 JSON만 출력. 마크다운 코드블록(\`\`\`) 포함 그 외 텍스트 절대 금지:
{
  "titles": [string 5개],
  "body": "본문 (줄바꿈 \\n 유지)",
  "hashtags": [string 20개]
}

[제목 규칙]
- 5개 모두 관리형독서실 관련 키워드 포함
- 숫자 포함 시 클릭률 상승
- 학부모가 공감할 현실적인 표현 사용
  `.trim();
}

function buildUserPrompt(input: Payload["input"]): string {
  const gradeLabel = input.shGrade ?? "고2";
  const goalLabel  = input.shGoal  ?? "내신";
  const coreKw     = `${input.region} ${gradeLabel} 관리형독서실 ${goalLabel}`;

  return `
[입력 정보]
지역: ${input.region}
대상 학년: ${gradeLabel}
목표: ${goalLabel}
핵심 키워드: ${coreKw}
주제: ${input.topicTitle}

[작성 지침]
1. 첫 문단(2~3문장): 핵심 키워드 "${coreKw}"를 자연스럽게 1회 포함. 150자 이내.
2. 본문: 관리형독서실의 학습관리·교재선정·학습인증·질문해결·루틴 관리 관점에서 작성.
3. ${gradeLabel} 학생과 학부모의 현실적 고민을 중심으로 구체적으로 서술.
4. 소제목 【소제목】 겹낫표 형식으로 반드시 4~6개. 각 소제목 아래 3~5문장 이상 작성.
5. FAQ Q:/A: 형식으로 반드시 3~4쌍. 각 A: 답변 3~4문장 이상 구체적으로 작성.
6. 해시태그: #${input.region}관리형독서실, #${input.region}독서실, #${gradeLabel}독서실 등 지역+학년+관독 조합 포함.
7. 본문 전체 1500자 이상 반드시 작성. 출력 전 글자 수를 세어 1500자 미만이면 내용 보강 후 재출력.

JSON만 출력.
  `.trim();
}

function buildRepairPrompt(
  input: Payload["input"],
  detail: ValidationDetail,
  previousOutput: string
): string {
  const gradeLabel = input.shGrade ?? "고2";
  const goalLabel  = input.shGoal  ?? "내신";
  const coreKeyword = `${input.region} ${gradeLabel} 관리형독서실 ${goalLabel}`.replace(/\s+/g, " ").trim();

  const failures: string[] = [];
  if (!detail.keywordOk)
    failures.push(`❌ 키워드/첫 문단 오류: 첫 문단(빈 줄 이전 전체)이 120자 이내여야 하고, "${coreKeyword}"가 정확히 1회 있어야 합니다.\n   현재 첫 문단: "${detail.firstParaChecked}"`);
  if (!detail.faqOk)
    failures.push(`❌ FAQ 오류: (Q:/A:) 쌍이 순서대로 정확히 3세트여야 합니다.`);
  if (!detail.headingsOk)
    failures.push(`❌ 소제목 오류: 줄 맨 앞의 【소제목】 형식 소제목이 4~6개여야 합니다.`);
  if (!detail.bodyOk)
    failures.push(`❌ 분량 오류: 본문이 ${detail.bodyLength}자입니다. 1500자 이상이 되어야 합니다.`);
  if (!detail.hashtagsOk)
    failures.push(`❌ 해시태그 오류: 정확히 20개이고 모두 #으로 시작해야 합니다.`);

  return `
아래는 이전에 생성한 블로그 글 초안입니다. 검증 결과 다음 항목이 실패했습니다:

${failures.join("\n")}

아래 초안을 수정해서 실패 항목만 고쳐주세요. 나머지는 그대로 유지하세요.
수정 후 반드시 자체검사를 다시 수행하고, 모든 항목이 통과된 경우에만 JSON을 출력하세요.

[이전 초안]
${previousOutput}

반드시 JSON만 출력하세요.
  `.trim();
}

function buildHumanizeSystemPrompt(): string {
  return `
당신은 한국어 블로그 글을 자연스러운 사람 말투로 다듬는 에디터입니다.

[인간화 구체 지침 — 반드시 따를 것]
- 본문이 1500자 미만이면: 각 소제목 아래에 독자 상황 예시, 구체적 팁, 현장감 있는 문장을 추가해서 1500자 이상으로 채울 것
- "~하는 것이 중요합니다" → "이게 생각보다 차이가 크더라고요" 식으로 구어체 전환
- 대칭 문장("A이고, B입니다") → 한 문장을 끊어서 리듬 변화 주기
- 소제목 아래 첫 문장은 반드시 독자 상황 공감 또는 핵심 포인트로 시작
- 짧은 문장(10자 내외)과 긴 문장을 섞어 단조로운 리듬 깨기
- "먼저~, 또한~, 마지막으로~" 나열 패턴이 있으면 자연스러운 흐름으로 풀어쓰기

[절대 변경 금지]
- 소제목 구조 (【소제목】 형식, 줄 맨 앞, 4~6개)
- FAQ 형식 ((Q:/A:) 쌍 순서, 3세트)
- 핵심 키워드 (첫 문단 포함, 변형 금지)
- 첫 문단 120자 이내 조건
- 해시태그 목록 (20개, 순서·내용 그대로)
- 사실 정보
- 전체 분량: 원본이 1500자 이상이면 ±10% 이내 유지

[자체검사 — 출력 전 확인]
☑ 본문이 1500자 이상인가?
☑ 첫 문단 120자 이내, 핵심 키워드 정확히 1회 유지됐는가?
☑ 소제목 【】 형식 줄 맨 앞 4~6개 유지됐는가?
☑ FAQ (Q:/A:) 쌍 3세트 유지됐는가?
☑ 해시태그 20개 유지됐는가?

[출력 형식]
{
  "titles": [string 5개],
  "body": "인간화된 본문 (줄바꿈 \\n 유지)",
  "hashtags": [string 20개]
}
JSON 외 텍스트 절대 금지.
  `.trim();
}

function buildHumanizeUserPrompt(draft: BlogPostOutput): string {
  const bodyLength = draft.body?.length ?? 0;
  const lengthNote = bodyLength < 1500
    ? `\n\n⚠️ 현재 본문이 ${bodyLength}자입니다. 1500자 이상이 되도록 각 소제목 아래 내용을 보강해주세요.`
    : `\n\n현재 본문 길이: ${bodyLength}자 (적정 범위).`;
  return `아래 블로그 글 초안을 인간화해주세요.${lengthNote}\n\n${JSON.stringify(draft, null, 2)}`;
}

// ─────────────────────────────────────────────
// LLM Callers
// ─────────────────────────────────────────────

async function callOpenAI(
  apiKey: string, model: string,
  systemPrompt: string, userPrompt: string,
  options: { temperature?: number } = {}
): Promise<LLMResult> {
  const isGpt5 = model.startsWith("gpt-5");
  const payload: Record<string, unknown> = {
    model,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    text: {
      format: {
        type: "json_schema", name: "naver_blog_post", strict: true,
        schema: {
          type: "object", additionalProperties: false,
          required: ["titles", "body", "hashtags"],
          properties: {
            titles:   { type: "array", items: { type: "string" }, minItems: 5, maxItems: 5 },
            body:     { type: "string" },
            hashtags: { type: "array", items: { type: "string" }, minItems: 20, maxItems: 20 },
          },
        },
      },
    },
  };
  if (isGpt5) payload.reasoning = { effort: "low" };
  else payload.temperature = options.temperature ?? 0.75;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, text: await res.text(), status: res.status };
}

async function callAnthropic(
  apiKey: string, model: string,
  systemPrompt: string, userPrompt: string,
  options: { temperature?: number } = {}
): Promise<LLMResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model, max_tokens: 4096,
      temperature: options.temperature ?? 0.75,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  return { ok: res.ok, text: await res.text(), status: res.status };
}

// ─────────────────────────────────────────────
// Output extraction
// ─────────────────────────────────────────────

function extractText(rawResponse: string, isAnthropic: boolean): string | undefined {
  let data: unknown;
  try { data = JSON.parse(rawResponse); } catch { return undefined; }
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;

  if (isAnthropic) {
    if (Array.isArray(d.content)) {
      for (const block of d.content as any[]) {
        if (block?.type === "text" && typeof block?.text === "string" && block.text.trim())
          return block.text;
      }
    }
    return undefined;
  }

  if (typeof d.output_text === "string" && d.output_text.trim()) return d.output_text;
  if (Array.isArray(d.output)) {
    for (const block of d.output as any[]) {
      if (Array.isArray(block?.content)) {
        for (const item of block.content as any[]) {
          if ((item?.type === "output_text" || item?.type === "text") &&
              typeof item?.text === "string" && item.text.trim())
            return item.text;
        }
      }
    }
  }
  if (Array.isArray(d.choices)) {
    const c = (d.choices as any[])?.[0]?.message?.content;
    if (typeof c === "string" && c.trim()) return c;
  }
  return undefined;
}

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

function extractFirstParagraph(body: string): string {
  return body.split(/\n\s*\n/)[0] ?? "";
}

function countHeadings(body: string): number {
  return (body.match(/^【[^】]+】/gm) ?? []).length;
}

function validateFaqPairs(body: string): boolean {
  const segments = body.split(/^Q\s*:/m);
  if (segments.length !== 4) return false;
  return segments.slice(1).every((seg) => {
    const firstA = seg.search(/^A\s*:/m);
    if (firstA === -1) return false;
    const nextQ = seg.search(/^Q\s*:/m);
    if (nextQ !== -1 && firstA > nextQ) return false;
    return true;
  });
}

function extractJsonFromText(rawText: string): string | null {
  const codeBlock = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlock?.[1]) {
    const candidate = codeBlock[1].trim();
    if (candidate.startsWith("{")) return candidate;
  }
  const first = rawText.indexOf("{");
  const last  = rawText.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) return rawText.slice(first, last + 1);
  return null;
}

function parseAndValidate(rawText: string, coreKeyword: string): ParseResult {
  const extracted = extractJsonFromText(rawText);
  if (!extracted) return { success: false, reason: "JSON parse failed: no JSON object found" };
  let parsed: unknown;
  try { parsed = JSON.parse(extracted); } catch { return { success: false, reason: "JSON parse failed" }; }
  if (!parsed || typeof parsed !== "object") return { success: false, reason: "Not an object" };

  const p = parsed as any;

  const okTitles =
    Array.isArray(p.titles) && p.titles.length === 5 &&
    p.titles.every((t: any) => typeof t === "string" && t.trim());

  const bodyLength = typeof p.body === "string" ? p.body.trim().length : 0;
  const okBody = bodyLength >= MIN_BODY_LENGTH && bodyLength <= MAX_BODY_LENGTH;

  const firstPara = typeof p.body === "string" ? extractFirstParagraph(p.body) : "";
  const okFirstParaLen = firstPara.length <= MAX_FIRST_PARA_LEN;
  const kwNorm   = coreKeyword.replace(/\s/g, "");
  const paraNorm = firstPara.replace(/\s/g, "");
  const regex = new RegExp(kwNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  const keywordCount = (paraNorm.match(regex) ?? []).length;
  const okKeyword = okFirstParaLen && keywordCount === 1;

  const okTags =
    Array.isArray(p.hashtags) && p.hashtags.length === 20 &&
    p.hashtags.every((h: any) => typeof h === "string" && h.trim().startsWith("#"));

  const okFaq      = typeof p.body === "string" ? validateFaqPairs(p.body) : false;
  const headingCnt = typeof p.body === "string" ? countHeadings(p.body) : 0;
  const okHeadings = headingCnt >= 4 && headingCnt <= 6;

  const detail: ValidationDetail = {
    titlesOk: okTitles, bodyOk: okBody, bodyLength,
    hashtagsOk: okTags, keywordOk: okKeyword,
    faqOk: okFaq, headingsOk: okHeadings,
    firstParaChecked: firstPara,
  };

  if (!okTitles || !okBody || !okTags || !okKeyword || !okFaq || !okHeadings)
    return { success: false, reason: "Validation failed", detail };

  return { success: true, data: p as BlogPostOutput };
}

// ─────────────────────────────────────────────
// POST Handler
// ─────────────────────────────────────────────

export async function POST(req: Request) {
  let body: Payload;
  try { body = (await req.json()) as Payload; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { apiMode = "openai", openaiKey, anthropicKey, pass1Model, input } = body;

  if (!input?.topicTitle?.trim()) return NextResponse.json({ error: "Missing topicTitle" }, { status: 400 });
  if (!input?.region?.trim())     return NextResponse.json({ error: "Missing region" }, { status: 400 });

  if ((apiMode === "openai" || apiMode === "hybrid") && !openaiKey?.trim())
    return NextResponse.json({ error: "OpenAI API Key가 필요합니다" }, { status: 400 });
  if ((apiMode === "anthropic" || apiMode === "hybrid") && !anthropicKey?.trim())
    return NextResponse.json({ error: "Anthropic API Key가 필요합니다" }, { status: 400 });

  const oKey = openaiKey?.trim() ?? "";
  const aKey = anthropicKey?.trim() ?? "";

  const pass1IsAnthropic = apiMode === "anthropic";
  const resolvedPass1Model = pass1Model?.trim() ||
    (pass1IsAnthropic ? ANTHROPIC_PASS1_DEFAULT : OPENAI_PASS1_DEFAULT);

  const gradeLabel  = input.shGrade ?? "고2";
  const goalLabel   = input.shGoal  ?? "내신";
  const coreKeyword = `${input.region} ${gradeLabel} 관리형독서실 ${goalLabel}`.replace(/\s+/g, " ").trim();

  const sysPr = buildSystemPrompt();
  const usrPr = buildUserPrompt(input);

  async function runPass1(temperature: number, userPrompt: string): Promise<LLMResult> {
    return pass1IsAnthropic
      ? callAnthropic(aKey, resolvedPass1Model, sysPr, userPrompt, { temperature })
      : callOpenAI(oKey, resolvedPass1Model, sysPr, userPrompt, { temperature });
  }

  function tryParse(res: LLMResult): ParseResult {
    const text = extractText(res.text, pass1IsAnthropic);
    if (!text) return { success: false, reason: "No output text extracted" };
    return parseAndValidate(text, coreKeyword);
  }

  // Pass1 첫 시도
  let pass1Res: LLMResult;
  try { pass1Res = await runPass1(0.75, usrPr); }
  catch (e: any) {
    return NextResponse.json({ error: `[Pass1] Upstream failed: ${e?.message ?? "unknown"}` }, { status: 502 });
  }
  if (!pass1Res.ok) {
    let detail: unknown = pass1Res.text;
    try { detail = JSON.parse(pass1Res.text); } catch {}
    return NextResponse.json({ error: `[Pass1] API error (${pass1Res.status})`, detail }, { status: 502 });
  }

  let pass1Result = tryParse(pass1Res);

  // 실패 시 Repair 재시도
  if (!pass1Result.success) {
    const prevText = extractText(pass1Res.text, pass1IsAnthropic) ?? "";
    const repairPrompt = pass1Result.detail && prevText
      ? buildRepairPrompt(input, pass1Result.detail, prevText)
      : usrPr;
    try {
      const retryRes = await runPass1(0.4, repairPrompt);
      if (retryRes.ok) pass1Result = tryParse(retryRes);
    } catch {}
  }

  if (!pass1Result.success)
    return NextResponse.json(
      { error: `[Pass1] ${pass1Result.reason}`, detail: pass1Result.detail },
      { status: 500 }
    );

  const draft = pass1Result.data;

  // Pass2 인간화
  const pass2IsAnthropic = apiMode === "anthropic" || apiMode === "hybrid";
  const hSys = buildHumanizeSystemPrompt();
  const hUsr = buildHumanizeUserPrompt(draft);

  try {
    const pass2Res = pass2IsAnthropic
      ? await callAnthropic(aKey, ANTHROPIC_PASS2_MODEL, hSys, hUsr)
      : await callOpenAI(oKey, OPENAI_PASS2_MODEL, hSys, hUsr);

    if (!pass2Res.ok) return NextResponse.json({ ...draft, humanized: false });

    const pass2Text = extractText(pass2Res.text, pass2IsAnthropic);
    if (!pass2Text) return NextResponse.json({ ...draft, humanized: false });

    const pass2Result = parseAndValidate(pass2Text, coreKeyword);
    if (!pass2Result.success) return NextResponse.json({ ...draft, humanized: false });

    return NextResponse.json({ ...pass2Result.data, humanized: true });
  } catch {
    return NextResponse.json({ ...draft, humanized: false });
  }
}
