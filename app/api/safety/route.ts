import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface CachedData {
  timestamp: number;
  data: {
    topReasons: Array<{ rank: number; reason: string; count: number; percentage: number }>;
    totalIncidents: number;
    totalTargetCleaners: number;
    rawSample: Array<any>;
  };
}

// In-memory cache for 24 hours
let memoryCache: CachedData | null = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET() {
  try {
    const now = Date.now();
    if (memoryCache && now - memoryCache.timestamp < CACHE_DURATION_MS) {
      return NextResponse.json({
        success: true,
        cached: true,
        cachedAt: new Date(memoryCache.timestamp).toISOString(),
        ...memoryCache.data,
      });
    }

    const serviceKey = process.env.CONSUMER_SAFETY_API_KEY;
    if (!serviceKey) {
      return NextResponse.json(
        { success: false, error: 'CONSUMER_SAFETY_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // Call 3 pages, 1000 items each (total 3,000 items)
    const pagePromises = [1, 2, 3].map(async (pageNo) => {
      const url = `https://apis.data.go.kr/B551919/open-api/harm/reception?serviceKey=${encodeURIComponent(
        serviceKey
      )}&pageNo=${pageNo}&numOfRows=1000&apiFormat=json`;

      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`한국소비자원 API 응답 오류 (페이지 ${pageNo}): HTTP ${res.status}`);
      }

      const json = await res.json();
      const items = json?.response?.body?.items?.item;
      if (!items) return [];
      return Array.isArray(items) ? items : [items];
    });

    const pageResults = await Promise.all(pagePromises);
    const allItems = pageResults.flat();

    // Filter only itemMinor === '가정용 진공청소기'
    const cleanerItems = allItems.filter(
      (item) => item && typeof item.itemMinor === 'string' && item.itemMinor.includes('가정용 진공청소기')
    );

    // Group by injuryReason
    const reasonCounts: Record<string, number> = {};
    for (const item of cleanerItems) {
      const reason = (item.injuryReason || '기타').trim();
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }

    // Sort reasons descending
    const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);

    const totalCleaners = cleanerItems.length;
    const top3 = sortedReasons.slice(0, 3).map(([reason, count], idx) => ({
      rank: idx + 1,
      reason,
      count,
      percentage: totalCleaners > 0 ? Math.round((count / totalCleaners) * 100) : 0,
    }));

    const resultData = {
      topReasons: top3,
      totalIncidents: allItems.length,
      totalTargetCleaners: totalCleaners,
      rawSample: cleanerItems.slice(0, 5),
    };

    // Cache the result
    memoryCache = {
      timestamp: now,
      data: resultData,
    };

    return NextResponse.json({
      success: true,
      cached: false,
      cachedAt: new Date(now).toISOString(),
      ...resultData,
    });
  } catch (err: any) {
    console.error('소비자원 안전사고 API 에러:', err);
    return NextResponse.json(
      {
        success: false,
        error: '불러오지 못했습니다',
        detail: err.message || '소비자원 API 요청 실패',
      },
      { status: 500 }
    );
  }
}
