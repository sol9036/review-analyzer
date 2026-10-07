'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  Flame,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  Bot,
  Calendar,
  Layers,
  Search,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Info,
} from 'lucide-react';

interface ReviewRow {
  review_no: number;
  written_on: string;
  rating: number;
  review_text: string;
  sentiment?: '긍정' | '부정' | '중립' | '광고';
  categories?: string;
  improvement_request?: string;
  is_safety_issue?: boolean;
  model_used?: string;
}

interface SafetyData {
  topReasons: Array<{ rank: number; reason: string; count: number; percentage: number }>;
  totalTargetCleaners: number;
  totalIncidents: number;
  cachedAt?: string;
}

interface HistoryItem {
  analyzed_on: string;
  totalCount: number;
  validCount: number;
  negativeCount: number;
  negativeRate: string;
  safetyCount: number;
  model_used: string;
}

export default function DashboardPage() {
  // File & Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedReviews, setParsedReviews] = useState<ReviewRow[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [saveToDb, setSaveToDb] = useState(true);

  // Current Analysis Results
  const [analyzedReviews, setAnalyzedReviews] = useState<ReviewRow[]>([]);
  const [responseModel, setResponseModel] = useState<string | null>(null);
  const [analyzedDate, setAnalyzedDate] = useState<string | null>(null);

  // Safety Data (한국소비자원 API)
  const [safetyData, setSafetyData] = useState<SafetyData | null>(null);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyError, setSafetyError] = useState<string | null>(null);

  // History State
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Manual "우리가 고칠 것" 3줄 결론
  const [actionItem1, setActionItem1] = useState('');
  const [actionItem2, setActionItem2] = useState('');
  const [actionItem3, setActionItem3] = useState('');
  const [copiedAction, setCopiedAction] = useState(false);

  // Filters for table
  const [filterSentiment, setFilterSentiment] = useState<string>('all');
  const [filterSafetyOnly, setFilterSafetyOnly] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  // Initial Data Fetching
  useEffect(() => {
    fetchSafetyData();
    fetchHistory();

    // Load saved manual action items from localStorage
    const saved1 = localStorage.getItem('harusalim_action_1') || '';
    const saved2 = localStorage.getItem('harusalim_action_2') || '';
    const saved3 = localStorage.getItem('harusalim_action_3') || '';
    setActionItem1(saved1);
    setActionItem2(saved2);
    setActionItem3(saved3);
  }, []);

  // Save manual action items to localStorage
  const handleActionChange = (index: number, val: string) => {
    if (index === 1) {
      setActionItem1(val);
      localStorage.setItem('harusalim_action_1', val);
    } else if (index === 2) {
      setActionItem2(val);
      localStorage.setItem('harusalim_action_2', val);
    } else if (index === 3) {
      setActionItem3(val);
      localStorage.setItem('harusalim_action_3', val);
    }
  };

  const copyActionPlan = () => {
    const text = `[생활가전 하루살림 - 제품 개선 3대 실행 과제]\n1. ${actionItem1 || '(미입력)'}\n2. ${actionItem2 || '(미입력)'}\n3. ${actionItem3 || '(미입력)'}`;
    navigator.clipboard.writeText(text);
    setCopiedAction(true);
    setTimeout(() => setCopiedAction(false), 2000);
  };

  const fetchSafetyData = async () => {
    setSafetyLoading(true);
    setSafetyError(null);
    try {
      const res = await fetch('/api/safety');
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSafetyError('불러오지 못했습니다');
      } else {
        setSafetyData(data);
      }
    } catch {
      setSafetyError('불러오지 못했습니다');
    } finally {
      setSafetyLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (!res.ok || !data.success) {
        setHistoryError('불러오지 못했습니다');
      } else {
        setHistoryList(data.history || []);
      }
    } catch {
      setHistoryError('불러오지 못했습니다');
    } finally {
      setHistoryLoading(false);
    }
  };

  // CSV File Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setAnalysisError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const raw = results.data as Record<string, any>[];
          const mapped: ReviewRow[] = raw.map((row, idx) => {
            // Flexible column detection (Korean / English)
            const review_no = Number(row['번호'] || row['review_no'] || row['no'] || idx + 1);
            const written_on = String(row['작성일'] || row['written_on'] || row['date'] || '').trim();
            const rating = Number(row['별점'] || row['rating'] || row['score'] || 0);
            const review_text = String(row['리뷰'] || row['review_text'] || row['review'] || row['content'] || '').trim();

            return {
              review_no,
              written_on,
              rating,
              review_text,
            };
          }).filter(r => r.review_text.length > 0);

          if (mapped.length === 0) {
            setAnalysisError('CSV 파일에 유효한 리뷰 데이터가 없습니다.');
          } else {
            setParsedReviews(mapped);
          }
        } catch {
          setAnalysisError('CSV 파일 형식을 읽는 중 오류가 발생했습니다.');
        }
      },
      error: () => {
        setAnalysisError('CSV 파일을 파싱하지 못했습니다.');
      },
    });
  };

  // Run Analysis Handler
  const handleRunAnalysis = async () => {
    if (parsedReviews.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviews: parsedReviews,
          saveToDb,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setAnalysisError(data.error === '불러오지 못했습니다' ? '불러오지 못했습니다' : (data.detail || '불러오지 못했습니다'));
        setAnalyzedReviews([]);
        setResponseModel(null);
      } else {
        setAnalyzedReviews(data.results || []);
        setResponseModel(data.modelUsed || null);
        setAnalyzedDate(data.analyzedOn || new Date().toISOString().split('T')[0]);
        // Refresh history
        fetchHistory();
      }
    } catch {
      setAnalysisError('불러오지 못했습니다');
      setAnalyzedReviews([]);
      setResponseModel(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Statistics Calculations (당회차 분석 통계)
  const stats = useMemo(() => {
    if (analyzedReviews.length === 0) return null;

    const total = analyzedReviews.length;
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    let ad = 0;
    let safetyCount = 0;

    const categoryCounts: Record<string, number> = {};
    const improvementList: Array<{ review_no: number; text: string; category: string }> = [];
    const safetyList: Array<ReviewRow> = [];

    analyzedReviews.forEach((r) => {
      if (r.sentiment === '긍정') positive++;
      else if (r.sentiment === '부정') negative++;
      else if (r.sentiment === '중립') neutral++;
      else if (r.sentiment === '광고') ad++;

      if (r.is_safety_issue) {
        safetyCount++;
        safetyList.push(r);
      }

      if (r.improvement_request && r.improvement_request.trim()) {
        improvementList.push({
          review_no: r.review_no,
          text: r.improvement_request,
          category: r.categories || '일반',
        });
      }

      // Categories split
      if (r.categories) {
        const cats = r.categories.split(',').map((c) => c.trim()).filter(Boolean);
        cats.forEach((c) => {
          categoryCounts[c] = (categoryCounts[c] || 0) + 1;
        });
      }
    });

    const validReviews = total - ad; // 체험단/광고는 집계에서 제외
    const positiveRate = validReviews > 0 ? Math.round((positive / validReviews) * 100) : 0;
    const negativeRate = validReviews > 0 ? Math.round((negative / validReviews) * 100) : 0;
    const neutralRate = validReviews > 0 ? Math.round((neutral / validReviews) * 100) : 0;

    const sortedCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }));

    return {
      total,
      validReviews,
      positive,
      negative,
      neutral,
      ad,
      positiveRate,
      negativeRate,
      neutralRate,
      safetyCount,
      sortedCategories,
      improvementList,
      safetyList,
    };
  }, [analyzedReviews]);

  // Filtered reviews for detail table
  const filteredReviews = useMemo(() => {
    return analyzedReviews.filter((r) => {
      if (filterSentiment !== 'all' && r.sentiment !== filterSentiment) {
        return false;
      }
      if (filterSafetyOnly && !r.is_safety_issue) {
        return false;
      }
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const textMatch = r.review_text.toLowerCase().includes(kw);
        const catMatch = r.categories?.toLowerCase().includes(kw);
        const reqMatch = r.improvement_request?.toLowerCase().includes(kw);
        if (!textMatch && !catMatch && !reqMatch) return false;
      }
      return true;
    });
  }, [analyzedReviews, filterSentiment, filterSafetyOnly, searchKeyword]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-100">
              하
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  하루살림 마케팅
                </span>
                <span className="text-xs text-slate-400">클린핏 미니 리뷰 분석 센터</span>
              </div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                무선 청소기 리뷰 분석 & 소비자원 안전 데이터 대시보드
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {responseModel && (
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                <Bot className="w-3.5 h-3.5" />
                <span>응답 AI 모델: <strong>{responseModel}</strong></span>
              </div>
            )}
            <div className="text-right hidden sm:block">
              <span className="text-xs text-slate-400 block">시스템 연동</span>
              <span className="text-xs font-medium text-slate-700">Supabase & 공공데이터</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Upload & Run Action Section */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-600" />
                (1) 리뷰 CSV 파일 업로드 및 전체 일괄 분석
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                쇼핑몰에서 다운로드받은 리뷰 CSV 파일을 업로드하면, 한 번의 Gemini API 요청으로 전체 리뷰를 일괄 심층 분석합니다.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  checked={saveToDb}
                  onChange={(e) => setSaveToDb(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Supabase DB에 자동 저장</span>
              </label>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-8">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-5 cursor-pointer bg-slate-50/50 hover:bg-indigo-50/30 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white rounded-lg shadow-sm border border-slate-200 text-indigo-600">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {selectedFile ? selectedFile.name : '분석할 CSV 파일을 클릭하여 선택하거나 드래그하세요'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {parsedReviews.length > 0
                        ? `인식된 리뷰: 총 ${parsedReviews.length.toLocaleString()}건 (번호, 작성일, 별점, 리뷰 열 지원)`
                        : '형식: 번호, 작성일, 별점, 리뷰 (클린핏 미니 100건, 시험용 20건 등)'}
                    </p>
                  </div>
                </div>
              </label>
            </div>

            <div className="md:col-span-4 flex flex-col gap-2">
              <button
                onClick={handleRunAnalysis}
                disabled={isAnalyzing || parsedReviews.length === 0}
                className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all ${
                  isAnalyzing || parsedReviews.length === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 hover:shadow-md'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Gemini 전수 분석 중 ({parsedReviews.length}건)...</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4" />
                    <span>전체 일괄 분석 실행 {parsedReviews.length > 0 && `(${parsedReviews.length}건)`}</span>
                  </>
                )}
              </button>
              {analysisError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{analysisError}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Overview Stats & Cross-Validation with Consumer Safety Data */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: AI Review Statistics (8 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    (2) 당회차 리뷰 AI 분석 요약
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    반어법은 문맥 파악 후 부정 처리 / 체험단·무상제공 등 광고 리뷰는 비율 집계에서 제외
                  </p>
                </div>
                {analyzedDate && (
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {analyzedDate} 분석
                  </span>
                )}
              </div>

              {stats ? (
                <div className="space-y-6">
                  {/* Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/60">
                      <span className="text-xs text-slate-500 font-medium">분석 리뷰 총수</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-extrabold text-slate-900">{stats.total}</span>
                        <span className="text-xs text-slate-500">건</span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 block">광고 {stats.ad}건 제외</span>
                    </div>

                    <div className="bg-emerald-50/70 rounded-xl p-3.5 border border-emerald-200/60">
                      <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> 긍정 비율
                      </span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-extrabold text-emerald-700">{stats.positiveRate}%</span>
                        <span className="text-xs text-emerald-600">({stats.positive}건)</span>
                      </div>
                      <span className="text-[11px] text-emerald-600 mt-1 block">실제 만족 고객</span>
                    </div>

                    <div className="bg-rose-50/70 rounded-xl p-3.5 border border-rose-200/60">
                      <span className="text-xs text-rose-700 font-medium flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> 부정 비율
                      </span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-extrabold text-rose-700">{stats.negativeRate}%</span>
                        <span className="text-xs text-rose-600">({stats.negative}건)</span>
                      </div>
                      <span className="text-[11px] text-rose-600 mt-1 block">반어법 불만 포함</span>
                    </div>

                    <div className="bg-amber-50/70 rounded-xl p-3.5 border border-amber-200/60">
                      <span className="text-xs text-amber-700 font-medium flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-600" /> 안전 이슈
                      </span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-extrabold text-amber-700">{stats.safetyCount}</span>
                        <span className="text-xs text-amber-600">건</span>
                      </div>
                      <span className="text-[11px] text-amber-600 mt-1 block">발열·냄새·연기 등</span>
                    </div>
                  </div>

                  {/* Sentiment Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-600 mb-1.5">
                      <span>실제 고객 감성 분포 (총 {stats.validReviews}건 유효)</span>
                      <span>긍정 {stats.positiveRate}% / 부정 {stats.negativeRate}% / 중립 {stats.neutralRate}%</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
                      <div
                        style={{ width: `${stats.positiveRate}%` }}
                        className="bg-emerald-500 h-full transition-all duration-500"
                        title={`긍정: ${stats.positive}건`}
                      />
                      <div
                        style={{ width: `${stats.neutralRate}%` }}
                        className="bg-slate-400 h-full transition-all duration-500"
                        title={`중립: ${stats.neutral}건`}
                      />
                      <div
                        style={{ width: `${stats.negativeRate}%` }}
                        className="bg-rose-500 h-full transition-all duration-500"
                        title={`부정: ${stats.negative}건`}
                      />
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 mt-2">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 긍정 ({stats.positive}건)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span> 중립 ({stats.neutral}건)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span> 부정 ({stats.negative}건)
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-purple-400"></span> 광고 제외 ({stats.ad}건)
                      </span>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      불만 및 피드백 주요 유형 순위
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {stats.sortedCategories.slice(0, 8).map((cat, i) => (
                        <div key={cat.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-600 w-4">{i + 1}</span>
                            <span className="text-xs font-medium text-slate-800">{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700">{cat.count}건</span>
                            <span className="text-[11px] text-slate-400">({cat.percentage}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-sm">
                  CSV 파일을 업로드하고 [전체 일괄 분석 실행]을 누르면 통계가 도출됩니다.
                </div>
              )}
            </div>
          </div>

          {/* Right: Consumer Safety Data (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-amber-600" />
                      (3) 소비자 안전사고 교차 검증
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      한국소비자원 청소기 위해사고 공공데이터(3,000건 전수조사 중 '가정용 진공청소기' 필터링)
                    </p>
                  </div>
                  <button
                    onClick={fetchSafetyData}
                    disabled={safetyLoading}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    title="소비자원 데이터 새로고침"
                  >
                    <RefreshCw className={`w-4 h-4 ${safetyLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {safetyError ? (
                  <div className="py-10 text-center">
                    <p className="text-sm font-semibold text-rose-600">불러오지 못했습니다</p>
                    <p className="text-xs text-slate-400 mt-1">한국소비자원 API 연동 에러가 발생했습니다.</p>
                  </div>
                ) : safetyLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                    <span className="text-xs">공공데이터 3,000건 수집 및 청소기 필터링 중...</span>
                  </div>
                ) : safetyData ? (
                  <div className="space-y-4">
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-900">
                            가정용 진공청소기 사고 위해 원인 TOP 1~3위
                          </p>
                          <p className="text-[11px] text-amber-700 mt-0.5">
                            총 {safetyData.totalTargetCleaners}건의 진공청소기 접수 사례 중 상위 위해 원인
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {safetyData.topReasons.map((item) => (
                          <div
                            key={item.rank}
                            className="bg-white/90 rounded-lg p-2.5 border border-amber-200/60 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-bold flex items-center justify-center">
                                {item.rank}
                              </span>
                              <span className="text-xs font-semibold text-slate-800">{item.reason}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-extrabold text-amber-900">{item.count}건</span>
                              <span className="text-[11px] text-slate-400 ml-1">({item.percentage}%)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-600 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">대표님 보고 시사점:</span>
                        <span className="text-[11px] text-slate-400">24시간 캐싱 적용됨</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-600">
                        공공데이터 상 청소기 사고의 주원인은 <strong className="text-slate-900">고장/불량 및 발열/전기</strong> 관련입니다. 
                        현재 당사 리뷰 중 <strong className="text-rose-600">안전 이슈({stats?.safetyCount || 0}건)</strong>로 포착된 
                        충전기 과열 및 탄내는 단순 불만이 아닌 실제 안전 리콜/소비자 분쟁 위험으로 번질 수 있으므로 즉시 조치해야 합니다.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    소비자원 데이터를 불러오는 중입니다...
                  </div>
                )}
              </div>

              {safetyData?.cachedAt && (
                <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span>한국소비자원 접수정보 API 연동</span>
                  <span>갱신시각: {new Date(safetyData.cachedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section: '우리가 고칠 것' 3줄 결론 (수동 입력 영역) */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-200">
                  실무자 작성 필수
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  (5) '우리가 고칠 것' 결론 3줄 (대표님 회의 보고용)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ※ AI 자동 생성이 금지된 영역입니다. 실무자가 리뷰 분석 통계와 소비자원 데이터를 종합하여 직접 3가지 핵심 과제를 작성합니다.
              </p>
            </div>

            <button
              onClick={copyActionPlan}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              {copiedAction ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">복사 완료!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>보고서용 3줄 복사</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                1
              </span>
              <input
                type="text"
                placeholder="예: [안전/품질] 충전 어댑터 발열 및 탄내 이슈 원인 규명 및 협력사 QC 전수 재검사 진행"
                value={actionItem1}
                onChange={(e) => handleActionChange(1, e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400 bg-slate-50/50"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                2
              </span>
              <input
                type="text"
                placeholder="예: [배터리/상세페이지] 표준/강모드 실사용 시간(8분) 고지 강화 및 오해 소지 줄이기"
                value={actionItem2}
                onChange={(e) => handleActionChange(2, e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400 bg-slate-50/50"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                3
              </span>
              <input
                type="text"
                placeholder="예: [구성품/설명서] 한글 설명서 동봉 패키지 변경 및 거치대 기본 번들 기획 검토"
                value={actionItem3}
                onChange={(e) => handleActionChange(3, e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400 bg-slate-50/50"
              />
            </div>
          </div>
        </section>

        {/* Safety & Improvement Highlights Section */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Safety Issues Review List */}
            <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-rose-100 mb-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-rose-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    🚨 긴급 점검 필요 안전 이슈 ({stats.safetyList.length}건)
                  </h3>
                </div>
                <span className="text-xs bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded">
                  무조건 표시 대상
                </span>
              </div>

              {stats.safetyList.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">검출된 안전 위험 관련 리뷰가 없습니다.</p>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {stats.safetyList.map((item) => (
                    <div
                      key={item.review_no}
                      className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 text-xs text-slate-800"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-rose-700">#{item.review_no}번 리뷰 (★{item.rating})</span>
                        <span className="text-[11px] text-slate-400">{item.written_on}</span>
                      </div>
                      <p className="leading-relaxed font-medium">{item.review_text}</p>
                      {item.categories && (
                        <div className="mt-1.5 flex gap-1">
                          <span className="text-[10px] bg-rose-200/70 text-rose-800 px-1.5 py-0.5 rounded">
                            {item.categories}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Improvement Requests List */}
            <div className="bg-white rounded-2xl border border-indigo-100 p-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-indigo-50 mb-4">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    💡 고객 개선 요청 사항 발췌 ({stats.improvementList.length}건)
                  </h3>
                </div>
                <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded">
                  니즈 반영 과제
                </span>
              </div>

              {stats.improvementList.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">추출된 개선 요청 사항이 없습니다.</p>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {stats.improvementList.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-800"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-indigo-700">#{item.review_no}번 피드백</span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-medium">
                          {item.category}
                        </span>
                      </div>
                      <p className="leading-relaxed">"{item.text}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Detailed Review Table Section */}
        {analyzedReviews.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  전체 리뷰 세부 분석 내역 ({filteredReviews.length} / {analyzedReviews.length}건)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  감성 분류, 불만 유형 태그, 안전 이슈 여부를 필터링하여 확인하세요.
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                  <input
                    type="text"
                    placeholder="리뷰 내용 또는 유형 검색..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44"
                  />
                </div>

                <select
                  value={filterSentiment}
                  onChange={(e) => setFilterSentiment(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">감성: 전체</option>
                  <option value="긍정">긍정만</option>
                  <option value="부정">부정만</option>
                  <option value="중립">중립만</option>
                  <option value="광고">광고(체험단)만</option>
                </select>

                <button
                  onClick={() => setFilterSafetyOnly(!filterSafetyOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    filterSafetyOnly
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  안전이슈만 보기
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase bg-slate-50/50">
                    <th className="py-2.5 px-3 w-12">번호</th>
                    <th className="py-2.5 px-3 w-20">작성일</th>
                    <th className="py-2.5 px-3 w-14">별점</th>
                    <th className="py-2.5 px-3 min-w-[280px]">리뷰 본문</th>
                    <th className="py-2.5 px-3 w-16">감성</th>
                    <th className="py-2.5 px-3 w-28">유형</th>
                    <th className="py-2.5 px-3 w-40">개선 요청</th>
                    <th className="py-2.5 px-3 w-16">안전이슈</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReviews.map((r) => (
                    <tr key={r.review_no} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-500">#{r.review_no}</td>
                      <td className="py-2.5 px-3 text-slate-500">{r.written_on}</td>
                      <td className="py-2.5 px-3 font-bold text-amber-500">★{r.rating}</td>
                      <td className="py-2.5 px-3 text-slate-800 leading-relaxed font-normal">
                        {r.review_text}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            r.sentiment === '긍정'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.sentiment === '부정'
                              ? 'bg-rose-100 text-rose-800'
                              : r.sentiment === '광고'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {r.sentiment}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {r.categories || '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {r.improvement_request ? (
                          <span className="text-indigo-600 font-medium">"{r.improvement_request}"</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.is_safety_issue ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold bg-rose-600 text-white animate-pulse">
                            <Flame className="w-3 h-3" /> 위험
                          </span>
                        ) : (
                          <span className="text-slate-300 text-center block">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Section: 기존 분석 기록 리스트업 (Supabase 연동) */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                (5) 하단: 기존 분석 기록 (분석일 기준 리스트업)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Supabase에 영구 보관된 월별/일자별 분석 이력입니다 (노출 항목: 분석일, 분석 건수, 부정 비율).
              </p>
            </div>
            <button
              onClick={fetchHistory}
              disabled={historyLoading}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              title="이력 새로고침"
            >
              <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {historyError ? (
            <div className="py-8 text-center">
              <p className="text-sm font-semibold text-rose-600">불러오지 못했습니다</p>
              <p className="text-xs text-slate-400 mt-1">Supabase 기록 조회에 실패했습니다.</p>
            </div>
          ) : historyLoading ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              기존 분석 이력을 불러오는 중...
            </div>
          ) : historyList.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              아직 저장된 기존 분석 기록이 없습니다. 리뷰 분석을 실행하면 이곳에 자동으로 누적됩니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase bg-slate-50/50">
                    <th className="py-2.5 px-4">분석일 (analyzed_on)</th>
                    <th className="py-2.5 px-4">분석 건수</th>
                    <th className="py-2.5 px-4">부정 비율</th>
                    <th className="py-2.5 px-4">안전 이슈 건수</th>
                    <th className="py-2.5 px-4">사용된 AI 모델</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{item.analyzed_on}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {item.totalCount.toLocaleString()}건
                        <span className="text-[11px] text-slate-400 font-normal ml-1">
                          (유효 {item.validCount}건)
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                          {item.negativeRate}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {item.safetyCount > 0 ? (
                          <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {item.safetyCount}건 위험
                          </span>
                        ) : (
                          <span className="text-slate-400">0건</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {item.model_used}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
