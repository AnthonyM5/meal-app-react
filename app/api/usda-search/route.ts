import { type NextRequest, NextResponse } from "next/server"
import { searchUSDAFoods } from "@/lib/usda-integration"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")

  if (!query || query.length < 2) {
    return NextResponse.json({ foods: [] })
  }

  try {
    const foods = await searchUSDAFoods(query)
    return NextResponse.json({ foods })
  } catch (error) {
    console.error("USDA search API error:", error)
    return NextResponse.json({ error: "Failed to search USDA database" }, { status: 500 })
  }
}
