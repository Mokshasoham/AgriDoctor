import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { sanitizeAgroUrl, latestNdviStats } from '@/lib/agro'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, supabase } = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: farm, error } = await supabase
      .from('farms')
      .select('id, user_id, agro_polygon_id, latest_monitor_snapshot')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error || !farm) {
      return NextResponse.json({ error: 'Farm not found' }, { status: 404 })
    }

    const type = req.nextUrl.searchParams.get('type') || 'ndvi'
    const paletteId = req.nextUrl.searchParams.get('paletteid')

    let targetUrl: string | undefined = farm.latest_monitor_snapshot?.ndvi?.image?.image?.[type]

    // If no snapshot exists yet, attempt an on-demand scan if polygon is configured
    if (!targetUrl && farm.agro_polygon_id) {
      try {
        const ndviRes = await latestNdviStats(farm.agro_polygon_id)
        if (ndviRes?.image?.image) {
          targetUrl = ndviRes.image.image[type as keyof typeof ndviRes.image.image]
        }
      } catch (e) {
        console.warn('On-demand satellite scan failed:', e)
      }
    }

    if (!targetUrl) {
      return NextResponse.json({ error: 'Satellite image not available' }, { status: 404 })
    }

    // Clean URL: ensure HTTPS and exact single appid
    const cleanUrl = sanitizeAgroUrl(targetUrl)
    const urlObj = new URL(cleanUrl)
    if (paletteId && type === 'ndvi') {
      urlObj.searchParams.set('paletteid', paletteId)
    }

    // Fetch the image from AgroMonitoring server-side
    const agroRes = await fetch(urlObj.toString())
    if (!agroRes.ok) {
      const errText = await agroRes.text().catch(() => '')
      console.error(`[satellite-image proxy] Agro returned ${agroRes.status}:`, errText)
      return NextResponse.json(
        { error: `AgroMonitoring error: ${agroRes.status}` },
        { status: agroRes.status }
      )
    }

    const contentType = agroRes.headers.get('content-type') || 'image/png'
    const imageBuffer = await agroRes.arrayBuffer()

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    })
  } catch (err) {
    console.error('[/api/farms/[id]/satellite-image GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
