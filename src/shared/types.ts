export type PlayerColor = "black" | "white";

export type GameStatus = "waiting" | "active" | "ended";

export type GameMode = "cpu" | "friend";

export type PieceType =
  | "pawn"
  | "lance"
  | "knight"
  | "silver"
  | "gold"
  | "bishop"
  | "rook"
  | "king"
  | "promPawn"
  | "promLance"
  | "promKnight"
  | "promSilver"
  | "horse"
  | "dragon";

export type HandPieceType = Extract<
  PieceType,
  "pawn" | "lance" | "knight" | "silver" | "gold" | "bishop" | "rook"
>;

export type UserSummary = {
  id: string;
  handle: string;
  displayName: string;
};

export type SessionPayload = {
  user: UserSummary | null;
};

export type BoardPiece = {
  color: PlayerColor;
  type: PieceType;
  label: string;
};

export type BoardSquare = {
  square: string;
  file: number;
  rank: number;
  piece: BoardPiece | null;
};

export type HandPiece = {
  type: HandPieceType;
  label: string;
  count: number;
};

export type GameMove = {
  ply: number;
  usi: string;
  notation: string;
};

export type GamePlayer = UserSummary & {
  color: PlayerColor;
};

export type GameSnapshot = {
  id: string;
  mode: GameMode;
  status: GameStatus;
  sfen: string;
  currentTurn: PlayerColor;
  version: number;
  lastEventSeq: number;
  players: {
    black: GamePlayer;
    white: GamePlayer | null;
  };
  winner: GamePlayer | null;
  endReason: "resign" | "checkmate" | "timeout" | "draw" | "foul" | null;
  board: BoardSquare[];
  hands: Record<PlayerColor, HandPiece[]>;
  moves: GameMove[];
  createdAt: string;
  updatedAt: string;
};

export type GameSummary = Pick<
  GameSnapshot,
  | "id"
  | "mode"
  | "status"
  | "currentTurn"
  | "version"
  | "lastEventSeq"
  | "players"
  | "winner"
  | "endReason"
  | "moves"
  | "createdAt"
  | "updatedAt"
>;

export type GameEvent = {
  id: string;
  gameId: string;
  seq: number;
  type: string;
  actorUserId: string | null;
  payload: unknown;
  clientRequestId: string | null;
  createdAt: string;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
  };
};

export type CreateGameResponse = {
  game: GameSnapshot;
};

export type GamesResponse = {
  games: GameSummary[];
};

export type GameResponse = {
  game: GameSnapshot;
};

export type GameEventsResponse = {
  events: GameEvent[];
};

export type MoveResponse = {
  game: GameSnapshot;
};
