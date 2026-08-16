-- Corrects 0001's live schema from shared collaborative cells to race
-- mode: each player gets an independent grid for the same puzzle, and the
-- first to complete it correctly wins. Run this once against a project
-- that already applied the original 0001 (no game data exists yet to lose).

drop trigger if exists room_cells_check_solved on room_cells;
drop function if exists check_room_solved();
drop table if exists room_cells;

create table room_cells (
  room_id uuid not null references rooms(id) on delete cascade,
  player_id uuid not null references auth.users(id),
  row int not null,
  col int not null,
  value int,
  updated_at timestamptz not null default now(),
  primary key (room_id, player_id, row, col)
);

alter table room_cells enable row level security;

create policy "players can read their own cells" on room_cells
  for select using (auth.uid() = player_id);

create policy "players can write their own cells" on room_cells
  for insert with check (
    auth.uid() = player_id
    and exists (select 1 from room_players p where p.room_id = room_cells.room_id and p.player_id = auth.uid())
  );

create policy "players can update their own cells" on room_cells
  for update using (auth.uid() = player_id) with check (auth.uid() = player_id);

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
    for update;

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

alter publication supabase_realtime add table room_cells;

-- Needed for the lobby to resolve a shareable code before joining.
alter table room_players add column if not exists nickname text not null default 'Player';

create or replace function find_room_by_code(p_code text)
returns table (id uuid, code text, size int)
language sql
security definer
set search_path = public
as $$
  select id, code, size from rooms where code = p_code;
$$;

grant execute on function find_room_by_code(text) to authenticated;
