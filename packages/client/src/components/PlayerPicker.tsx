import type { PublicPlayer } from "@mafija/shared";

interface Props {
  players: PublicPlayer[];
  selected: string | null;
  onSelect: (id: string) => void;
}

/** Lista igraca za biranje mete — koristi se i za nocne akcije i za glasanje. */
export default function PlayerPicker({ players, selected, onSelect }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {players.map((p) => (
        <li key={p.id}>
          <button
            onClick={() => onSelect(p.id)}
            className={`w-full rounded border px-4 py-3 text-left transition-colors ${
              selected === p.id
                ? "border-seal bg-seal/20 text-paper"
                : "border-smoke-700 bg-smoke-900 text-paper hover:border-brass/50"
            }`}
          >
            {p.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
