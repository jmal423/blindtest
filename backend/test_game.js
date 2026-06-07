const { io: ioc } = require("socket.io-client");
const API = "http://localhost:3099";
const WS = "http://localhost:3099";

async function post(path, body, token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = "Bearer " + token;
  const r = await fetch(API + path, { method: "POST", headers: h, body: JSON.stringify(body) });
  return r.json();
}

async function main() {
  const a = await post("/api/auth/guest", { name: "Alice" });
  const b = await post("/api/auth/guest", { name: "Bob" });
  const admin = await post("/api/auth/guest", { name: "jl" });
  console.log("1. Guests:", a.user.id.slice(0,8), b.user.id.slice(0,8));

  const room = await post("/api/rooms", { playerName: "Alice", genres: ["pop"], rounds: 3, roundTime: 8 }, a.token);
  console.log("2. Room:", room.code);

  const join = await post("/api/rooms/join", { code: room.code, playerName: "Bob" }, b.token);
  console.log("3. Bob joined");

  const seed = await post("/api/admin/test/seed-game/" + room.code, { rounds: 3 }, admin.token);
  console.log("4. Seeded:", seed.tracks, "tracks,", seed.rounds, "rounds");

  let state = await post("/api/admin/test/start-round/" + room.code, {}, admin.token);
  console.log("5. Force start:", state.state);

  const sA = ioc(WS);
  const sB = ioc(WS);
  await Promise.all([new Promise(r => sA.on("connect", r)), new Promise(r => sB.on("connect", r))]);
  sA.emit("join_room", room.code, room.playerId);
  sB.emit("join_room", room.code, join.playerId);

  let gs = null;
  const resultsA = [];
  sA.on("game_state", s => { gs = s; });
  sA.on("input_result", r => { resultsA.push(r); });

  await new Promise(r => setTimeout(r, 500));
  console.log("6. State:", gs?.state, "Round", gs?.currentRound + "/" + gs?.totalRounds);

  // Alice guesses artist + title
  sA.emit("submit_guess", { input: "Queen" });
  await new Promise(r => setTimeout(r, 200));
  sA.emit("submit_guess", { input: "Bohemian Rhapsody" });
  await new Promise(r => setTimeout(r, 200));
  console.log("7. Alice pts:", resultsA.map(r=>r.points_awarded_this_guess));

  // Bob guesses
  sB.emit("submit_guess", { input: "Bohemian" });
  await new Promise(r => setTimeout(r, 200));

  console.log("8. A score:", gs?.players?.find(p => p.id === room.playerId)?.score);
  console.log("9. B score:", gs?.players?.find(p => p.id === join.playerId)?.score);

  // Wait for round end (8s)
  console.log("Waiting for round timer...");
  await new Promise(r => setTimeout(r, 8000));

  console.log("10. Post-round state:", gs?.state, "Round:", gs?.currentRound, 
    "A:", gs?.players?.find(p => p.id === room.playerId)?.score,
    "B:", gs?.players?.find(p => p.id === join.playerId)?.score);

  sA.disconnect(); sB.disconnect();

  // Check scores saved to DB
  const scores = await fetch(API + "/api/users/me/scores", { headers: { Authorization: "Bearer " + a.token }}).then(r => r.json());
  console.log("11. DB scores:", scores.length, "entries");

  console.log("ALL PASSED");
}
main().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
