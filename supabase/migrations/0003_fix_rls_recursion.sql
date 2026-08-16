-- room_players' own SELECT policy queried room_players from inside itself to
-- check membership, which is a Postgres RLS trap: any query touching
-- room_players (directly, or via rooms/room_cells policies referencing it)
-- re-enters that same self-referential policy and Postgres throws
-- "infinite recursion detected in policy for relation room_players" — which
-- PostgREST surfaces as a 500. A SECURITY DEFINER helper checks membership
-- without re-entering RLS, breaking the recursion.

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

drop policy if exists "room members can read room" on rooms;
create policy "room members can read room" on rooms
  for select using (is_room_member(id));

drop policy if exists "room members can read players" on room_players;
create policy "room members can read players" on room_players
  for select using (is_room_member(room_id));

drop policy if exists "players can write their own cells" on room_cells;
create policy "players can write their own cells" on room_cells
  for insert with check (auth.uid() = player_id and is_room_member(room_id));
