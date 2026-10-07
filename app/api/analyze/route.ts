import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

interface InputReview {
  review_no: number;
  written_on: string;
  rating: number;
  review_text: string;
}

interface AnalyzedResult {
  review_no: number;
  sentiment: '긍정' | '부정' | '중립' | '광고';
  categories: string;
  improvement_request: string;
  is_safety_issue: boolean;
}

const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

async function callGeminiApi(model: string, apiKey: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    }),
  });

  return response;
}

export async function POST(request: Request) {
  try {
    const { reviews, saveToDb } = await request.json();

    if (!Array.isArray(reviews) || reviews.length === 0) {
      return NextResponse.json(
        { success: false, error: '분석할 리뷰 목록이 비어있습니다.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const prompt = `당신은 생활가전 전문 마케팅 분석가입니다. 아래 제공되는 무선 청소기 고객 리뷰 목록 전체를 분석하여 지정된 JSON 스키마 형식으로 응답하십시오.

[분석 가이드라인]
1. 감성 분류 ("sentiment"):
   - "긍정", "부정", "중립", "광고" 중 하나로 분류하십시오.
   - 중요: 별점이 아닌 실제 리뷰 본문 내용을 기준으로 판단하십시오.
   - 반어법, 비꼬기, 반어적 칭찬(예: "배송 정말 빠르네요^^ 주문하고 딱 12일 만에 왔어요", "소리 조용하네요~ 옆집에서 공사하는 줄ㅋㅋ")은 문맥상 명백한 불만이므로 반드시 "부정"으로 처리하십시오.
   - [체험단], 무상 제공, 협찬, 할인 링크, 프로모션성 리뷰는 반드시 "광고"로 분류하십시오.
2. 유형 분류 ("categories"):
   - 반드시 다음 목록 안에서만 선택하십시오 (중복 허용, 여러 개일 경우 쉼표로 연결 예: "흡입력, 소음"):
     ["배터리", "흡입력", "소음", "무게·사용감", "디자인", "관리·청소", "구성품", "품질·불량", "배송", "포장", "고객센터", "가격", "설명서", "기타"]
3. 개선 요청 ("improvement_request"):
   - "~면 좋겠어요", "~해 주세요", "~개선", "~있으면 좋겠다" 등 고객의 요구사항이나 제품 개선을 바라는 문장을 핵심만 추출하십시오. 없으면 ""(빈 문자열)로 설정하십시오.
4. 안전 이슈 ("is_safety_issue"):
   - 충전기나 본체의 "뜨거움", "발열", "과열", "냄새", "탄내", "연기", "감전", "누전", "스파크", "폭발" 등 안전 사고 위험 요소가 언급된 경우 무조건 true, 없으면 false.
5. 응답 포맷:
   - 각 리뷰에 대해 빠짐없이 분석하여 JSON 배열 형태로 반환하십시오.
   - 키: "review_no", "sentiment", "categories", "improvement_request", "is_safety_issue"

[분석할 리뷰 목록 (총 ${reviews.length}건)]
${JSON.stringify(reviews, null, 2)}
`;

    let activeModel = PRIMARY_MODEL;
    let geminiRes = await callGeminiApi(activeModel, apiKey, prompt);

    // 503 에러 발생 시 fallback 모델로 딱 한 번 재요청
    if (geminiRes.status === 503) {
      console.warn(`503 Service Unavailable with ${PRIMARY_MODEL}. Retrying with ${FALLBACK_MODEL}...`);
      activeModel = FALLBACK_MODEL;
      geminiRes = await callGeminiApi(activeModel, apiKey, prompt);
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error(`Gemini API 호출 실패 (${activeModel}, status: ${geminiRes.status}):`, errText);
      return NextResponse.json(
        {
          success: false,
          error: '불러오지 못했습니다',
          detail: `Gemini API 에러 (${geminiRes.status})`,
        },
        { status: 500 }
      );
    }

    const resJson = await geminiRes.json();
    const candidateText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText || candidateText.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: '불러오지 못했습니다',
          detail: 'AI 응답이 비어있습니다.',
        },
        { status: 500 }
      );
    }

    let parsedResults: AnalyzedResult[];
    try {
      // Remove any markdown code block wrappers if present
      const cleaned = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      parsedResults = JSON.parse(cleaned);
      if (!Array.isArray(parsedResults)) {
        throw new Error('응답이 배열 형식이 아닙니다.');
      }
    } catch (parseErr: any) {
      console.error('Gemini 응답 JSON 파싱 실패:', candidateText);
      return NextResponse.json(
        {
          success: false,
          error: '불러오지 못했습니다',
          detail: 'AI 응답 포맷 해석 실패',
        },
        { status: 500 }
      );
    }

    // Merge analysis with original review data
    const analyzedMap = new Map<number, AnalyzedResult>();
    for (const item of parsedResults) {
      analyzedMap.set(Number(item.review_no), item);
    }

    const todayDate = new Date().toISOString().split('T')[0];

    const mergedRows = reviews.map((r: InputReview) => {
      const analysis = analyzedMap.get(r.review_no);
      return {
        analyzed_on: todayDate,
        review_no: r.review_no,
        written_on: r.written_on,
        rating: r.rating,
        review_text: r.review_text,
        sentiment: analysis?.sentiment || '중립',
        categories: analysis?.categories || '기타',
        improvement_request: analysis?.improvement_request || '',
        is_safety_issue: Boolean(analysis?.is_safety_issue),
        model_used: activeModel,
      };
    });

    // Supabase DB 저장 (saveToDb가 true인 경우)
    let savedCount = 0;
    if (saveToDb !== false) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < mergedRows.length; i += BATCH_SIZE) {
        const batch = mergedRows.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase
          .from('review_analysis')
          .insert(batch);

        if (insertError) {
          console.error('Supabase 삽입 에러:', insertError);
          // 실패 시 중단하지 않고 로그 남김 또는 플래그 처리
        } else {
          savedCount += batch.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      modelUsed: activeModel,
      analyzedOn: todayDate,
      savedCount,
      results: mergedRows,
    });
  } catch (error: any) {
    console.error('리뷰 분석 API 예외:', error);
    return NextResponse.json(
      {
        success: false,
        error: '불러오지 못했습니다',
        detail: error.message || '알 수 없는 서버 에러',
      },
      { status: 500 }
    );
  }
}
