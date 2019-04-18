import tenuki from "./libs/tenuki/tenuki.min.js";
import {
  constant,
  tap,
  runEffects,
  mergeArray,
  combineArray,
  startWith,
  map,
  multicast,
  combine,
} from "@most/core";
import { click, input } from "@most/dom-event";
import { newDefaultScheduler, currentTime } from "@most/scheduler";
import { create, event } from "most-subject";

type KoRule =
  | "simple" // Default. Immediately recreating the previous board position is illegal.
  | "positional-superko" // Recreating any previous position is illegal.
  | "situational-superko" // It is illegal for a player to recreate any previous position which that same player was responsible for creating. This is like positional superko, but takes into account the creator of the position.
  | "natural-situational-superko"; // The same as situational superko, except a player may place a stone to recreate a previous position, provided that previous position was created by a pass. This is like natural situational superko, but distinguishes between passes and board plays. More details can be found at Sensei's Library.

type Scoring = "area" | "territory" | "equivalence"; // "territory" is default.

interface GameSettings {
  element?: any; // default undefined, will be a game without a gui.
  boardSize?: number; // default 19
  fuzzyStonePlacement?: boolean; // default false
  handicapStones?: number; // default 0
  freeHandicapPlacement?: boolean; // default false
  scoring?: Scoring; // default is territory
  komi?: number; // default 0
  koRule?: KoRule; // default "simple"
}

interface Action {
  type: "undo" | "pass" | "resign";
  payload?: any;
}

const defaultSettings: GameSettings = {
  boardSize: 13,
  komi: 0.5,
  koRule: "simple" as KoRule,
};

const qs = selector => document.querySelector(selector);

const getValue = (e): KoRule => e.target.value;
const toNumber = e => Number(getValue(e));

// Game control elements.
const boardElement = qs(".tenuki-board");
const passButton = qs(".pass");
const undoButton = qs(".undo");
const resignButton = qs(".resign");
const restartButton = qs(".restart");
// Game settings elements.
const boardSizeInput = qs(".size");
const komiInput = qs(".komi");
const koRuleSelect = qs(".ko-rule");

// Game control streams.
const pass$ = constant({ type: "pass" } as Action, click(passButton));
const undo$ = constant({ type: "undo" } as Action, click(undoButton));
const resign$ = constant({ type: "resign" } as Action, click(resignButton));
const restart$ = constant("restart", click(restartButton));
// Game settings streams.
const boardSize$ = startWith(
  defaultSettings.boardSize,
  map(toNumber, input(boardSizeInput))
);
const komi$ = startWith(defaultSettings.komi, map(toNumber, input(komiInput)));
const koRule$ = startWith(
  defaultSettings.koRule,
  map(getValue, input(koRuleSelect))
);

const scheduler = newDefaultScheduler();

const [gameStateSink, gameState$] = create();

// Unfortunately there is no way to clean up after a game.
// So we need to have a static version here instead of creating new games in a stream.

// Start a new game and set up a listener for new game state.
const game = new tenuki.Game({ ...defaultSettings, element: boardElement });
game.callbacks.postRender = game => {
  event(currentTime(scheduler), game.currentState(), gameStateSink);
};
const gameStateEffects$ = tap(
  state => console.log("game state:", state),
  gameState$
);

// Setup the game controllers
const gameControlEffects = (game, action: Action) => {
  console.log("action:", action);
  switch (action.type) {
    case "pass":
    case "undo":
      game[action.type]();
      break;
    default:
      console.log(`unknown action with type: ${action.type}`);
      break;
  }
};
const gameSettings$ = combineArray(
  (boardSize, komi, koRule): GameSettings => ({ boardSize, komi, koRule }),
  [boardSize$, komi$, koRule$]
);

const restartGame = (settings: GameSettings) => {
  console.log("settings", settings);
  game._moves = []; // reset game,
  // This does not work... it does not rerender with new size.
  //game._validateOptions(settings); // maybe?
  //game._configureOptions(settings); // maybe?
  //game.boardSize = settings.boardSize;
  //game.handicapStones = settings.handicapStones;
  //game._freeHandicapPlacement = settings.freeHandicapPlacement;
  boardElement.innerHTML = "";
  game._setup(settings);
  game.callbacks.postRender = game => {
    event(currentTime(scheduler), game.currentState(), gameStateSink);
  };
  game.render(); // make reset visible.
  return game;
};

const game$ = multicast(map(restartGame, gameSettings$));
const gameControls$ = mergeArray([pass$, undo$, resign$]);
const gameControlsEffects$ = combine(
  (game, action) => gameControlEffects(game, action),
  game$,
  gameControls$
);

runEffects(gameControlsEffects$, scheduler);
runEffects(gameStateEffects$, scheduler);
