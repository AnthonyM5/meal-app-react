export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bowl_analyses: {
        Row: {
          created_at: string | null
          dog_id: string | null
          id: string
          identified_items: Json
          image_url: string
          model_version: string
          raw_output: Json
          user_corrected: Json | null
        }
        Insert: {
          created_at?: string | null
          dog_id?: string | null
          id?: string
          identified_items: Json
          image_url: string
          model_version: string
          raw_output: Json
          user_corrected?: Json | null
        }
        Update: {
          created_at?: string | null
          dog_id?: string | null
          id?: string
          identified_items?: Json
          image_url?: string
          model_version?: string
          raw_output?: Json
          user_corrected?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "bowl_analyses_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dogs: {
        Row: {
          activity_level:
            | Database["public"]["Enums"]["dog_activity_level"]
            | null
          avatar_url: string | null
          birth_date: string | null
          breed: string | null
          created_at: string | null
          health_conditions: string[] | null
          id: string
          ideal_weight_kg: number | null
          life_stage: Database["public"]["Enums"]["dog_life_stage"] | null
          name: string
          neutered: boolean | null
          owner_id: string
          updated_at: string | null
          weight_kg: number
        }
        Insert: {
          activity_level?:
            | Database["public"]["Enums"]["dog_activity_level"]
            | null
          avatar_url?: string | null
          birth_date?: string | null
          breed?: string | null
          created_at?: string | null
          health_conditions?: string[] | null
          id?: string
          ideal_weight_kg?: number | null
          life_stage?: Database["public"]["Enums"]["dog_life_stage"] | null
          name: string
          neutered?: boolean | null
          owner_id: string
          updated_at?: string | null
          weight_kg: number
        }
        Update: {
          activity_level?:
            | Database["public"]["Enums"]["dog_activity_level"]
            | null
          avatar_url?: string | null
          birth_date?: string | null
          breed?: string | null
          created_at?: string | null
          health_conditions?: string[] | null
          id?: string
          ideal_weight_kg?: number | null
          life_stage?: Database["public"]["Enums"]["dog_life_stage"] | null
          name?: string
          neutered?: boolean | null
          owner_id?: string
          updated_at?: string | null
          weight_kg?: number
        }
        Relationships: []
      }
      foods: {
        Row: {
          barcode: string | null
          brand: string | null
          calcium_mg: number | null
          calories_per_serving: number
          carbs_g: number | null
          cholesterol_mg: number | null
          choline_mg: number | null
          copper_mg: number | null
          created_at: string | null
          created_by: string | null
          fat_g: number | null
          fdc_id: number | null
          fiber_g: number | null
          folate_mcg: number | null
          id: string
          iodine_mcg: number | null
          iron_mg: number | null
          is_safe_for_dogs: boolean | null
          is_verified: boolean | null
          lysine_mg: number | null
          magnesium_mg: number | null
          manganese_mg: number | null
          methionine_cystine_mg: number | null
          name: string
          omega3_epa_dha_mg: number | null
          omega6_la_mg: number | null
          phosphorus_mg: number | null
          potassium_mg: number | null
          protein_g: number | null
          selenium_mcg: number | null
          serving_size: number
          serving_unit: string | null
          sodium_mg: number | null
          sugar_g: number | null
          taurine_mg: number | null
          toxicity_note: string | null
          tryptophan_mg: number | null
          updated_at: string | null
          vitamin_a_mcg: number | null
          vitamin_b12_mcg: number | null
          vitamin_c_mg: number | null
          vitamin_d_iu: number | null
          vitamin_d_mcg: number | null
          vitamin_e_mg: number | null
          zinc_mg: number | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          calcium_mg?: number | null
          calories_per_serving: number
          carbs_g?: number | null
          cholesterol_mg?: number | null
          choline_mg?: number | null
          copper_mg?: number | null
          created_at?: string | null
          created_by?: string | null
          fat_g?: number | null
          fdc_id?: number | null
          fiber_g?: number | null
          folate_mcg?: number | null
          id?: string
          iodine_mcg?: number | null
          iron_mg?: number | null
          is_safe_for_dogs?: boolean | null
          is_verified?: boolean | null
          lysine_mg?: number | null
          magnesium_mg?: number | null
          manganese_mg?: number | null
          methionine_cystine_mg?: number | null
          name: string
          omega3_epa_dha_mg?: number | null
          omega6_la_mg?: number | null
          phosphorus_mg?: number | null
          potassium_mg?: number | null
          protein_g?: number | null
          selenium_mcg?: number | null
          serving_size?: number
          serving_unit?: string | null
          sodium_mg?: number | null
          sugar_g?: number | null
          taurine_mg?: number | null
          toxicity_note?: string | null
          tryptophan_mg?: number | null
          updated_at?: string | null
          vitamin_a_mcg?: number | null
          vitamin_b12_mcg?: number | null
          vitamin_c_mg?: number | null
          vitamin_d_iu?: number | null
          vitamin_d_mcg?: number | null
          vitamin_e_mg?: number | null
          zinc_mg?: number | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          calcium_mg?: number | null
          calories_per_serving?: number
          carbs_g?: number | null
          cholesterol_mg?: number | null
          choline_mg?: number | null
          copper_mg?: number | null
          created_at?: string | null
          created_by?: string | null
          fat_g?: number | null
          fdc_id?: number | null
          fiber_g?: number | null
          folate_mcg?: number | null
          id?: string
          iodine_mcg?: number | null
          iron_mg?: number | null
          is_safe_for_dogs?: boolean | null
          is_verified?: boolean | null
          lysine_mg?: number | null
          magnesium_mg?: number | null
          manganese_mg?: number | null
          methionine_cystine_mg?: number | null
          name?: string
          omega3_epa_dha_mg?: number | null
          omega6_la_mg?: number | null
          phosphorus_mg?: number | null
          potassium_mg?: number | null
          protein_g?: number | null
          selenium_mcg?: number | null
          serving_size?: number
          serving_unit?: string | null
          sodium_mg?: number | null
          sugar_g?: number | null
          taurine_mg?: number | null
          toxicity_note?: string | null
          tryptophan_mg?: number | null
          updated_at?: string | null
          vitamin_a_mcg?: number | null
          vitamin_b12_mcg?: number | null
          vitamin_c_mg?: number | null
          vitamin_d_iu?: number | null
          vitamin_d_mcg?: number | null
          vitamin_e_mg?: number | null
          zinc_mg?: number | null
        }
        Relationships: []
      }
      meal_items: {
        Row: {
          calories: number
          carbs_g: number | null
          created_at: string | null
          fat_g: number | null
          fiber_g: number | null
          food_id: string | null
          id: string
          meal_id: string
          protein_g: number | null
          quantity: number
          recipe_id: string | null
          serving_multiplier: number | null
          unit: string | null
        }
        Insert: {
          calories: number
          carbs_g?: number | null
          created_at?: string | null
          fat_g?: number | null
          fiber_g?: number | null
          food_id?: string | null
          id?: string
          meal_id: string
          protein_g?: number | null
          quantity?: number
          recipe_id?: string | null
          serving_multiplier?: number | null
          unit?: string | null
        }
        Update: {
          calories?: number
          carbs_g?: number | null
          created_at?: string | null
          fat_g?: number | null
          fiber_g?: number | null
          food_id?: string | null
          id?: string
          meal_id?: string
          protein_g?: number | null
          quantity?: number
          recipe_id?: string | null
          serving_multiplier?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          created_at: string | null
          date: string
          dog_id: string | null
          id: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          name: string | null
          notes: string | null
          source: Database["public"]["Enums"]["meal_source"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          dog_id?: string | null
          id?: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          name?: string | null
          notes?: string | null
          source?: Database["public"]["Enums"]["meal_source"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          dog_id?: string | null
          id?: string
          meal_type?: Database["public"]["Enums"]["meal_type"]
          name?: string | null
          notes?: string | null
          source?: Database["public"]["Enums"]["meal_source"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrient_requirements: {
        Row: {
          amount_per_1000kcal: number | null
          id: string
          life_stage: Database["public"]["Enums"]["dog_life_stage"]
          max_value: number | null
          min_value: number | null
          notes: string | null
          nutrient_key: string
          source: string
          unit: string
        }
        Insert: {
          amount_per_1000kcal?: number | null
          id?: string
          life_stage: Database["public"]["Enums"]["dog_life_stage"]
          max_value?: number | null
          min_value?: number | null
          notes?: string | null
          nutrient_key: string
          source: string
          unit: string
        }
        Update: {
          amount_per_1000kcal?: number | null
          id?: string
          life_stage?: Database["public"]["Enums"]["dog_life_stage"]
          max_value?: number | null
          min_value?: number | null
          notes?: string | null
          nutrient_key?: string
          source?: string
          unit?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level"] | null
          age: number | null
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          gender: string | null
          goal_type: Database["public"]["Enums"]["goal_type"] | null
          height_cm: number | null
          id: string
          target_calories: number | null
          target_carbs: number | null
          target_fat: number | null
          target_fiber: number | null
          target_protein: number | null
          updated_at: string | null
          weight_kg: number | null
        }
        Insert: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null
          age?: number | null
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          gender?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"] | null
          height_cm?: number | null
          id: string
          target_calories?: number | null
          target_carbs?: number | null
          target_fat?: number | null
          target_fiber?: number | null
          target_protein?: number | null
          updated_at?: string | null
          weight_kg?: number | null
        }
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null
          age?: number | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          gender?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"] | null
          height_cm?: number | null
          id?: string
          target_calories?: number | null
          target_carbs?: number | null
          target_fat?: number | null
          target_fiber?: number | null
          target_protein?: number | null
          updated_at?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          created_at: string | null
          food_id: string
          id: string
          quantity: number
          recipe_id: string
          unit: string
        }
        Insert: {
          created_at?: string | null
          food_id: string
          id?: string
          quantity: number
          recipe_id: string
          unit: string
        }
        Update: {
          created_at?: string | null
          food_id?: string
          id?: string
          quantity?: number
          recipe_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          servings: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          servings?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          servings?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          created_at: string | null
          date: string
          dog_id: string | null
          id: string
          notes: string | null
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string | null
          date?: string
          dog_id?: string | null
          id?: string
          notes?: string | null
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string | null
          date?: string
          dog_id?: string | null
          id?: string
          notes?: string | null
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fuzzy_search_foods: {
        Args: { match_limit?: number; search_query: string }
        Returns: {
          brand: string
          calories_per_serving: number
          carbs_g: number
          created_at: string
          fat_g: number
          fiber_g: number
          id: string
          is_verified: boolean
          name: string
          protein_g: number
          serving_size: number
          similarity: number
          sodium_mg: number
          sugar_g: number
          updated_at: string
        }[]
      }
      get_daily_nutrition: {
        Args: { p_date?: string; p_user_id: string }
        Returns: {
          total_calories: number
          total_carbs: number
          total_fat: number
          total_fiber: number
          total_protein: number
        }[]
      }
      get_nutrition_by_meal_type: {
        Args: { p_date?: string; p_user_id: string }
        Returns: {
          calories: number
          carbs: number
          fat: number
          fiber: number
          meal_type: Database["public"]["Enums"]["meal_type"]
          protein: number
        }[]
      }
      search_foods_by_nutrient: {
        Args: {
          limit_count?: number
          min_amount?: number
          nutrient_name: string
        }
        Returns: {
          brand: string
          calories_per_serving: number
          carbs_g: number
          fat_g: number
          fiber_g: number
          id: string
          name: string
          nutrient_amount: number
          nutrient_unit: string
          protein_g: number
          serving_size: number
          serving_unit: string
        }[]
      }
    }
    Enums: {
      activity_level:
        | "sedentary"
        | "lightly_active"
        | "moderately_active"
        | "very_active"
        | "extremely_active"
      dog_activity_level:
        | "sedentary"
        | "lightly_active"
        | "moderately_active"
        | "very_active"
        | "working"
      dog_life_stage: "puppy" | "adult" | "senior" | "pregnant" | "lactating"
      goal_type:
        | "lose_weight"
        | "maintain_weight"
        | "gain_weight"
        | "build_muscle"
      meal_source: "manual" | "photo" | "recipe"
      meal_type: "breakfast" | "lunch" | "dinner" | "snack"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_level: [
        "sedentary",
        "lightly_active",
        "moderately_active",
        "very_active",
        "extremely_active",
      ],
      dog_activity_level: [
        "sedentary",
        "lightly_active",
        "moderately_active",
        "very_active",
        "working",
      ],
      dog_life_stage: ["puppy", "adult", "senior", "pregnant", "lactating"],
      goal_type: [
        "lose_weight",
        "maintain_weight",
        "gain_weight",
        "build_muscle",
      ],
      meal_source: ["manual", "photo", "recipe"],
      meal_type: ["breakfast", "lunch", "dinner", "snack"],
    },
  },
} as const
