import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const nutrient = searchParams.get("nutrient")
    const minAmount = Number.parseFloat(searchParams.get("min") || "0")

    if (!nutrient) {
      return NextResponse.json({ error: "Nutrient parameter required" }, { status: 400 })
    }

    const supabase = createClient()

    // Use the database function for nutrient search
    const { data: foods, error } = await supabase.rpc("search_foods_by_nutrient", {
      nutrient_name: nutrient,
      min_amount: minAmount,
      limit_count: 50,
    })

    if (error) {
      console.error("Nutrient search error:", error)
      return NextResponse.json({ error: "Search failed" }, { status: 500 })
    }

    return NextResponse.json({ foods: foods || [] })
  } catch (error) {
    console.error("Nutrient search API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
