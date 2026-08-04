import type { PublicPlayer } from "@mafija/shared";

interface Props {
  players: PublicPlayer[];
  myId?: string;
  /** Ako je postavljeno, plocice postaju klikabilne (biranje mete nocu/glasanje). */
  selected?: string | null;
  onSelect?: (id: string) => void;
  /** Da li mrtvi igraci dobijaju precrtan prikaz (crveni X). */
  showDead?: boolean;
}

/**
 * Galerija igraca — slika (ili inicijal ako selfie jos nije stigao) + ime,
 * najvise 2 reda (do 3 igraca staje u jedan red, jedan pored drugog —
 * ne jedan ispod drugog), broj kolona zavisi od broja igraca. Koristi se
 * i za "koga biras" (nocne akcije, glasanje) i za prikaz van diskusije
 * (umesto live videa, dok su kamere ugasene).
 */
export default function PhotoGrid({ players, myId, selected, onSelect, showDead = false }: Props) {
  const rows = players.length <= 3 ? 1 : 2;
  const columns = Math.max(1, Math.ceil(players.length / rows));
  return (
    <div
      className="grid gap-2"
      style={{
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridAutoFlow: "column",
      }}
    >
      {players.map((p) => (
        <PhotoTile
          key={p.id}
          player={p}
          isMe={p.id === myId}
          selected={selected === p.id}
          selectable={!!onSelect}
          dead={showDead && !p.alive}
          onClick={onSelect ? () => onSelect(p.id) : undefined}
        />
      ))}
    </div>
  );
}

export function PhotoTile({
  player,
  isMe,
  selected,
  selectable,
  dead,
  onClick,
}: {
  player: PublicPlayer;
  isMe: boolean;
  selected: boolean;
  selectable: boolean;
  dead: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!selectable}
      className={`relative flex aspect-square flex-col justify-end overflow-hidden rounded border transition-colors ${
        selected ? "border-seal" : "border-smoke-700"
      } ${selectable ? "cursor-pointer hover:border-brass/50" : "cursor-default"}`}
    >
      {player.photoUrl ? (
        <img src={player.photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-smoke-800 font-display text-2xl text-paper-dim">
          {player.name.charAt(0).toUpperCase()}
        </div>
      )}
      {dead && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <span className="text-4xl font-black text-seal-bright">✕</span>
        </div>
      )}
      <span className="relative z-10 w-full truncate bg-black/60 px-1 py-0.5 text-center text-xs text-paper">
        {player.name}
        {isMe && " (ti)"}
      </span>
    </button>
  );
}
