import { bulkImportPopularFoods } from "@/lib/usda-api"

async function main() {
  console.log("Starting bulk import of popular foods from USDA database...")

  try {
    const results = await bulkImportPopularFoods()

    console.log("\n=== Import Results ===")
    results.forEach((result, index) => {
      const status = result.success ? "✅" : "❌"
      console.log(`${index + 1}. ${status} ${result.food}: ${result.message}`)
    })

    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    console.log(`\n=== Summary ===`)
    console.log(`✅ Successfully imported: ${successful}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`📊 Total processed: ${results.length}`)
  } catch (error) {
    console.error("Bulk import failed:", error)
  }
}

main()
