import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('review_analysis')
      .select('analyzed_on, sentiment, is_safety_issue, model_used')
      .order('analyzed_on', { ascending: false });

    if (error) {
      console.error('Supabase 기록 조회 에러:', error);
      return NextResponse.json(
        { success: false, error: '불러오지 못했습니다', detail: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: true, history: [] });
    }

    // Group by analyzed_on
    const groups: Record<
      string,
      {
        analyzed_on: string;
        totalCount: number;
        negativeCount: number;
        adCount: number;
        safetyCount: number;
        model_used: string;
      }
    > = {};

    for (const row of data) {
      const date = row.analyzed_on || '미지정';
      if (!groups[date]) {
        groups[date] = {
          analyzed_on: date,
          totalCount: 0,
          negativeCount: 0,
          adCount: 0,
          safetyCount: 0,
          model_used: row.model_used || 'gemini-3.8-flash',
        };
      }

      groups[date].totalCount += 1;
      if (row.sentiment === '부정') {
        groups[date].negativeCount += 1;
      } else if (row.sentiment === '광고') {
        groups[date].adCount += 1;
      }

      if (row.is_safety_issue) {
        groups[date].safetyCount += 1;
      }
    }

    // Format list for UI
    const historyList = Object.values(groups).map((g) => {
      const validCount = g.totalCount - g.adCount;
      const negativeRate =
        validCount > 0 ? ((g.negativeCount / validCount) * 100).toFixed(1) : '0.0';

      return {
        analyzed_on: g.analyzed_on,
        totalCount: g.totalCount,
        validCount,
        negativeCount: g.negativeCount,
        negativeRate: `${negativeRate}%`,
        safetyCount: g.safetyCount,
        model_used: g.model_used,
      };
    });

    // Sort by analyzed_on descending
    historyList.sort((a, b) => b.analyzed_on.localeCompare(a.analyzed_on));

    return NextResponse.json({
      success: true,
      history: historyList,
    });
  } catch (err: any) {
    console.error('이력 조회 예외:', err);
    return NextResponse.json(
      { success: false, error: '불러오지 못했습니다', detail: err.message },
      { status: 500 }
    );
  }
}
