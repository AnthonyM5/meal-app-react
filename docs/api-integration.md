# USDA Food Database API Integration

## Overview

This application integrates with the USDA Food Data Central API to provide comprehensive nutritional information for a wide variety of foods.

## API Configuration

### Environment Variables

```env
USDA_API_KEY=your_api_key_here
USDA_API_BASE_URL=https://api.nal.usda.gov/fdc/v1
```

### API Client Setup

```typescript
// lib/usda-api.ts
export class USDAApiClient {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = process.env.USDA_API_BASE_URL!
    this.apiKey = process.env.USDA_API_KEY!
  }

  async searchFoods(query: string) {
    // Implementation
  }

  async getFoodDetails(fdcId: string) {
    // Implementation
  }
}
```

## API Endpoints Used

1. **Food Search**

   - Endpoint: `/foods/search`
   - Method: POST
   - Used for searching foods by name/keywords

2. **Food Details**
   - Endpoint: `/food/{fdcId}`
   - Method: GET
   - Retrieves detailed information for a specific food

## Data Models

### Food Search Response

```typescript
interface FoodSearchResponse {
  totalHits: number
  currentPage: number
  totalPages: number
  foods: FoodItem[]
}

interface FoodItem {
  fdcId: number
  description: string
  dataType: string
  publishedDate: string
  brandOwner?: string
  brandName?: string
  ingredients?: string
  foodNutrients: Nutrient[]
}
```

### Food Details Response

```typescript
interface FoodDetails {
  fdcId: number
  description: string
  dataType: string
  publicationDate: string
  foodNutrients: NutrientDetail[]
  portions: Portion[]
}
```

## Error Handling

```typescript
// lib/api-error.ts
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message)
  }
}

// Example error handling
try {
  const result = await api.searchFoods('apple')
} catch (error) {
  if (error instanceof ApiError) {
    // Handle API-specific errors
    console.error(`API Error: ${error.message}`)
  } else {
    // Handle other errors
    console.error('Unknown error occurred')
  }
}
```

## Rate Limiting

- Basic tier: 3600 requests per hour
- Implemented exponential backoff for retries
- Client-side caching to reduce API calls

## Caching Strategy

### In-Memory Cache

```typescript
// lib/cache.ts
export class FoodCache {
  private cache: Map<string, CacheEntry>
  private readonly TTL = 1000 * 60 * 60 // 1 hour

  set(key: string, value: any) {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    })
  }

  get(key: string) {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key)
      return null
    }
    return entry.value
  }
}
```

## Usage Examples

### Searching Foods

```typescript
const searchFoods = async (query: string) => {
  const cache = new FoodCache()
  const cacheKey = `search:${query}`

  // Check cache first
  const cached = cache.get(cacheKey)
  if (cached) return cached

  // Make API call if not in cache
  const results = await api.searchFoods(query)
  cache.set(cacheKey, results)
  return results
}
```

### Getting Food Details

```typescript
const getFoodDetails = async (fdcId: string) => {
  const cache = new FoodCache()
  const cacheKey = `food:${fdcId}`

  const cached = cache.get(cacheKey)
  if (cached) return cached

  const details = await api.getFoodDetails(fdcId)
  cache.set(cacheKey, details)
  return details
}
```

## Error Codes and Handling

| Error Code | Description         | Handling Strategy          |
| ---------- | ------------------- | -------------------------- |
| 429        | Rate limit exceeded | Implement backoff          |
| 401        | Invalid API key     | Check configuration        |
| 404        | Food not found      | Show user-friendly message |

## Best Practices

1. **Error Handling**

   - Always implement proper error handling
   - Use custom error types
   - Show user-friendly error messages

2. **Caching**

   - Cache frequently accessed data
   - Implement cache invalidation
   - Use appropriate TTL values

3. **Rate Limiting**

   - Monitor API usage
   - Implement backoff strategies
   - Cache aggressively

4. **Data Validation**
   - Validate API responses
   - Handle missing or null values
   - Sanitize user inputs
