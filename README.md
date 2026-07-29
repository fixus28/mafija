# Mafija

Veb-aplikacija za igranje društvene igre Mafija u realnom vremenu — diplomski rad.

**Faza 1 (ovaj kod):** monorepo, tipizirani Socket.IO protokol, kreiranje sobe sa kodom,
pridruživanje, lobi sa listom igrača uživo, reconnect posle refresh-a / pada mreže.

## Struktura

```
packages/
├── shared/   # zajednički TypeScript tipovi: faze, uloge, protokol događaja, konstante
├── server/   # Node.js + Socket.IO — izvor istine za stanje igre
└── client/   # React + Vite + Tailwind — UI (Home + Lobby)
```

Ključni princip: **server je autoritativan**. Klijent nikad ne dobija informacije koje
njegov igrač ne sme da vidi (u fazi 1 to znači da javno stanje ne sadrži sessionId-jeve;
od faze 3 to znači da se uloge šalju isključivo privatno).

## Pokretanje (potreban Node.js 20+)

```bash
npm install          # jednom, iz korena projekta

# terminal 1 — server (port 3001)
npm run dev:server

# terminal 2 — klijent (port 5173)
npm run dev:client
```

Otvori `http://localhost:5173` u dva-tri taba (ili sa telefona preko lokalne IP adrese
računara, npr. `http://192.168.x.x:5173`) — napravi sobu u jednom, uđi kodom iz drugih.

## Šta testirati

- Kreiranje sobe → kod se prikazuje, klik na pečat kopira kod
- Ulazak kodom iz drugog taba → oba taba odmah vide ažuriranu listu
- Refresh taba usred lobija → igrač se vraća na svoje mesto (isti `sessionId`)
- Zatvaranje taba → ostali vide „veza pukla…", igrač ostaje u listi
- „Napusti sobu" domaćina → uloga domaćina prelazi na sledećeg igrača
- Dupla imena, pogrešan kod, puna soba → jasne poruke o grešci

## Sledeće faze

3. Game engine: mašina stanja faza, podela uloga, noć, glasanje (bez videa)
4. Video: LiveKit (SFU), video grid
5. Vezivanje kamera za faze igre, TTS narator
6. Deployment (Docker Compose na VPS)

Napomena: `MIN_PLAYERS` je privremeno 4 (radi testiranja) — podići na 6 pred odbranu
(`packages/shared/src/constants.ts`).
