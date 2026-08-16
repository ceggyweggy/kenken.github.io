-- Multiplayer rooms, race mode: every player gets an independent grid for
-- the same shared puzzle; whoever completes it correctly first wins.

create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  size int not null,
  solution jsonb not null,        -- solution[row][col], 0-indexed, matches src/lib/kenken.ts
  clues jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  solved_by uuid references auth.users(id),
  solved_at timestamptz
);

create table room_players (
  room_id uuid not null references rooms(id) on delete cascade,
  player_id uuid not null references auth.users(id),
  nickname text not null default 'Player',
  joined_at timestamptz not null default now(),
  primary key (room_id, player_id)
);

-- Each player has their own independent cell state for the room's puzzle.
create table room_cells (
  room_id uuid not null references rooms(id) on delete cascade,
  player_id uuid not null references auth.users(id),
  row int not null,
  col int not null,
  value int,
  updated_at timestamptz not null default now(),
  primary key (room_id, player_id, row, col)
);

alter table rooms enable row level security;
alter table room_players enable row level security;
alter table room_cells enable row level security;

-- Anyone who has joined a room can see it and its players.
-- A plain `exists (select 1 from room_players ...)` inline in room_players'
-- own policy would be a Postgres RLS trap: any query touching room_players
-- (directly, or via another table's policy referencing it) re-enters that
-- same self-referential policy and Postgres throws "infinite recursion
-- detected in policy for relation room_players". A SECURITY DEFINER helper
-- checks membership without re-entering RLS, avoiding the recursion.
create or replace function is_room_member(p_room_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from room_players
    where room_id = p_room_id and player_id = auth.uid()
  );
$$;

grant execute on function is_room_member(uuid) to authenticated;

create policy "room members can read room" on rooms
  for select using (is_room_member(id));

create policy "authenticated users can create rooms" on rooms
  for insert with check (auth.uid() = created_by);

create policy "room members can read players" on room_players
  for select using (is_room_member(room_id));

create policy "users can join rooms as themselves" on room_players
  for insert with check (auth.uid() = player_id);

-- Race mode: a player's cell values are their own scratch work, not visible
-- to opponents (avoids letting anyone copy answers off the wire).
create policy "players can read their own cells" on room_cells
  for select using (auth.uid() = player_id);

create policy "players can write their own cells" on room_cells
  for insert with check (auth.uid() = player_id and is_room_member(room_id));

create policy "players can update their own cells" on room_cells
  for update using (auth.uid() = player_id) with check (auth.uid() = player_id);

-- A room can be looked up by its shareable code before you've joined it
-- (bare code + size only — no solution/clues leak pre-membership).
create or replace function find_room_by_code(p_code text)
returns table (id uuid, code text, size int)
language sql
security definer
set search_path = public
as $$
  select id, code, size from rooms where code = p_code;
$$;

grant execute on function find_room_by_code(text) to authenticated;

-- Clients can never write solved_by/solved_at directly — only the trigger
-- below can, since it runs as the function owner regardless of RLS.
revoke update (solved_by, solved_at) on rooms from authenticated;

create or replace function check_room_solved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r_solution jsonb;
  r_size int;
  r_already_solved boolean;
  total_cells int;
  matching_cells int;
begin
  select solution, size, (solved_at is not null)
    into r_solution, r_size, r_already_solved
    from rooms
    where id = new.room_id
    for update; -- locks the room row; serializes concurrent finishes for a deterministic winner

  if r_already_solved then
    return new;
  end if;

  total_cells := r_size * r_size;

  select count(*) into matching_cells
    from room_cells rc
    where rc.room_id = new.room_id
      and rc.player_id = new.player_id
      and rc.value is not null
      and rc.value = (r_solution -> rc.row ->> rc.col)::int;

  if matching_cells = total_cells then
    update rooms
       set solved_by = new.player_id,
           solved_at = now()
     where id = new.room_id;
  end if;

  return new;
end;
$$;

create trigger room_cells_check_solved
  after insert or update of value on room_cells
  for each row
  execute function check_room_solved();

-- Realtime: broadcast each player's own cell fills back to themselves, the
-- solved stamp, and new-player joins to every room member.
alter publication supabase_realtime add table room_cells;
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table room_players;
