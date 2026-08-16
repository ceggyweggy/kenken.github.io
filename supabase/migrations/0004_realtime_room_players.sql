-- room_players was never added to the realtime publication, so INSERT
-- events (a new player joining) never reached already-connected clients.

alter publication supabase_realtime add table room_players;
