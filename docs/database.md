# Database Schema and Relationships

## Tables

### users

```sql
create table users (
  id uuid references auth.users primary key,
  email text unique,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  guest boolean default false
);
```

### user_profiles

```sql
create table user_profiles (
  id uuid references users(id) primary key,
  height numeric,
  weight numeric,
  target_calories integer,
  dietary_restrictions text[],
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### food_logs

```sql
create table food_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references users(id) not null,
  food_id text not null,
  serving_size numeric not null,
  meal_type text not null,
  logged_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### saved_foods

```sql
create table saved_foods (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references users(id) not null,
  food_id text not null,
  food_data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, food_id)
);
```

## Row Level Security (RLS) Policies

### users

```sql
create policy "Users can read own profile"
  on users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on users for update
  using (auth.uid() = id);
```

### user_profiles

```sql
create policy "Users can read own profile data"
  on user_profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile data"
  on user_profiles for update
  using (auth.uid() = id);
```

### food_logs

```sql
create policy "Users can read own food logs"
  on food_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own food logs"
  on food_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own food logs"
  on food_logs for delete
  using (auth.uid() = user_id);
```

### saved_foods

```sql
create policy "Users can read own saved foods"
  on saved_foods for select
  using (auth.uid() = user_id);

create policy "Users can insert own saved foods"
  on saved_foods for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own saved foods"
  on saved_foods for delete
  using (auth.uid() = user_id);
```

## Relationships

1. **users → user_profiles**

   - One-to-one relationship
   - User profile contains additional user data

2. **users → food_logs**

   - One-to-many relationship
   - Each user can have multiple food log entries

3. **users → saved_foods**
   - One-to-many relationship
   - Users can save multiple foods for quick access

## Indexes

```sql
create index food_logs_user_id_idx on food_logs(user_id);
create index food_logs_logged_at_idx on food_logs(logged_at);
create index saved_foods_user_id_idx on saved_foods(user_id);
```

## Functions and Triggers

### update_updated_at

```sql
create function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_user_profiles_updated_at
  before update on user_profiles
  for each row
  execute function update_updated_at();
```

## Guest Mode Considerations

- Guest users have the `guest` flag set to true in the users table
- Limited access to certain features through RLS policies
- Data cleanup scheduled for guest accounts older than 24 hours
