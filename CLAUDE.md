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
    `resolveVote`). **Izuzetak:** ako su izjednačeni BAŠ SVI trenutno
    živi (nema nikog spolja da presudi), izuzimanje se ne primenjuje —
    puštaju se i oni da glasaju u reglasavanju, inače bi partija
    zaglavila (`packages/server/src/phaseMachine.ts`,
    `resolveVotingPhase`, `wouldStrandEveryone`).
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
- Mrtvi igrači = posmatrači (kamera/mikrofon ugašeni; tokom uživo diskusije
  im se prikazuje foto+X umesto praznog video kvadrata).
- Glasanje za sebe je zabranjeno (server + UI). Policajac ne sme da
  proverava sebe (server + UI) — nema smisla, uvek bi znao odgovor.
  Mafija/dama/lekar SMEJU da biraju sebe za metu svojih moći — namerno,
  nije bag.
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
- **GOTOVO — logika (faze 5+6 spojene):** video + fazna automatika,
  testirano uživo (7 tabova, lažne kamere, pravi WebRTC/RTP kroz LiveKit
  SFU kroz više noći/dana zaredom, bez grešaka u konzoli).
  - Server: `packages/server/src/livekit.ts` — `createLiveKitToken`
    (glavna soba, kod sobe kao naziv) i `createMafiaChannelToken`
    (zasebna soba `"<kod>:mafija"` za privatni noćni kanal). Token za
    glavnu sobu se pravi SA početnim pravima za trenutnu fazu (ne
    "uvek sve dozvoljeno"); `setMainRoomPublishPermission` preko
    `RoomServiceClient.updateParticipant` uživo menja prava dok je
    igrač već povezan (server je autoritativan — i pošten klijent sam
    gasi trake, ali ovo je stvarna prepreka izmenjenom klijentu).
    `phaseMachine.ts` zove `syncVideoPermissions` posle SVAKE promene
    faze (`setPhase`, uklj. `endGame` koji sad prolazi kroz `setPhase`).
  - Deljeno pravilo u `packages/shared/src/video.ts`
    (`computeVideoPermission({phase, alive, silenced})`) — koristi ga
    i server (za `updateParticipant`/token) i klijent (da odmah reaguje
    bez čekanja mreže), jedno mesto za logiku "kamera+mikrofon samo
    tokom DAY_DISCUSSION/MINI_DISCUSSION; ućutkan zadržava kameru, gubi
    mikrofon; mrtvi nemaju ništa".
  - Mafijin privatni kanal (`socket.emit("livekit:mafiaToken")`, novi
    `MafiaChannel.tsx`): server izdaje token SAMO MAFIA/ACCOMPLICE, samo
    dok je faza NIGHT, samo ako partner još postoji — prava granica je
    JWT potpisan tajnim ključem (civil fizički ne može da dobije token
    za tu sobu, bez obzira šta klijent radi). Komponenta se montira
    samo dok traje NIGHT, sama se diskonektuje kad noć prođe.
  - TTS narator: `client/src/tts.ts` (`speakNarratorMessage`) — čita
    svaku `narrator:message` naglas preko ugrađenog Web Speech API-ja
    (`sr-RS`), bez ijedne nove zavisnosti.
  - **Poznata sitnica iz biblioteke:** `<TrackToggle disabled={...}>` iz
    `@livekit/components-react` NE prosleđuje `disabled` na stvarni
    `<button>` (proverено outerHTML-om) — "nedozvoljeno" dugme se zato
    simulira ručno (`style={{pointerEvents:"none"}}` + zatamnjena
    klasa) umesto pravog HTML `disabled` atributa.
  - Lokalni razvoj BEZ Dockera: `livekit-server.exe` (standalone
    binarni fajl, van repoa) u `C:\Users\Legion\tools\livekit\`,
    pokreće se `livekit-server --dev` pored `npm run dev:server`/`dev:client`.
- **GOTOVO — prvi prolaz izgleda videa** (po korisnikovom opisu, uživo
  testirano 7 tabova, lažne kamere, bez grešaka u konzoli):
  - **Custom grid umesto LiveKit-ovog `GridLayout`** — fiksno 2 reda,
    kolone = `ceil(broj/2)`, SVI igrači na jednoj strani (bez paginacije
    koju je pravio podrazumevani `GridLayout`). `VideoRoom.tsx` prikazuje
    UŽIVO video tokom DAY_DISCUSSION/MINI_DISCUSSION, a van toga
    `PhotoGrid.tsx` (selfie fotografije) na istom mestu.
  - **Selfie na početku partije:** `client/src/selfie.ts` —
    `getUserMedia` + canvas snimak JEDNOG frejma, NEZAVISNO od LiveKit-a
    (kamera se odmah pusti posle snimka); okida se u `Lobby.tsx` čim
    igrač uđe (radi i pre nego što faze uopšte dozvole kameru). Slika
    (JPEG data URL, `PHOTO_SIZE_PX`/`PHOTO_MAX_BYTES` u
    `shared/constants.ts`) ide na server (`photo:submit`) i vraća se
    svima kroz `PublicPlayer.photoUrl` u `room:state`.
  - **`PhotoGrid.tsx`** — deljena komponenta: galerija (foto ili inicijal
    ako slika još nije stigla) u istom 2-red rasporedu. `VideoRoom` je
    JEDINO mesto koje je renderuje — van diskusije prikazuje ili prostu
    (neklikabilnu) galeriju svih igrača, ili — kad je prosleđen `picker`
    prop (noćna akcija/glasanje) — istu galeriju kao klikabilnu, sa
    izabranom metom. Mrtvi igrači dobijaju crveni "✕" preko fotografije
    (`showDead` prop) — automatski, čim `alive` postane `false`, ne
    treba posebna "reveal" logika.
  - **Mafijin kanal sad ima i video** (ne samo audio) — mafija i dama se
    vide uživo dok biraju metu; server-side token za taj kanal sad
    dozvoljava i `TrackSource.CAMERA`.
  - **Dan/noć tema:** `body.is-night` klasa (kači je `Game.tsx` na osnovu
    faze) menja pozadinu na hladniju/tamniju tokom NIGHT/DAWN
    (`index.css`).
  - **Nađen i popravljen pravi bag (trka/race condition):** `setPhase`
    je slao `room:state` PRE nego što je `updateParticipant` poziv ka
    LiveKit-u stvarno završio — klijent bi odmah (na osnovu iste vesti o
    novoj fazi) pokušao da objavi kameru, LiveKit server ga odbije jer
    dozvola tamo još nije primenjena, i klijent to tiho preskoči
    (nema retry-ja). Ispravka: `setPhase` (i ceo lanac oko njega —
    `advancePhase`, `startNight`, `resolveNightPhase`,
    `resolveVotingPhase`, `endGame`, `startGame`) sad je `async` i
    SAČEKA `syncVideoPermissions` pre `broadcastState`. Bez ovoga je
    nasumično radio za 0 ili 1 od 7 igrača.
  - **Otvoreno za kasnije fino podešavanje:** mrtav igrač tokom UŽIVO
    videa (diskusija) prikazuje prazan video kvadrat umesto foto+X (X se
    vidi samo van diskusije, gde je `PhotoGrid` na sceni) — malo
    nedosledno, nije nužno pogrešno. Deployment LiveKit-a na VPS (treći
    servis u `docker-compose.yml`, UDP portovi u firewall-u, `.env` sa
    pravim ključevima) nije još urađen — sledi faza 7.
- **GOTOVO — druga runda ispravki posle prvog uživo testiranja izgleda
  videa** (5 primedbi, sve rešene):
  - Ukinuta duplirana galerija slika u toku noći/glasanja — `VideoRoom`
    sad prima opcioni `picker` prop ({players, selected, onSelect}) i
    SAM postaje klikabilna galerija kad je akcija u toku; `Game.tsx` više
    ne renderuje posebnu galeriju ispod (stari `PlayerPicker.tsx` je
    obrisan, postao je mrtav kod). Prompt tekst ("Koga lečiš večeras?"/
    "Za koga glasaš?") stoji iznad `VideoRoom`-a, status/greška/skip
    dugme ispod (`PhaseStatusPanel` u `Game.tsx`).
  - **Pravi bag sa naratorovim zvukom:** kad ista faza istovremeno
    proizvede DVE naratorove poruke (npr. "grad je presudio X" pa odmah
    "mafija je pobedila" — oba iz `resolveVotingPhase`/`resolveNightPhase`
    pa `endGame` u `phaseMachine.ts`), obe su se puštale ODMAH i
    preklapale, pa se druga nije čula. Ispravka: `narratorAudio.ts` sad
    ima red čekanja (`enqueueNarratorAudio`) — svaka fraza (snimak ili
    TTS fallback) čeka da se PRETHODNA stvarno završi
    (`ended`/`onend`, ne samo da počne) pre nego što krene sledeća.
    `speakNarratorMessage` u `tts.ts` je zbog ovoga postao `Promise`.
  - `RoleReminder` (tvoja uloga) sad renderuje IZNAD `VideoRoom`-a, ne
    ispod.
  - Narator sekcija u `Game.tsx` prikazuje SAMO najnoviju poruku — cela
    istorija (`narratorLog` niz) je uklonjena, `App.tsx` sad drži samo
    `narratorMessage: string | null`.
  - `Roster` (spisak "Za stolom" na dnu `Game.tsx`) je obrisan — imena
    već stoje ispod fotografija u galeriji.
- **GOTOVO — treća runda ispravki (izgled/prostor + ambijent):**
  - **Pravi bag:** LiveKit stavlja `object-fit: contain` za portret-
    orijentisane izvore (čest slučaj kod prednje kamere telefona), pa je
    ostajao prazan prostor sa strane u kvadratnoj pločici. Nadjačano u
    `index.css` (`.lk-participant-media-video { object-fit: cover !important }`)
    — kamera sad uvek ispunjava celu pločicu (seče se, ne razvlači/prazni).
  - **Video/foto galerija dobija mnogo više prostora:** `<main>` u
    `Game.tsx` širi max-width sa `max-w-md` na `max-w-3xl` dok je faza
    diskusiona (`isDiscussionPhase` — nova deljena funkcija u
    `shared/src/video.ts`, koristi je i `VideoRoom.tsx`). Na mobilnom
    nema vidljive razlike (ionako ograničeno širinom ekrana), na širem
    ekranu su pločice znatno veće.
  - `RoleReminder` je pun (naslov + opis) samo tokom `ROLE_REVEAL`; u
    svim ostalim fazama je sitna traka ("ULOGA: Mafija · Radiš sa: X")
    da ne otima prostor video galeriji — `compact` prop u `Game.tsx`.
  - Raspored po fazi je preuređen: `PhaseStatusPanel` (dugme "Preskoči"
    kod glasanja, status "poslato"/greška) sad renderuje ODMAH ispod
    `VideoRoom`/`MafiaChannel`, PRE narator poruke i policajčevih
    saznanja — ranije je bio ispod njih, pa je akcija (klik na sliku pa
    dugme) bila razdvojena informativnim tekstom između.
  - **Dan/noć ambijent:** dva nova snimka (`day.mp3`/`night.mp3` u
    `public/narrator/`) puštaju se preko iste `narratorAudio.ts` reda
    čekanja (nova `enqueueAmbience`) tačno kad `Game.tsx`-ov `is-night`
    efekat STVARNO promeni stanje (ne pri prvom mount-u/refresh-u usred
    faze — prati se preko `useRef`). Bez TTS fallbacka (nema teksta).
  - **Eyelid tranzicija:** dva "kapka" (`div.eyelid-top`/`eyelid-bottom`,
    `position: fixed`, CSS `@keyframes eyelid-sweep` u `index.css`) se
    sklope pa razdvoje preko ~1.1s tačno na istu promenu stanja kao
    ambijentalni zvuk — poštuje `prefers-reduced-motion`.
- **GOTOVO — cetvrta runda ispravki (video CSS bag + pravi bag u glasanju + nova funkcija):**
  - **Pravi CSS bag:** `.lk-participant-tile` (LiveKit-ov koren pojedinacne
    plocice) je flex kolona bez eksplicitne visine — nije se rastezala do
    pune visine naseg kvadratnog omotaca, pa je video unutra (`height:100%`
    NJEGA) kolabirao na prirodnu visinu snimka i ostavljao crnu prugu
    ispod slike. Nadjacano u `index.css` na `width/height:100%`.
    (Napomena: dijagnoza je usput otkrila da je lokalni `livekit-server.exe
    --dev` proces bio ziv 15+ sati kroz gomilu automatizovanih testova bez
    restarta — ako se video/kasnjenje faza opet pokvari bez razloga u
    kodu, prvo probaj restart tog procesa pre trazenja bug-a.)
  - `PhotoGrid`/`LiveVideoGrid`: za 1-3 igraca sad je JEDAN red (jedan
    pored drugog) umesto fiksna 2 reda koja su ih slagala jedno ispod
    drugog (posebno ruzno/veliko za tacno 2-3 kandidata u pickeru).
  - Uklonjena zastarela poruka "kamere i mikrofoni stižu u kasnijoj fazi"
    iz `DiscussionPanel`-a (video odavno radi uzivo).
  - **Pravi bag (deadlock u glasanju):** kad su BAS SVI trenutno zivi
    igraci medjusobno izjednaceni (npr. tacno 3 zive osobe, svako dobije
    po 1 glas), stari kod je iskljucivao SVE njih iz reglasavanja
    (`excludedVoters = candidates`) — a kako van njih nema nikog drugog
    zivog, reglasavanje je teklo bez ijednog moguceg glasaca i partija je
    efektivno zaglavljivala. Ispravka: `resolveVotingPhase` u
    `phaseMachine.ts` proverava `wouldStrandEveryone` i u tom slucaju NE
    iskljucuje nikog — izjednaceni glasaju jedni za druge u reglasavanju.
  - **Nova funkcija:** `PublicRoomState.lastVoteBreakdown` — ko je za koga
    glasao u POSLEDNJEM zavrsenom glasanju (javno, ne otkriva uloge, samo
    ponasanje glasanja), prikazuje se u `Game.tsx` odmah ispod narator
    poruke. Prepisuje se (ne gomila) svakim novim glasanjem, ukljucujuci
    reglasavanja — namerno pamti samo poslednje, ne celu istoriju partije.
- **GOTOVO (faza 7, LiveKit na VPS) — live na pravom serveru, potvrđeno
  uživo** (selfie fotografije stižu, video/lobi rade preko interneta):
  - `deploy/docker-compose.yml` — nov `livekit` servis
    (`livekit/livekit-server:latest`, zvaničan image, bez sopstvenog
    Dockerfile-a). Signal (port 7880) NIJE javno izložen — ide samo kroz
    Caddy iznutra (Docker interno ime `livekit`); javno su izloženi samo
    `7881/tcp` i `50000-50100/udp` (stvaran audio/video RTC saobraćaj, ne
    može kroz reverse proxy). `server` servis sad ima `environment:` sa
    `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` (ranije ih
    UOPŠTE nije imao — latentna rupa od faze 4, sad zatvorena).
  - `deploy/livekit.example.yaml` → kopira se u `deploy/livekit.yaml`
    (gitignore-ovan, sadrži tajni ključ, isti par kao u `.env`).
    `use_external_ip: true` — server unutar Docker mreže nema svoj javni
    IP, pa preko STUN-a sam otkriva IP VPS-a za ICE kandidate (bez ovoga
    bi klijentima slao interne Docker adrese i video ne bi radio).
  - `deploy/Caddyfile` — drugi site block za poseban poddomen
    (`{$LIVEKIT_DOMAIN}`, treba DRUGO DuckDNS ime na istu IP), samo
    `reverse_proxy livekit:7880` — Caddy tu radi isključivo TLS
    terminaciju za signal kanal.
  - `deploy/DEPLOY.md` — dodato poglavlje 7 sa svim koracima (drugi
    DuckDNS poddomen, `openssl rand -hex 16` za ključ/tajnu, firewall
    pravila za 7881/tcp i UDP range, provera preko
    `docker compose logs livekit` — NE SME pisati "no keys provided,
    using placeholder keys", to znači da se `.env` i `livekit.yaml` ne
    poklapaju).
- **GOTOVO — prva ispravka posle prvog uživo testiranja na pravom VPS-u:**
  - **Pravi bag (potvrđen na desktopu, telefon je bio ok):** tajmer je na
    desktopu izgledao kraći i zaglavljivao se na 0 dok stvarna promena
    faze ne stigne. Uzrok: `phaseEndsAt` je apsolutan trenutak po
    SERVEROVOM satu, a `useCountdown` je računao nasuprot golom
    `Date.now()` na klijentu — na mašini sa pogrešno podešenim satom to
    izgleda potpuno slomljeno. Ispravka: `clockSync.ts` (nov fajl) meri
    razliku klijent/server sat jednim round-trip-om preko novog
    `"time:sync"` eventa (server samo vrati `Date.now()`), pri svakoj
    (re)konekciji (`App.tsx`); `useCountdown` sad koristi
    `getServerNow()` umesto golog `Date.now()`. Potvrđeno Playwright
    testom sa simuliranim satom 5 minuta unapred — tajmer se poklapa
    do sekunde sa igračem normalnog sata.
  - **Neregen bag (dijagnostika u toku, nije još rešen):** na desktopu se
    selfie na ulasku u lobi ne slika (nema ni prompta za kameru), a
    LiveKit kasnije (tokom diskusije) redovno traži i dobija pristup —
    znači da `captureSelfie()` u `selfie.ts` nešto tiho baca na tom
    hardveru/browseru. Greška se ranije potpuno gutala (`catch { return
    null }`) — sad se loguje u konzolu (`console.error("[selfie]...")`)
    da sledeći put vidimo TAČAN uzrok (`NotAllowedError`,
    `OverconstrainedError` na `facingMode: "user"` za spoljne/desktop
    kamere koje ga ne prijavljuju, kamera zauzeta drugom aplikacijom...).
    Sledeći put kad se pojavi — otvoriti konzolu (F12) na desktopu.
- **GOTOVO — zatvorene tri rupe u pravilima + vizuelna doslednost:**
  - Glasanje za sebe blokirano i na serveru (`submitVote` u
    `phaseMachine.ts`) — ranije samo UI (`votable` filter) nije puštao,
    ali izmenjen klijent je mogao da zaobiđe.
  - Policajac ne sme da proverava sebe — server (`submitNightAction`,
    poseban slučaj u `DETECTIVE` grani) i klijent (`Game.tsx` izbacuje
    sebe iz `nightPlayers` SAMO za tu ulogu). Mafija/dama/lekar i dalje
    slobodno biraju sebe — to je namerno zadržano, potvrđeno testom da
    se nije slučajno pokvarilo.
  - Mrtav igrač tokom UŽIVO diskusije sad prikazuje foto+X (isti
    `PhotoTile` iz `PhotoGrid.tsx`, sad izvezen i deljen) umesto praznog
    LiveKit placeholder kvadrata — `LiveVideoGrid` u `VideoRoom.tsx` sad
    prima `room`/`myId` i po `trackRef.participant.identity` (=
    `publicId`) prepoznaje mrtve igrače pre nego što odluči šta da
    renderuje po plocici.

- Komentari u kodu na srpskom; objasniti ZAŠTO, ne ŠTA.
- Poruke o greškama za korisnika konkretne i na srpskom.
- Ne uvoditi nove biblioteke bez potrebe — projekat je i pisani rad, svaka
  zavisnost se brani.
- Posle svake celine proveriti `typecheck` u oba paketa.
