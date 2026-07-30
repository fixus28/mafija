import type { PublicPlayer } from "@mafija/shared";
import PhotoGrid from "./PhotoGrid";

interface Props {
  players: PublicPlayer[];
  selected: string | null;
  onSelect: (id: string) => void;
}

/** Galerija igraca za biranje mete — koristi se i za nocne akcije i za glasanje. */
export default function PlayerPicker({ players, selected, onSelect }: Props) {
  return <PhotoGrid players={players} selected={selected} onSelect={onSelect} />;
}
