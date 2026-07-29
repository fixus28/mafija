# CLAUDE.md — Mafija (diplomski rad, ETF)

## Šta je projekat

Veb-aplikacija za igranje društvene igre Mafija u realnom vremenu. Jedan igrač
kreira sobu i dobija kod, ostali (do 12) ulaze kodom. Ulogu naratora preuzima
aplikacija: vodi partiju kroz faze (noć: mafija bira žrtvu, doktor leči,
policajac proverava; dan: diskusija i glasanje). Tokom diskusije svima se
uključuju kamere/mikrofoni (video stiže kasnije, preko LiveKit SFU); van nje
sistem ih drži ugašenim.

## Arhitektura i principi (NE MENJATI bez razloga)

- npm workspaces monorepo: `packages/shared`, `packages/server`, `packages/client`
- **Server je autoritativan** — jedini izvor istine. Klijent NIKAD ne dobija
  informacije koje njegov igrač ne sme da vidi. Uloge se šalju isključivo
  privatno (`socket.emit` direktno igraču), nikad kroz `room:state`.
- **Tipizirani Socket.IO protokol** živi u `shared/src/events.ts`. Svaki novi
  događaj se PRVO dodaje tamo (payload + ack tipovi), pa onda server handler,
  pa klijent.
- Stanje sobe u memoriji servera (`Map<kod, Room>`), bez baze.
- Identitet igrača: `sessionId` (UUID) u **sessionStorage** (po tabu, preživi
  refresh) — reconnect radi tako što server po sessionId-ju prepozna igrača.
- Tajmeri (od faze 3): server šalje `phaseEndsAt` timestamp, klijent sam
  renderuje odbrojavanje. Server nikad ne strimuje "preostale sekunde".

## Tehnologije i komande

Node 20+, TypeScript strict svuda, Socket.IO 4, React 18 + Vite 6, Tailwind v4
(tokeni u `client/src/index.css` kroz `@theme`). Server dev: `tsx watch`.
Video (od faze 5): LiveKit (`livekit-server-sdk` na serveru,
`@livekit/components-react` + `livekit-client` na klijentu).

```
npm install                # koren, jednom
npm run dev:server         # port 3001
npm run dev:client         # port 5173
npm run typecheck -w @mafija/server   # (i -w @mafija/client)

# za video lokalno (van repoa, jednom preuzeto):
C:\Users\Legion\tools\livekit\livekit-server.exe --dev   # port 7880, devkey/secret
```

## Dizajn

Noir salon: boje `smoke` (topla tamna), `paper` (stari papir), `seal` (pečatni
crveni vosak), `brass` (mesing). Fontovi: Fraunces (display), IBM Plex Sans
(body), IBM Plex Mono (kodovi/oznake). Potpis dizajna: kod sobe kao ukošeni
"pečat". Svi UI tekstovi na srpskom, dosledan rečnik ("Pokreni partiju",
"Napusti sobu", "Domaćin").

## Pravila igre (dogovoreno)

- Faze: `LOBBY → ROLE_REVEAL → NIGHT → DAWN → DAY_DISCUSSION → VOTING →
  [MINI_DISCUSSION → VOTING]* → RESOLUTION → (provera pobede) → NIGHT…`,
  kraj u `GAME_OVER`. Deo u zagradi se ponavlja dok se glasanje ne resi
  (vidi "Nereseno" nize).
- Uloge: `MAFIA`, `ACCOMPLICE` (dama), `DOCTOR` (lekar), `DETECTIVE`
  (policajac), `CIVILIAN` (građanin). Dama igra samo sa 7+ igrača — ispod
  toga je jedina mračna uloga `MAFIA`, da partija ostane balansirana sa
  malo ljudi. Uvek tačno jedan lekar i jedan policajac, ostalo građani.
- Mafija i dama rade zajedno i znaju jedno za drugo — jedini slučaj da
  igrač zna tuđu ulogu (dobijaju to u privatnom role-reveal-u).
- Noć: sve uloge biraju ISTOVREMENO, prozor od 15–20s; server razrešava
  posle isteka (`packages/server/src/game/night.ts`):
  - mafija bira žrtvu, dama bira koga utišava, lekar bira koga leči,
    policajac bira koga proverava.
  - ako lekar pogodi metu mafije: niko ne umire, narator javlja "pokušaj
    ubistva"; inače meta mafije umire.
  - utišan igrač ne učestvuje u SLEDEĆOJ dnevnoj diskusiji (samo toj
    jednoj); slobodan je opet osim ako ga dama ponovo ne izabere.
  - policajac privatno dobija da li je meta `MAFIA`. Dama UVEK vraća
    "nije mafija", čak i dok još radi sa mafijom — to joj je jedina
    zaštita od otkrivanja.
- Dan: diskusija pa glasanje. Glasa se za živog igrača ili "preskoči".
  Uloga izbačenog igrača se NIKAD ne saopštava (namerno, radi težine igre).
  - "Preskoči" pobedi (strogom većinom, ili nerešeno naspram najviše
    JEDNOG igrača) → niko ne ispada, ide se dalje na `RESOLUTION`.
  - Nerešeno između DVA ILI VIŠE igrača → ti igrači NE glasaju u
    reglasavanju, bira se samo između njih (ili "preskoči"); pre toga
    kratka mini-diskusija (`MINI_DISCUSSION`, 4x kraća od redovne). Ovo
    se ponavlja dok se ne resi (`packages/server/src/game/voting.ts`,
    `resolveVote`).
- Posle glasanja (`packages/server/src/game/voting.ts`):
  - ako je izbačena `MAFIA`: dama (ako postoji) postaje nova `MAFIA`,
    gubi moć utišavanja.
  - ako je izbačena `ACCOMPLICE` (dama): mafija ostaje ista, ništa se
    ne menja.
  - u oba slučaja dame više nema i niko više ne može biti utišan.
- Pobeda (`packages/server/src/game/winCondition.ts`): grad pobeđuje kad
  više nema nijednog mračnog igrača (`MAFIA`+`ACCOMPLICE` = 0); mafija
  pobeđuje kad je broj mračnih ≥ broja ostalih živih. Provera ide posle
  SVAKE promene broja živih (noćno ubistvo i dnevna eliminacija) — mračni
  ne mogu da umru noću (mafija ne bira sebe za žrtvu), pa ova jedna
  provera pokriva oba uslova iz pravila.
- Mrtvi igrači = posmatrači (kasnije: kamera i mikrofon trajno ugašeni).
- `MIN_PLAYERS` je privremeno 4 radi testiranja (`shared/src/constants.ts`);
  podići na 6 (ili 7 da dama uvek bude u igri) pred odbranu.

## Status

- **GOTOVO (faze 1–2):** monorepo, tipizirani protokol, kreiranje sobe sa
  kodom, pridruživanje, lobi sa listom uživo, reconnect posle refresh-a,
  razlika napuštanje vs. pad veze, transfer domaćina, čišćenje praznih soba.
- **Primenjena ispravka:** `sessionId` prebačen iz localStorage u
  sessionStorage u `client/src/socket.ts` (localStorage je zajednički za
  tabove, pa je drugi tab bio tretiran kao reconnect prvog igrača). Ako
  ispravka nije u kodu — primeni je prvo.
- **GOTOVO (faza 3, srce projekta):** ceo game engine, server + klijent,
  testirano uživo (7 tabova, pun krug uklju­čujući konverziju dame u
  mafiju + policajčevu proveru posle nje, "preskoči" glasanje, i
  nerešeno→mini-diskusija→reglasavanje; bez grešaka u konzoli).
  - Čista logika u `packages/server/src/game/` — `roles.ts` (podela
    uloga), `night.ts` (razrešenje noći), `voting.ts` (glasanje sa
    "preskoči" i reglasavanjem + konverzija dame u mafiju),
    `winCondition.ts` (uslovi pobede). Sve odvojeno od Socket.IO sloja,
    pokriveno unit testovima (`node:test`, `npm run test -w @mafija/server`).
  - Orkestracija u `packages/server/src/phaseMachine.ts` — mašina stanja
    faza sa tajmerima (`phaseEndsAt` u `PublicRoomState`), zove čisti
    engine i emituje `game:role` (privatno, sa partnerom za mafiju/damu),
    `game:detectiveResult` (privatno), `narrator:message` (javno).
    Reconnect usred partije ponovo šalje ulogu (`resendRoleIfActive`).
  - Klijent: `client/src/components/Game.tsx` (+ `PlayerPicker.tsx`,
    `useCountdown.ts`, `roles.ts` za srpske labele) renderuje sve faze
    posle LOBBY-ja — role reveal, noćni izbor mete, dnevna diskusija
    (bez chata, dolazi sa videom), glasanje (sa "preskoči" i prikazom
    reglasavanja), kraj igre. Policajčeva "saznanja" prikazuju samo
    najnoviju proveru po igraču (starija je zastarela cim se uloga
    promeni).
  - Otvorene sitnice za kasnije fino podešavanje: tajmeri u
    `shared/src/constants.ts` su procena; da li lekar/mafija smeju da
    biraju sebe za metu nije ograničeno; glasanje za sebe je onemogućeno
    samo u UI, ne i na serveru.
- **GOTOVO (faza 4: VPS + HTTPS).** Igra je uživo na pravom internetu, van
  developerskog računara — testirano preko dva razdvojena uređaja/mreže
  (laptop + telefon na mobilnim podacima), soba i lista igrača rade.
  - **Deployment:** Hetzner VPS (Nürnberg, Ubuntu 24.04), Docker Compose sa
    dva servisa — `server` (Node/tsx, samo interno, bez izloženih portova)
    i `web` (Caddy: servira build klijenta, reverse-proxy `/socket.io/*` →
    server, automatski HTTPS preko Let's Encrypt). Definicije u `deploy/`
    na korenu repoa (`Dockerfile.server`, `Dockerfile.client`, `Caddyfile`,
    `docker-compose.yml`, `.env.example`, uputstvo u `deploy/DEPLOY.md`).
  - **Domen:** `mafija-fixus.duckdns.org` (DuckDNS) → IP servera.
  - **Repo:** github.com/fixus28/mafija (grana `main`).
  - **Update procedura:** lokalno `git push` na GitHub, pa na serveru
    `cd /root/mafija && git pull && cd deploy && docker compose up -d --build`.
  - Preduslov za ovo bio je `packages/client/src/socket.ts` da u produkciji
    gađa `window.location.origin` umesto hardkodovanog `:3001`
    (`import.meta.env.DEV` provera) + `vite-env.d.ts`.
- **U TOKU (faza 5): LiveKit + video grid.**
  - **Gotovo:** osnovna konekcija radi end-to-end, testirano uživo (4 taba,
    lažne kamere, stvaran WebRTC/RTP saobraćaj kroz LiveKit SFU, 0% gubitka
    paketa, bez grešaka u konzoli).
    - Server: `packages/server/src/livekit.ts` pravi kratkotrajni JWT
      (`AccessToken` iz `livekit-server-sdk`) po igraču/sobi; novi
      Socket.IO event `livekit:token` (u `index.ts`). Podrazumevane
      vrednosti (`devkey`/`secret`/`ws://localhost:7880`) odgovaraju
      lokalnom `livekit-server --dev` — u produkciji se sve troje
      postavlja preko `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`.
    - Klijent: `components/VideoRoom.tsx` (`@livekit/components-react` +
      `livekit-client`) — trazi token, renderuje `GridLayout` sa
      `ParticipantTile` i rucne `TrackToggle` dugmice za kameru/mikrofon.
      Ukljucen u `Game.tsx`, trenutno UVEK vidljiv dok je partija u toku
      (bez faznog gasenja — to je sledeci korak, faza 6).
    - Lokalni razvoj BEZ Dockera: `livekit-server.exe` (standalone binarni
      fajl, van repoa) u `C:\Users\Legion\tools\livekit\`, pokrece se
      `livekit-server --dev` pored `npm run dev:server`/`dev:client`.
  - **Otvoreno:** LiveKit-ov `GridLayout` na uskom `max-w-md` layoutu
    paginira po 2 učesnika po strani (vidljivo sa 4+ igrača) — treba
    razmisliti o širem/drugačijem rasporedu za video kad partija ima do 12
    igrača. Deployment LiveKit-a na VPS (treći servis u `docker-compose.yml`,
    UDP portovi u firewall-u, `.env` sa pravim kljucevima) nije još urađen.
- Faza 6: server preko LiveKit API-ja pali/gasi dozvole kamera po
  fazama, privatni audio kanal mafije noću, TTS narator.
- Faza 7: Docker Compose deployment (server+klijent+LiveKit zajedno).

## Konvencije rada

- Komentari u kodu na srpskom; objasniti ZAŠTO, ne ŠTA.
- Poruke o greškama za korisnika konkretne i na srpskom.
- Ne uvoditi nove biblioteke bez potrebe — projekat je i pisani rad, svaka
  zavisnost se brani.
- Posle svake celine proveriti `typecheck` u oba paketa.
