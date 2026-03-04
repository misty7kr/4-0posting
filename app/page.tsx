"use client";

import { useEffect, useState } from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type StudyHallGrade = "mid1" | "mid2" | "mid3" | "high1" | "high2" | "high3" | "repeat";
type StudyHallSeason =
  | "sh_evergreen" | "sh_winter" | "sh_mid1" | "sh_essay_select"
  | "sh_record_spring" | "sh_essay_check" | "sh_mock_june"
  | "sh_final1" | "sh_record_summer" | "sh_summer"
  | "sh_susi_prep" | "sh_mock_sep" | "sh_csat100"
  | "sh_mid2" | "sh_final2";
type StudyHallGoal = "naesin" | "csat" | "susi" | "repeat";
type SHTopicTemplate = {
  id: string; season: StudyHallSeason; grade: StudyHallGrade | "common";
  title: string; tags: string[];
};
type ApiMode = "openai" | "anthropic" | "hybrid";
type GenerateResult = { titles: string[]; body: string; hashtags: string[]; humanized?: boolean };

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const SH_GRADES: { value: StudyHallGrade; label: string }[] = [
  { value: "mid1",   label: "중1" },
  { value: "mid2",   label: "중2" },
  { value: "mid3",   label: "중3" },
  { value: "high1",  label: "고1" },
  { value: "high2",  label: "고2" },
  { value: "high3",  label: "고3" },
  { value: "repeat", label: "재수·N수" },
];

const SH_SEASONS: { value: StudyHallSeason; label: string }[] = [
  { value: "sh_evergreen",     label: "상시" },
  { value: "sh_winter",        label: "겨울방학" },
  { value: "sh_mid1",          label: "1학기 중간고사" },
  { value: "sh_essay_select",  label: "논술전형 선택" },
  { value: "sh_record_spring", label: "생기부·수행 (봄)" },
  { value: "sh_essay_check",   label: "논술 점검" },
  { value: "sh_mock_june",     label: "6월 모의고사" },
  { value: "sh_final1",        label: "1학기 기말고사" },
  { value: "sh_record_summer", label: "생기부·보고서 (여름)" },
  { value: "sh_summer",        label: "여름방학" },
  { value: "sh_susi_prep",     label: "수시접수 준비" },
  { value: "sh_mock_sep",      label: "9월 모의고사" },
  { value: "sh_csat100",       label: "수능 100일" },
  { value: "sh_mid2",          label: "2학기 중간고사" },
  { value: "sh_final2",        label: "2학기 기말·생기부 마감" },
];

const SH_GOALS: { value: StudyHallGoal; label: string }[] = [
  { value: "naesin", label: "내신" },
  { value: "csat",   label: "수능" },
  { value: "susi",   label: "수시" },
  { value: "repeat", label: "재수" },
];

const OPENAI_MODELS = [
  { value: "gpt-4.1-mini", label: "gpt-4.1-mini (기본 · 빠름 · 저렴)" },
  { value: "gpt-4.1",      label: "gpt-4.1 (고품질 · 중간 비용)" },
] as const;

const ANTHROPIC_MODELS = [
  { value: "claude-sonnet-4-5", label: "claude-sonnet-4-5 (기본 · 균형)" },
  { value: "claude-opus-4-5",   label: "claude-opus-4-5 (고품질 · 느림)" },
] as const;

type OpenAIModel    = (typeof OPENAI_MODELS)[number]["value"];
type AnthropicModel = (typeof ANTHROPIC_MODELS)[number]["value"];

const API_MODE_OPTIONS: { value: ApiMode; label: string; desc: string; detail: string; badge?: string }[] = [
  {
    value: "openai",
    label: "OpenAI만 사용",
    desc: "초안 생성 + 인간화 모두 GPT로 처리합니다.",
    detail: "OpenAI API Key 1개만 있으면 됩니다.",
  },
  {
    value: "anthropic",
    label: "Claude만 사용",
    desc: "초안 생성 + 인간화 모두 Claude로 처리합니다.",
    detail: "Anthropic API Key 1개만 있으면 됩니다.",
  },
  {
    value: "hybrid",
    label: "혼합 모드",
    desc: "GPT로 구조를 잡고, Claude로 문체를 다듬습니다.",
    detail: "OpenAI + Anthropic API Key 2개가 필요합니다.",
    badge: "고품질 추천",
  },
];

const SH_TOPIC_TEMPLATES: SHTopicTemplate[] = [
  // 상시 공통
  { id:"sh-ev-c-1",  season:"sh_evergreen", grade:"common", title:"학원을 3개 다니는데 성적이 그대로인 이유", tags:["academy-limit"] },
  { id:"sh-ev-c-2",  season:"sh_evergreen", grade:"common", title:"학원비는 많이 쓰는데 성적이 안 오르는 아이의 공통점", tags:["cost"] },
  { id:"sh-ev-c-3",  season:"sh_evergreen", grade:"common", title:"관리형독서실이 학원과 다른 결정적인 차이", tags:["diff"] },
  { id:"sh-ev-c-4",  season:"sh_evergreen", grade:"common", title:"학습인증이 없으면 공부해도 남는 게 없는 이유", tags:["cert"] },
  { id:"sh-ev-c-5",  season:"sh_evergreen", grade:"common", title:"교재 선정부터 학습인증까지, 관리형독서실이 하는 일", tags:["what-we-do"] },
  { id:"sh-ev-c-6",  season:"sh_evergreen", grade:"common", title:"전과목 질문을 바로 해결해주는 환경이 왜 중요한가", tags:["question"] },
  { id:"sh-ev-c-7",  season:"sh_evergreen", grade:"common", title:"공부 시간은 많은데 성적이 안 오르는 진짜 원인", tags:["root-cause"] },
  { id:"sh-ev-c-8",  season:"sh_evergreen", grade:"common", title:"학원 다녀와서 뭘 하는지가 더 중요한 이유", tags:["after-academy"] },
  { id:"sh-ev-c-9",  season:"sh_evergreen", grade:"common", title:"체크·재촉·응원이 성적을 바꾸는 이유", tags:["check-system"] },
  { id:"sh-ev-c-10", season:"sh_evergreen", grade:"common", title:"전과목 학습 관리, 혼자 하기 어려운 이유", tags:["all-subject"] },
  { id:"sh-ev-mid1", season:"sh_evergreen", grade:"mid1",   title:"중학교 첫 해, 공부 습관이 전부인 이유", tags:["habit"] },
  { id:"sh-ev-mid2", season:"sh_evergreen", grade:"mid2",   title:"중2가 공부 습관을 잡는 마지막 기회인 이유", tags:["habit"] },
  { id:"sh-ev-mid3", season:"sh_evergreen", grade:"mid3",   title:"고등 준비, 지금 관리형독서실이 필요한 이유", tags:["high-prep"] },
  { id:"sh-ev-h1",   season:"sh_evergreen", grade:"high1",  title:"고등 첫 해, 학원보다 관리가 먼저인 이유", tags:["management-first"] },
  { id:"sh-ev-h2",   season:"sh_evergreen", grade:"high2",  title:"고2가 가장 바쁜 학년인 이유", tags:["busy"] },
  { id:"sh-ev-h3",   season:"sh_evergreen", grade:"high3",  title:"고3 전과목 관리, 학원으로 감당이 안 되는 이유", tags:["high3"] },
  { id:"sh-ev-rep",  season:"sh_evergreen", grade:"repeat", title:"재수생 관리, 혼자 하면 안 되는 이유", tags:["repeat"] },
  // 겨울방학
  { id:"sh-wint-c-1",  season:"sh_winter", grade:"common", title:"겨울방학 루틴이 다음 학년 성적을 결정하는 이유", tags:["routine"] },
  { id:"sh-wint-c-2",  season:"sh_winter", grade:"common", title:"방학 교재 선정, 이렇게 하면 개학 후 달라집니다", tags:["textbook"] },
  { id:"sh-wint-c-3",  season:"sh_winter", grade:"common", title:"방학 특강보다 관리가 더 중요한 이유", tags:["management"] },
  { id:"sh-wint-mid1", season:"sh_winter", grade:"mid1",   title:"중1 겨울방학, 공부 습관 처음 잡는 방법", tags:["habit"] },
  { id:"sh-wint-mid2", season:"sh_winter", grade:"mid2",   title:"중2 겨울방학, 중3 되기 전에 잡아야 할 것들", tags:["prep"] },
  { id:"sh-wint-mid3", season:"sh_winter", grade:"mid3",   title:"중3 겨울방학, 고등 준비 무엇부터 시작할까", tags:["high-prep"] },
  { id:"sh-wint-h1",   season:"sh_winter", grade:"high1",  title:"고1 겨울방학, 고2 되기 전에 잡아야 할 것들", tags:["prep"] },
  { id:"sh-wint-h2",   season:"sh_winter", grade:"high2",  title:"고2 겨울방학, 본격 수험 준비 시작하는 방법", tags:["exam-prep"] },
  { id:"sh-wint-h3",   season:"sh_winter", grade:"high3",  title:"수능 끝난 겨울방학, 재수 결정 전에 확인할 것", tags:["decision"] },
  { id:"sh-wint-rep",  season:"sh_winter", grade:"repeat", title:"재수 시작 전 겨울방학, 혼자 하면 안 되는 이유", tags:["repeat"] },
  // 1학기 중간고사
  { id:"sh-mid1-c-1", season:"sh_mid1", grade:"common", title:"시험 전 학습인증이 점수와 직결되는 이유", tags:["cert"] },
  { id:"sh-mid1-c-2", season:"sh_mid1", grade:"common", title:"학습계획 없이 시험 준비하는 아이들의 공통점", tags:["plan"] },
  { id:"sh-mid1-m1",  season:"sh_mid1", grade:"mid1",   title:"중학교 첫 시험, 어디서부터 시작해야 할까", tags:["first"] },
  { id:"sh-mid1-m3",  season:"sh_mid1", grade:"mid3",   title:"중3 첫 시험, 지금 관리 시작해야 하는 이유", tags:["start"] },
  { id:"sh-mid1-h1",  season:"sh_mid1", grade:"high1",  title:"고등 첫 시험에서 무너지는 아이들의 공통점", tags:["fail"] },
  { id:"sh-mid1-h2",  season:"sh_mid1", grade:"high2",  title:"고2 중간고사, 작년보다 성적이 떨어지는 이유", tags:["drop"] },
  { id:"sh-mid1-h3",  season:"sh_mid1", grade:"high3",  title:"고3 시험 준비와 수능 공부 동시에 하는 방법", tags:["both"] },
  // 논술전형 선택
  { id:"sh-essay-h1",  season:"sh_essay_select", grade:"high1",  title:"고1 논술 준비, 지금 시작하면 뭐가 달라질까", tags:["early"] },
  { id:"sh-essay-h2",  season:"sh_essay_select", grade:"high2",  title:"고2 논술 준비, 지금이 골든타임인 이유", tags:["golden"] },
  { id:"sh-essay-h2b", season:"sh_essay_select", grade:"high2",  title:"논술 준비와 내신 관리를 동시에 하는 방법", tags:["both"] },
  { id:"sh-essay-h3",  season:"sh_essay_select", grade:"high3",  title:"고3 논술 준비, 지금 시작해도 되는 이유", tags:["late"] },
  { id:"sh-essay-rep", season:"sh_essay_select", grade:"repeat", title:"재수생 논술 준비, 작년과 달라져야 하는 이유", tags:["different"] },
  // 생기부 봄
  { id:"sh-recs-c-1", season:"sh_record_spring", grade:"common", title:"수행평가 시즌, 전과목 관리가 필요한 이유", tags:["all-subject"] },
  { id:"sh-recs-h1",  season:"sh_record_spring", grade:"high1",  title:"고1 생기부 첫 관리, 지금부터 챙겨야 하는 이유", tags:["first"] },
  { id:"sh-recs-h2",  season:"sh_record_spring", grade:"high2",  title:"고2 생기부, 지금 챙기지 않으면 후회하는 이유", tags:["regret"] },
  { id:"sh-recs-h3",  season:"sh_record_spring", grade:"high3",  title:"고3 수행평가, 수능 준비와 병행하는 방법", tags:["both"] },
  // 6월 모의고사
  { id:"sh-june-c-1", season:"sh_mock_june", grade:"common", title:"모의고사 성적표 받고 나서 제일 먼저 해야 할 것", tags:["first"] },
  { id:"sh-june-h1",  season:"sh_mock_june", grade:"high1",  title:"고1 첫 6월 모의고사, 결과보다 관리가 중요한 이유", tags:["management"] },
  { id:"sh-june-h2",  season:"sh_mock_june", grade:"high2",  title:"고2 6월 모의고사 이후 전과목 학습 방향 재설정", tags:["reset"] },
  { id:"sh-june-h3",  season:"sh_mock_june", grade:"high3",  title:"고3 6모 이후 남은 시간 전과목 관리하는 방법", tags:["time"] },
  { id:"sh-june-h3b", season:"sh_mock_june", grade:"high3",  title:"6모 결과가 기대 이하일 때 멘탈 잡는 방법", tags:["mental"] },
  { id:"sh-june-rep", season:"sh_mock_june", grade:"repeat", title:"재수생 6모, 지금 위치 점검하고 교재 재설정하는 방법", tags:["reset"] },
  // 여름방학
  { id:"sh-sum-c-1",  season:"sh_summer", grade:"common", title:"여름방학 루틴이 무너지는 아이들의 공통점", tags:["routine"] },
  { id:"sh-sum-c-2",  season:"sh_summer", grade:"common", title:"여름방학 전과목 교재 선정, 이렇게 하면 됩니다", tags:["textbook"] },
  { id:"sh-sum-mid1", season:"sh_summer", grade:"mid1",   title:"중1 여름방학, 공부 습관 다시 점검하는 방법", tags:["habit"] },
  { id:"sh-sum-mid2", season:"sh_summer", grade:"mid2",   title:"중2 여름방학, 중3 준비 미리 시작하는 이유", tags:["prep"] },
  { id:"sh-sum-mid3", season:"sh_summer", grade:"mid3",   title:"중3 여름방학, 고입 준비 본격적으로 시작하는 시기", tags:["high-prep"] },
  { id:"sh-sum-h1",   season:"sh_summer", grade:"high1",  title:"고1 여름방학, 2학기 내신 미리 준비하는 방법", tags:["prep"] },
  { id:"sh-sum-h2",   season:"sh_summer", grade:"high2",  title:"고2 여름방학, 수시 준비 마지막 골든타임", tags:["golden"] },
  { id:"sh-sum-h3",   season:"sh_summer", grade:"high3",  title:"고3 여름방학, 수능까지 집중관리 전략", tags:["csat"] },
  { id:"sh-sum-rep",  season:"sh_summer", grade:"repeat", title:"재수생 여름방학, 멘탈과 학습 동시에 관리하는 방법", tags:["mental"] },
  // 수시접수
  { id:"sh-susi-h2",  season:"sh_susi_prep", grade:"high2",  title:"고2 수시 준비, 생기부·내신 동시 관리 방법", tags:["both"] },
  { id:"sh-susi-h3",  season:"sh_susi_prep", grade:"high3",  title:"고3 수시 준비, 마지막 학습 점검 체크리스트", tags:["final-check"] },
  { id:"sh-susi-rep", season:"sh_susi_prep", grade:"repeat", title:"재수생 수시 준비, 작년과 달라야 하는 이유", tags:["different"] },
  // 9월 모의고사
  { id:"sh-sep-h1",  season:"sh_mock_sep", grade:"high1",  title:"고1 9월 모의고사, 결과보다 중요한 것", tags:["beyond-score"] },
  { id:"sh-sep-h2",  season:"sh_mock_sep", grade:"high2",  title:"고2 9모 이후 전과목 학습 재설정 방법", tags:["reset"] },
  { id:"sh-sep-h3",  season:"sh_mock_sep", grade:"high3",  title:"고3 9모 이후 수능까지 집중관리 전략", tags:["csat"] },
  { id:"sh-sep-h3b", season:"sh_mock_sep", grade:"high3",  title:"9모 결과가 기대 이하일 때 멘탈 잡고 공부하는 방법", tags:["mental"] },
  { id:"sh-sep-rep", season:"sh_mock_sep", grade:"repeat", title:"재수생 9모 이후 수능까지 마지막 스퍼트 관리법", tags:["final"] },
  // 수능 100일
  { id:"sh-csat-c-1", season:"sh_csat100", grade:"common", title:"수능 100일, 지금 해야 할 것과 하지 말아야 할 것", tags:["dos-donts"] },
  { id:"sh-csat-h3",  season:"sh_csat100", grade:"high3",  title:"수능 100일 전 멘탈 관리가 성적만큼 중요한 이유", tags:["mental"] },
  { id:"sh-csat-h3b", season:"sh_csat100", grade:"high3",  title:"수능 100일, 학원 끊고 관리형독서실로 오는 이유", tags:["why-studyhall"] },
  { id:"sh-csat-rep", season:"sh_csat100", grade:"repeat", title:"재수 수능 100일, 멘탈 관리가 전부인 이유", tags:["mental"] },
  // 2학기 중간고사
  { id:"sh-mid2-c-1", season:"sh_mid2", grade:"common", title:"2학기 중간, 1학기보다 성적이 떨어지는 이유", tags:["drop"] },
  { id:"sh-mid2-m1",  season:"sh_mid2", grade:"mid1",   title:"중1 2학기 중간고사, 1학기보다 잘 볼 수 있는 방법", tags:["improve"] },
  { id:"sh-mid2-h2",  season:"sh_mid2", grade:"high2",  title:"수능 준비와 내신 사이 균형 잡는 방법", tags:["balance"] },
  { id:"sh-mid2-h3",  season:"sh_mid2", grade:"high3",  title:"수능 준비하면서 내신도 챙겨야 하는 이유", tags:["both"] },
  // 2학기 기말
  { id:"sh-fin2-c-1", season:"sh_final2", grade:"common", title:"2학기 기말, 마무리가 다음 학년을 결정하는 이유", tags:["next-year"] },
  { id:"sh-fin2-m1",  season:"sh_final2", grade:"mid1",   title:"중1 마무리, 중2 준비 미리 시작하는 방법", tags:["prep"] },
  { id:"sh-fin2-m3",  season:"sh_final2", grade:"mid3",   title:"중3 마지막 내신, 고입 최종 점검 체크리스트", tags:["final"] },
  { id:"sh-fin2-h2",  season:"sh_final2", grade:"high2",  title:"고2 마지막 생기부, 수시 전 최종 점검", tags:["final"] },
  { id:"sh-fin2-h3",  season:"sh_final2", grade:"high3",  title:"수능 끝나고 재수 결정 전에 확인할 것", tags:["decision"] },
  { id:"sh-fin2-rep", season:"sh_final2", grade:"repeat", title:"재수 마무리, 수능 후 결과 점검과 다음 준비", tags:["review"] },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function autoSHSeason(): StudyHallSeason {
  const m = new Date().getMonth() + 1;
  if (m === 1 || m === 2) return "sh_winter";
  if (m === 3) return "sh_mid1";
  if (m === 4) return "sh_essay_select";
  if (m === 5) return "sh_record_spring";
  if (m === 6) return "sh_mock_june";
  if (m === 7) return "sh_final1";
  if (m === 8) return "sh_summer";
  if (m === 9) return "sh_mock_sep";
  if (m === 10) return "sh_mid2";
  if (m === 11) return "sh_csat100";
  if (m === 12) return "sh_final2";
  return "sh_evergreen";
}

function pickSHTopics(season: StudyHallSeason, grade: StudyHallGrade): string[] {
  const pool = SH_TOPIC_TEMPLATES.filter(
    (t) => (t.season === season || t.season === "sh_evergreen") &&
            (t.grade === "common" || t.grade === grade)
  );
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 12).map((t) => t.title);
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function Page() {
  // API 설정 (localStorage 저장)
  const [apiMode, setApiMode]               = useState<ApiMode>("openai");
  const [openaiKey, setOpenaiKey]           = useState("");
  const [anthropicKey, setAnthropicKey]     = useState("");
  const [openaiModel, setOpenaiModel]       = useState<OpenAIModel>("gpt-4.1-mini");
  const [anthropicModel, setAnthropicModel] = useState<AnthropicModel>("claude-sonnet-4-5");
  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [savedMsg, setSavedMsg]             = useState(false);

  // localStorage에서 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem("gwandok40_settings");
      if (saved) {
        const s = JSON.parse(saved);
        if (s.apiMode)       setApiMode(s.apiMode);
        if (s.openaiKey)     setOpenaiKey(s.openaiKey);
        if (s.anthropicKey)  setAnthropicKey(s.anthropicKey);
        if (s.openaiModel)   setOpenaiModel(s.openaiModel);
        if (s.anthropicModel) setAnthropicModel(s.anthropicModel);
      }
    } catch {}
  }, []);

  function saveSettings() {
    try {
      localStorage.setItem("gwandok40_settings", JSON.stringify({
        apiMode, openaiKey, anthropicKey, openaiModel, anthropicModel,
      }));
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 1500);
    } catch {}
  }

  // 관독 상태
  const [shRegion,  setShRegion]  = useState("세종");
  const [shGrade,   setShGrade]   = useState<StudyHallGrade>("high2");
  const [shSeason,  setShSeason]  = useState<StudyHallSeason>(autoSHSeason());
  const [shGoal,    setShGoal]    = useState<StudyHallGoal>("naesin");
  const [shTopicList, setShTopicList] = useState<string[]>([]);
  const [selectedSHTitle, setSelectedSHTitle] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [result,  setResult]  = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState<string | null>(null);
  const [copied,  setCopied]  = useState<string | null>(null);

  useEffect(() => {
    setShTopicList(pickSHTopics(shSeason, shGrade));
    setSelectedSHTitle(null);
    setResult(null);
    setErr(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shSeason, shGrade, refreshKey]);

  const pass1ModelValue = apiMode === "anthropic" ? anthropicModel : openaiModel;

  async function generate() {
    setErr(null); setResult(null);
    if ((apiMode === "openai" || apiMode === "hybrid") && !openaiKey.trim()) {
      setErr("OpenAI API Key를 입력하고 저장해줘."); return;
    }
    if ((apiMode === "anthropic" || apiMode === "hybrid") && !anthropicKey.trim()) {
      setErr("Anthropic API Key를 입력하고 저장해줘."); return;
    }
    if (!selectedSHTitle) { setErr("추천 주제를 하나 선택해줘."); return; }

    setLoading(true);
    try {
      const gradeLabel = SH_GRADES.find((g) => g.value === shGrade)?.label ?? shGrade;
      const goalLabel  = SH_GOALS.find((g) => g.value === shGoal)?.label ?? shGoal;
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiMode,
          openaiKey:    openaiKey.trim() || undefined,
          anthropicKey: anthropicKey.trim() || undefined,
          pass1Model:   pass1ModelValue,
          input: {
            region:     shRegion,
            shGrade:    gradeLabel,
            shGoal:     goalLabel,
            topicTitle: selectedSHTitle,
            intent:     "info",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`[${res.status}] ${data?.error ?? "생성 실패"}`);
      setResult(data as GenerateResult);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally { setLoading(false); }
  }

  // ─── 렌더 ───────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl p-6">

        {/* 헤더 */}
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">관리형독서실 4.0</h1>
            <p className="text-neutral-400 mt-1 text-sm">
              4.0 전용 블로그 포스팅 제작
            </p>
          </div>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm hover:bg-neutral-800 transition"
          >
            ⚙️ API 설정
          </button>
        </header>

        {/* API 설정 패널 */}
        {settingsOpen && (
          <div className="mb-6 rounded-2xl border border-neutral-700 bg-neutral-900/60 p-5">
            <h2 className="font-semibold mb-4">API 설정 (저장하면 브라우저에 기억됩니다)</h2>

            {/* 모드 선택 */}
            <div className="mb-4">
              <label className="block text-sm text-neutral-300 mb-2">API 모드</label>
              <div className="grid grid-cols-1 gap-2">
                {API_MODE_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => setApiMode(opt.value)}
                    className={["rounded-xl border px-3 py-2.5 text-left transition",
                      apiMode === opt.value ? "border-white bg-neutral-800" : "border-neutral-700 bg-neutral-950 hover:bg-neutral-900",
                    ].join(" ")}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{opt.label}</span>
                      {opt.badge && (
                        <span className="text-xs bg-amber-900/60 text-amber-300 border border-amber-700 rounded-md px-1.5 py-0.5">
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-400 mt-0.5">{opt.desc}</div>
                    {apiMode === opt.value && (
                      <div className="text-xs text-neutral-500 mt-1">{opt.detail}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-3 mb-4">
              {(apiMode === "openai" || apiMode === "hybrid") && (
                <div>
                  <label className="block text-sm text-neutral-300 mb-1">OpenAI API Key</label>
                  <input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..." className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2" />
                  {apiMode !== "hybrid" && (
                    <div className="mt-1">
                      <label className="block text-xs text-neutral-400 mb-1">Pass1 모델</label>
                      <select value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value as OpenAIModel)}
                        className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-1.5 text-sm">
                        {OPENAI_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
              {(apiMode === "anthropic" || apiMode === "hybrid") && (
                <div>
                  <label className="block text-sm text-neutral-300 mb-1">Anthropic API Key</label>
                  <input type="password" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..." className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2" />
                  {apiMode === "anthropic" && (
                    <div className="mt-1">
                      <label className="block text-xs text-neutral-400 mb-1">Pass1 모델</label>
                      <select value={anthropicModel} onChange={(e) => setAnthropicModel(e.target.value as AnthropicModel)}
                        className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-1.5 text-sm">
                        {ANTHROPIC_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button onClick={saveSettings}
              className="w-full rounded-xl bg-white text-black font-semibold py-2.5 hover:bg-neutral-200 transition">
              {savedMsg ? "✅ 저장됨" : "저장하기"}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* ── LEFT ── */}
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
            <h2 className="text-lg font-semibold mb-4">1) 설정</h2>

            {/* 지역 */}
            <div className="mb-4">
              <label className="block text-sm text-neutral-300 mb-1">지역</label>
              <input value={shRegion} onChange={(e) => setShRegion(e.target.value)}
                placeholder="예: 송도, 세종, 분당"
                className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2" />
            </div>

            {/* 학년 */}
            <div className="mb-4">
              <label className="block text-sm text-neutral-300 mb-1">학년</label>
              <div className="flex flex-wrap gap-2">
                {SH_GRADES.map((g) => (
                  <button key={g.value} onClick={() => setShGrade(g.value)}
                    className={["rounded-xl border px-3 py-1 text-sm transition",
                      shGrade === g.value ? "border-neutral-200 bg-neutral-800" : "border-neutral-800 bg-neutral-950 hover:bg-neutral-900"
                    ].join(" ")}>{g.label}</button>
                ))}
              </div>
            </div>

            {/* 목표 */}
            <div className="mb-4">
              <label className="block text-sm text-neutral-300 mb-1">목표</label>
              <div className="flex flex-wrap gap-2">
                {SH_GOALS.map((g) => (
                  <button key={g.value} onClick={() => setShGoal(g.value)}
                    className={["rounded-xl border px-3 py-1 text-sm transition",
                      shGoal === g.value ? "border-neutral-200 bg-neutral-800" : "border-neutral-800 bg-neutral-950 hover:bg-neutral-900"
                    ].join(" ")}>{g.label}</button>
                ))}
              </div>
            </div>

            {/* 시즌 */}
            <div className="mb-4">
              <label className="block text-sm text-neutral-300 mb-1">시즌</label>
              <select value={shSeason} onChange={(e) => setShSeason(e.target.value as StudyHallSeason)}
                className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2">
                {SH_SEASONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {/* 키워드 미리보기 */}
            <div className="mb-5 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
              핵심 키워드: <span className="text-white font-medium">
                {shRegion} {SH_GRADES.find(g => g.value === shGrade)?.label} 관리형독서실 {SH_GOALS.find(g => g.value === shGoal)?.label}
              </span>
            </div>

            {/* 추천 주제 */}
            <h2 className="text-lg font-semibold mb-3">2) 추천 주제</h2>
            <button
              onClick={() => { setSelectedSHTitle(null); setResult(null); setRefreshKey((k) => k + 1); }}
              className="mb-3 w-full rounded-xl border border-neutral-700 bg-neutral-900 py-2 text-sm text-neutral-200 hover:bg-neutral-800 transition"
            >추천 다시 뽑기</button>
            <div className="grid grid-cols-1 gap-2 mb-5">
              {shTopicList.map((title, i) => (
                <button key={i}
                  onClick={() => { setSelectedSHTitle(title); setResult(null); setErr(null); }}
                  className={["rounded-xl border px-3 py-3 text-left transition",
                    selectedSHTitle === title ? "border-neutral-200 bg-neutral-800" : "border-neutral-800 bg-neutral-950 hover:bg-neutral-900",
                  ].join(" ")}>
                  <div className="font-medium">{title}</div>
                </button>
              ))}
            </div>

            <p className="mt-2 text-xs text-neutral-500 text-center">
              AI 특성상 가끔 에러가 날 수 있어요. 그럴 땐 한 번 더 눌러주세요 😊
            </p>
            <button onClick={generate} disabled={loading}
              className="mt-2 w-full rounded-xl bg-white text-black font-semibold py-3 disabled:opacity-60">
              {loading ? "생성 중..." : "선택한 주제로 글 생성하기"}
            </button>
            {err && <div className="mt-3 text-sm text-red-300 whitespace-pre-line">{err}</div>}
          </section>

          {/* ── RIGHT ── */}
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
            <h2 className="text-lg font-semibold mb-4">3) 결과</h2>
            {!result ? (
              <div className="text-neutral-300 text-sm">
                왼쪽에서 주제를 선택하고 생성하면 여기에 결과가 표시됩니다.
              </div>
            ) : (
              <div className="space-y-5">
                <div className={["rounded-lg px-3 py-1.5 text-xs font-medium w-fit",
                  result.humanized
                    ? "bg-green-900/50 text-green-300 border border-green-800"
                    : "bg-neutral-800 text-neutral-400 border border-neutral-700",
                ].join(" ")}>
                  {result.humanized ? "인간화 완료" : "인간화 미적용 (Pass1 결과)"}
                </div>

                {/* 제목 */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">제목 (5개)</div>
                    <button onClick={async () => {
                        await copyToClipboard(result.titles.join("\n"));
                        setCopied("제목 복사됨"); setTimeout(() => setCopied(null), 1200);
                      }} className="text-sm rounded-lg border border-neutral-700 px-2 py-1 hover:bg-neutral-900">복사</button>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-neutral-100">
                    {result.titles.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>

                {/* 본문 */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">본문</div>
                    <button onClick={async () => {
                        await copyToClipboard(result.body);
                        setCopied("본문 복사됨"); setTimeout(() => setCopied(null), 1200);
                      }} className="text-sm rounded-lg border border-neutral-700 px-2 py-1 hover:bg-neutral-900">복사</button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-neutral-100 leading-6">{result.body}</pre>
                </div>

                {/* 해시태그 */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">해시태그 (20개)</div>
                    <button onClick={async () => {
                        await copyToClipboard(result.hashtags.join(" "));
                        setCopied("해시태그 복사됨"); setTimeout(() => setCopied(null), 1200);
                      }} className="text-sm rounded-lg border border-neutral-700 px-2 py-1 hover:bg-neutral-900">복사</button>
                  </div>
                  <div className="text-sm text-neutral-100">{result.hashtags.join(" ")}</div>
                </div>

                {copied && <div className="text-sm text-green-300">{copied}</div>}
              </div>
            )}
            <div className="mt-6 text-xs text-neutral-400">
              * API 키는 서버에 저장하지 않음. 요청 시에만 전송됨.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
