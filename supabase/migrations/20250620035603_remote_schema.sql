drop trigger if exists "handle_updated_at_foods" on "public"."foods";

drop trigger if exists "handle_updated_at_meals" on "public"."meals";

drop trigger if exists "handle_updated_at_profiles" on "public"."profiles";

drop policy "Users can delete own exercise logs" on "public"."exercise_logs";

drop policy "Users can insert own exercise logs" on "public"."exercise_logs";

drop policy "Users can update own exercise logs" on "public"."exercise_logs";

drop policy "Users can view own exercise logs" on "public"."exercise_logs";

drop policy "Anyone can view foods" on "public"."foods";

drop policy "Authenticated users can insert foods" on "public"."foods";

drop policy "Users can update own foods" on "public"."foods";

drop policy "Users can delete own meal items" on "public"."meal_items";

drop policy "Users can insert own meal items" on "public"."meal_items";

drop policy "Users can update own meal items" on "public"."meal_items";

drop policy "Users can view own meal items" on "public"."meal_items";

drop policy "Users can delete own meals" on "public"."meals";

drop policy "Users can insert own meals" on "public"."meals";

drop policy "Users can update own meals" on "public"."meals";

drop policy "Users can view own meals" on "public"."meals";

drop policy "Users can insert own profile" on "public"."profiles";

drop policy "Users can update own profile" on "public"."profiles";

drop policy "Users can view own profile" on "public"."profiles";

drop policy "Users can delete own water intake" on "public"."water_intake";

drop policy "Users can insert own water intake" on "public"."water_intake";

drop policy "Users can update own water intake" on "public"."water_intake";

drop policy "Users can view own water intake" on "public"."water_intake";

drop policy "Users can delete own weight logs" on "public"."weight_logs";

drop policy "Users can insert own weight logs" on "public"."weight_logs";

drop policy "Users can update own weight logs" on "public"."weight_logs";

drop policy "Users can view own weight logs" on "public"."weight_logs";

revoke delete on table "public"."exercise_logs" from "anon";

revoke insert on table "public"."exercise_logs" from "anon";

revoke references on table "public"."exercise_logs" from "anon";

revoke select on table "public"."exercise_logs" from "anon";

revoke trigger on table "public"."exercise_logs" from "anon";

revoke truncate on table "public"."exercise_logs" from "anon";

revoke update on table "public"."exercise_logs" from "anon";

revoke delete on table "public"."exercise_logs" from "authenticated";

revoke insert on table "public"."exercise_logs" from "authenticated";

revoke references on table "public"."exercise_logs" from "authenticated";

revoke select on table "public"."exercise_logs" from "authenticated";

revoke trigger on table "public"."exercise_logs" from "authenticated";

revoke truncate on table "public"."exercise_logs" from "authenticated";

revoke update on table "public"."exercise_logs" from "authenticated";

revoke delete on table "public"."exercise_logs" from "service_role";

revoke insert on table "public"."exercise_logs" from "service_role";

revoke references on table "public"."exercise_logs" from "service_role";

revoke select on table "public"."exercise_logs" from "service_role";

revoke trigger on table "public"."exercise_logs" from "service_role";

revoke truncate on table "public"."exercise_logs" from "service_role";

revoke update on table "public"."exercise_logs" from "service_role";

revoke delete on table "public"."foods" from "anon";

revoke insert on table "public"."foods" from "anon";

revoke references on table "public"."foods" from "anon";

revoke select on table "public"."foods" from "anon";

revoke trigger on table "public"."foods" from "anon";

revoke truncate on table "public"."foods" from "anon";

revoke update on table "public"."foods" from "anon";

revoke delete on table "public"."foods" from "authenticated";

revoke insert on table "public"."foods" from "authenticated";

revoke references on table "public"."foods" from "authenticated";

revoke select on table "public"."foods" from "authenticated";

revoke trigger on table "public"."foods" from "authenticated";

revoke truncate on table "public"."foods" from "authenticated";

revoke update on table "public"."foods" from "authenticated";

revoke delete on table "public"."foods" from "service_role";

revoke insert on table "public"."foods" from "service_role";

revoke references on table "public"."foods" from "service_role";

revoke select on table "public"."foods" from "service_role";

revoke trigger on table "public"."foods" from "service_role";

revoke truncate on table "public"."foods" from "service_role";

revoke update on table "public"."foods" from "service_role";

revoke delete on table "public"."meal_items" from "anon";

revoke insert on table "public"."meal_items" from "anon";

revoke references on table "public"."meal_items" from "anon";

revoke select on table "public"."meal_items" from "anon";

revoke trigger on table "public"."meal_items" from "anon";

revoke truncate on table "public"."meal_items" from "anon";

revoke update on table "public"."meal_items" from "anon";

revoke delete on table "public"."meal_items" from "authenticated";

revoke insert on table "public"."meal_items" from "authenticated";

revoke references on table "public"."meal_items" from "authenticated";

revoke select on table "public"."meal_items" from "authenticated";

revoke trigger on table "public"."meal_items" from "authenticated";

revoke truncate on table "public"."meal_items" from "authenticated";

revoke update on table "public"."meal_items" from "authenticated";

revoke delete on table "public"."meal_items" from "service_role";

revoke insert on table "public"."meal_items" from "service_role";

revoke references on table "public"."meal_items" from "service_role";

revoke select on table "public"."meal_items" from "service_role";

revoke trigger on table "public"."meal_items" from "service_role";

revoke truncate on table "public"."meal_items" from "service_role";

revoke update on table "public"."meal_items" from "service_role";

revoke delete on table "public"."meals" from "anon";

revoke insert on table "public"."meals" from "anon";

revoke references on table "public"."meals" from "anon";

revoke select on table "public"."meals" from "anon";

revoke trigger on table "public"."meals" from "anon";

revoke truncate on table "public"."meals" from "anon";

revoke update on table "public"."meals" from "anon";

revoke delete on table "public"."meals" from "authenticated";

revoke insert on table "public"."meals" from "authenticated";

revoke references on table "public"."meals" from "authenticated";

revoke select on table "public"."meals" from "authenticated";

revoke trigger on table "public"."meals" from "authenticated";

revoke truncate on table "public"."meals" from "authenticated";

revoke update on table "public"."meals" from "authenticated";

revoke delete on table "public"."meals" from "service_role";

revoke insert on table "public"."meals" from "service_role";

revoke references on table "public"."meals" from "service_role";

revoke select on table "public"."meals" from "service_role";

revoke trigger on table "public"."meals" from "service_role";

revoke truncate on table "public"."meals" from "service_role";

revoke update on table "public"."meals" from "service_role";

revoke delete on table "public"."profiles" from "anon";

revoke insert on table "public"."profiles" from "anon";

revoke references on table "public"."profiles" from "anon";

revoke select on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke update on table "public"."profiles" from "anon";

revoke delete on table "public"."profiles" from "authenticated";

revoke insert on table "public"."profiles" from "authenticated";

revoke references on table "public"."profiles" from "authenticated";

revoke select on table "public"."profiles" from "authenticated";

revoke trigger on table "public"."profiles" from "authenticated";

revoke truncate on table "public"."profiles" from "authenticated";

revoke update on table "public"."profiles" from "authenticated";

revoke delete on table "public"."profiles" from "service_role";

revoke insert on table "public"."profiles" from "service_role";

revoke references on table "public"."profiles" from "service_role";

revoke select on table "public"."profiles" from "service_role";

revoke trigger on table "public"."profiles" from "service_role";

revoke truncate on table "public"."profiles" from "service_role";

revoke update on table "public"."profiles" from "service_role";

revoke delete on table "public"."water_intake" from "anon";

revoke insert on table "public"."water_intake" from "anon";

revoke references on table "public"."water_intake" from "anon";

revoke select on table "public"."water_intake" from "anon";

revoke trigger on table "public"."water_intake" from "anon";

revoke truncate on table "public"."water_intake" from "anon";

revoke update on table "public"."water_intake" from "anon";

revoke delete on table "public"."water_intake" from "authenticated";

revoke insert on table "public"."water_intake" from "authenticated";

revoke references on table "public"."water_intake" from "authenticated";

revoke select on table "public"."water_intake" from "authenticated";

revoke trigger on table "public"."water_intake" from "authenticated";

revoke truncate on table "public"."water_intake" from "authenticated";

revoke update on table "public"."water_intake" from "authenticated";

revoke delete on table "public"."water_intake" from "service_role";

revoke insert on table "public"."water_intake" from "service_role";

revoke references on table "public"."water_intake" from "service_role";

revoke select on table "public"."water_intake" from "service_role";

revoke trigger on table "public"."water_intake" from "service_role";

revoke truncate on table "public"."water_intake" from "service_role";

revoke update on table "public"."water_intake" from "service_role";

revoke delete on table "public"."weight_logs" from "anon";

revoke insert on table "public"."weight_logs" from "anon";

revoke references on table "public"."weight_logs" from "anon";

revoke select on table "public"."weight_logs" from "anon";

revoke trigger on table "public"."weight_logs" from "anon";

revoke truncate on table "public"."weight_logs" from "anon";

revoke update on table "public"."weight_logs" from "anon";

revoke delete on table "public"."weight_logs" from "authenticated";

revoke insert on table "public"."weight_logs" from "authenticated";

revoke references on table "public"."weight_logs" from "authenticated";

revoke select on table "public"."weight_logs" from "authenticated";

revoke trigger on table "public"."weight_logs" from "authenticated";

revoke truncate on table "public"."weight_logs" from "authenticated";

revoke update on table "public"."weight_logs" from "authenticated";

revoke delete on table "public"."weight_logs" from "service_role";

revoke insert on table "public"."weight_logs" from "service_role";

revoke references on table "public"."weight_logs" from "service_role";

revoke select on table "public"."weight_logs" from "service_role";

revoke trigger on table "public"."weight_logs" from "service_role";

revoke truncate on table "public"."weight_logs" from "service_role";

revoke update on table "public"."weight_logs" from "service_role";

alter table "public"."exercise_logs" drop constraint "exercise_logs_user_id_fkey";

alter table "public"."foods" drop constraint "foods_barcode_key";

alter table "public"."foods" drop constraint "foods_created_by_fkey";

alter table "public"."meal_items" drop constraint "meal_items_food_id_fkey";

alter table "public"."meal_items" drop constraint "meal_items_meal_id_fkey";

alter table "public"."meals" drop constraint "meals_user_id_fkey";

alter table "public"."profiles" drop constraint "profiles_email_key";

alter table "public"."profiles" drop constraint "profiles_gender_check";

alter table "public"."profiles" drop constraint "profiles_id_fkey";

alter table "public"."water_intake" drop constraint "water_intake_user_id_fkey";

alter table "public"."weight_logs" drop constraint "weight_logs_user_id_fkey";

drop function if exists "public"."get_daily_nutrition"(p_user_id uuid, p_date date);

drop function if exists "public"."get_nutrition_by_meal_type"(p_user_id uuid, p_date date);

drop function if exists "public"."handle_new_user"();

drop function if exists "public"."handle_updated_at"();

alter table "public"."exercise_logs" drop constraint "exercise_logs_pkey";

alter table "public"."foods" drop constraint "foods_pkey";

alter table "public"."meal_items" drop constraint "meal_items_pkey";

alter table "public"."meals" drop constraint "meals_pkey";

alter table "public"."profiles" drop constraint "profiles_pkey";

alter table "public"."water_intake" drop constraint "water_intake_pkey";

alter table "public"."weight_logs" drop constraint "weight_logs_pkey";

drop index if exists "public"."exercise_logs_pkey";

drop index if exists "public"."foods_barcode_key";

drop index if exists "public"."foods_pkey";

drop index if exists "public"."idx_exercise_logs_user_date";

drop index if exists "public"."idx_foods_barcode";

drop index if exists "public"."idx_foods_name";

drop index if exists "public"."idx_meal_items_meal_id";

drop index if exists "public"."idx_meals_date";

drop index if exists "public"."idx_meals_user_date";

drop index if exists "public"."idx_profiles_email";

drop index if exists "public"."idx_water_intake_user_date";

drop index if exists "public"."idx_weight_logs_user_date";

drop index if exists "public"."meal_items_pkey";

drop index if exists "public"."meals_pkey";

drop index if exists "public"."profiles_email_key";

drop index if exists "public"."profiles_pkey";

drop index if exists "public"."water_intake_pkey";

drop index if exists "public"."weight_logs_pkey";

drop table "public"."exercise_logs";

drop table "public"."foods";

drop table "public"."meal_items";

drop table "public"."meals";

drop table "public"."profiles";

drop table "public"."water_intake";

drop table "public"."weight_logs";

drop type "public"."activity_level";

drop type "public"."goal_type";

drop type "public"."meal_type";


