import { convertUSDAToFood } from '@/lib/usda-integration'

describe('USDA Integration - convertUSDAToFood', () => {
  it('should convert USDA food data to our food format', () => {
    const mockUSDAFood = {
      description: 'Apple, raw',
      brandOwner: 'USDA',
      brandName: null,
      foodNutrients: [
        { nutrientId: 1008, value: 52 }, // Energy (calories)
        { nutrientId: 1003, value: 0.26 }, // Protein
        { nutrientId: 1005, value: 13.81 }, // Carbs  
        { nutrientId: 1004, value: 0.17 }, // Fat
        { nutrientId: 1079, value: 2.4 } // Fiber
      ]
    }

    const result = convertUSDAToFood(mockUSDAFood)

    expect(result).toEqual({
      name: 'Apple, raw',
      brand: 'USDA',
      serving_size: 100,
      serving_unit: 'g',
      calories_per_serving: 52,
      protein_g: 0.26,
      carbs_g: 13.81,
      fat_g: 0.17,
      fiber_g: 2.4,
      is_verified: true
    })
  })

  it('should handle missing nutrients gracefully', () => {
    const mockUSDAFood = {
      description: 'Incomplete Food Data',
      brandOwner: null,
      brandName: 'TestBrand',
      foodNutrients: [
        { nutrientId: 1008, value: 100 }, // Only calories
        { nutrientId: 1003, value: 5 } // Only protein
        // Missing carbs, fat, fiber
      ]
    }

    const result = convertUSDAToFood(mockUSDAFood)

    expect(result).toEqual({
      name: 'Incomplete Food Data',
      brand: 'TestBrand',
      serving_size: 100,
      serving_unit: 'g',
      calories_per_serving: 100,
      protein_g: 5,
      carbs_g: 0, // Should default to 0
      fat_g: 0, // Should default to 0
      fiber_g: 0, // Should default to 0
      is_verified: true
    })
  })

  it('should handle no brand information', () => {
    const mockUSDAFood = {
      description: 'Generic Food',
      brandOwner: null,
      brandName: null,
      foodNutrients: [
        { nutrientId: 1008, value: 200 }
      ]
    }

    const result = convertUSDAToFood(mockUSDAFood)

    expect(result.brand).toBeNull()
    expect(result.name).toBe('Generic Food')
  })

  it('should handle empty nutrients array', () => {
    const mockUSDAFood = {
      description: 'No Nutrition Data',
      brandOwner: 'TestBrand',
      brandName: null,
      foodNutrients: []
    }

    const result = convertUSDAToFood(mockUSDAFood)

    expect(result).toEqual({
      name: 'No Nutrition Data',
      brand: 'TestBrand',
      serving_size: 100,
      serving_unit: 'g',
      calories_per_serving: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      is_verified: true
    })
  })

  it('should prioritize brandOwner over brandName', () => {
    const mockUSDAFood = {
      description: 'Branded Food',
      brandOwner: 'Primary Brand',
      brandName: 'Secondary Brand',
      foodNutrients: [
        { nutrientId: 1008, value: 150 }
      ]
    }

    const result = convertUSDAToFood(mockUSDAFood)
    expect(result.brand).toBe('Primary Brand')
  })

  it('should handle unknown nutrient IDs', () => {
    const mockUSDAFood = {
      description: 'Food with Unknown Nutrients',
      brandOwner: 'Test',
      brandName: null,
      foodNutrients: [
        { nutrientId: 1008, value: 100 }, // Known: calories
        { nutrientId: 9999, value: 50 }, // Unknown nutrient ID
        { nutrientId: 1003, value: 10 } // Known: protein
      ]
    }

    const result = convertUSDAToFood(mockUSDAFood)

    expect(result.calories_per_serving).toBe(100)
    expect(result.protein_g).toBe(10)
    expect(result.carbs_g).toBe(0) // Should still default correctly
  })
})
