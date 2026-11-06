-- SameScope schema. Plain Postgres, no extensions needed.

create table if not exists users (
  id serial primary key,
  email text unique not null,
  name text not null,
  password_hash text not null,
  role text not null check (role in ('homeowner', 'contractor')),
  phone text,
  city text not null default 'Bengaluru',
  business_name text,
  trades text[] not null default '{}',
  credits int not null default 10,
  jobs_completed int not null default 0,
  rating numeric(2,1),
  mcp_token text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id serial primary key,
  owner_id int not null references users(id) on delete cascade,
  title text not null,
  category text not null,
  city text not null,
  locality text not null default '',
  summary text not null default '',
  urgency text not null default 'this_month' check (urgency in ('urgent', 'this_week', 'this_month', 'flexible')),
  budget_min int,
  budget_max int,
  site_visit_questions text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'open', 'hired', 'closed')),
  created_via text not null default 'app' check (created_via in ('claude', 'app')),
  hired_quote_id int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists job_items (
  id serial primary key,
  job_id int not null references jobs(id) on delete cascade,
  position int not null,
  description text not null,
  quantity numeric not null default 1,
  unit text not null default 'job',
  notes text not null default ''
);

create table if not exists photos (
  id serial primary key,
  job_id int not null references jobs(id) on delete cascade,
  mime text not null,
  data bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists quotes (
  id serial primary key,
  job_id int not null references jobs(id) on delete cascade,
  contractor_id int not null references users(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted', 'accepted', 'declined')),
  days_to_complete int not null default 1,
  warranty_months int not null default 0,
  visit_fee int not null default 0,
  note text not null default '',
  created_via text not null default 'app' check (created_via in ('claude', 'app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, contractor_id)
);

create table if not exists quote_items (
  quote_id int not null references quotes(id) on delete cascade,
  job_item_id int not null references job_items(id) on delete cascade,
  price int not null,
  primary key (quote_id, job_item_id)
);

create table if not exists events (
  id serial primary key,
  job_id int not null references jobs(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists jobs_owner_idx on jobs(owner_id);
create index if not exists jobs_open_idx on jobs(status, city, category);
create index if not exists quotes_job_idx on quotes(job_id);
