# Apollo Ascent & Docking Simulator

A browser-based space simulation game recreating the Apollo Lunar Module ascent and docking procedure. Launch from the lunar surface and dock with the orbiting Command/Service Module.

## Play

Serve the project directory with any local HTTP server and open `apollo_docking.html`:

```
python3 -m http.server 8080
# then visit http://localhost:8080/apollo_docking.html
```

A server is needed because `game.js` is loaded as an ES module.

## How to Dock

1. **Launch** - Use main engine (↑) to lift off from the lunar surface
2. **Reach orbit** - Fly up to the blue CSM orbit line
3. **Match speed** - Press → until your horizontal velocity matches the CSM (Rel Vel X turns green)
4. **Approach** - Position yourself below the CSM's flashing docking port
5. **Dock** - Slow down and make contact with low relative velocity (both indicators green)

## Controls

| Key | Action |
|-----|--------|
| ↑ | Main Engine (thrust up) |
| ↓ | RCS Down |
| ← | RCS Left |
| → | RCS Right |
| P / ESC | Pause |
| T | Trophy Room |
| ? | Help |
| SPACE | Restart (after game over) |

Touch controls available on mobile devices.

## Features

- Realistic physics (gravity, inertia, thrust vectors)
- Fuel management
- Trajectory prediction line
- Visual docking aids and approach guidance
- 8 achievements to unlock
- Scoring system based on fuel, time, and precision
- Sound effects
- Mobile support with touch controls

## Tech

Vanilla JavaScript with zero runtime dependencies. No build step.

- `apollo_docking.html` — markup and styles
- `game.js` — all game logic (ES module)

## Development

```
npm install
npm test            # run all tests (vitest)
npm run test:watch  # re-run on file changes
```

### Test Coverage

3 test files covering core exported game logic:

| File | Area |
|------|------|
| `tests/unit/core-logic.test.js` | Physics, scoring, achievements, approach status, docking collision |
| `tests/unit/game-systems.test.js` | Particles, celebration effects, audio, rendering |
| `tests/component/game.test.js` | LM, CSM, game controller |

## License

Educational project for learning physics simulation and game development.
