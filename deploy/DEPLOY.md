# DEPLOY.md — postavljanje Mafije na Hetzner VPS

## 0. Preduslovi

- Hetzner nalog sa kreditom i dodatim SSH ključem ✔
- Kod projekta na GitHub-u (preporuka — ionako ti treba za diplomski),
  ili spremnost da ga prebaciš `scp`-om
- Domen: pravi, ili besplatan poddomen sa https://www.duckdns.org
  (uloguj se, upiši ime npr. `mafija-etf`, dobijaš `mafija-etf.duckdns.org`)

## 1. Izmena u kodu (jednom, pre deploymenta)

U produkciji klijent i server dele istu adresu (Caddy proksira `/socket.io/`),
pa socket mora da gađa isti origin umesto porta 3001.

**`packages/client/src/socket.ts`** — zameni definiciju `SERVER_URL`:

```ts
const SERVER_URL = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:3001` // razvoj
  : window.location.origin;                                          // produkcija
```

**Novi fajl `packages/client/src/vite-env.d.ts`** (da TypeScript zna za
`import.meta.env`):

```ts
/// <reference types="vite/client" />
```

Proveri da posle izmene prolazi `npm run typecheck -w @mafija/client`.

## 2. Kreiranje servera u Hetzner konzoli

Console → projekat `mafija` → **Add server**:

- Location: **Nürnberg** (ili Falkenstein)
- Image: **Ubuntu 24.04**
- Type: Shared vCPU x86 → **CX22** (ako ga nema: CPX21)
- Networking: IPv4 uključen
- SSH keys: štikliraj svoj ključ
- Firewall (možeš i naknadno, Console → Firewalls → Create):
  inbound TCP **22, 80, 443** — ništa drugo. Zakači ga na server.
  (UDP portove za LiveKit dodajemo u fazi 4.)

Zapiši IP adresu servera. Ako koristiš DuckDNS — upiši tu IP adresu
u njihovom panelu; ako imaš svoj domen — napravi **A record** ka toj IP.

## 3. Priprema servera (jednom)

```bash
ssh root@IP_ADRESA

apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh     # Docker + compose plugin
```

## 4. Kod na server

```bash
# opcija A (GitHub):
git clone https://github.com/TVOJ_NALOG/mafija.git && cd mafija

# opcija B (bez GitHub-a, sa svog racunara u PowerShell-u):
scp -r C:\Users\Legion\Desktop\mafija root@IP_ADRESA:/root/mafija
# (obrisi lokalne node_modules pre slanja, nepotrebno je i ogromno)
```

## 5. Pokretanje

```bash
cd mafija/deploy
cp .env.example .env
nano .env            # upisi svoj domen
docker compose up -d --build
```

Prvi bild traje par minuta. Onda otvori `https://tvoj-domen` — Caddy će pri
prvom zahtevu pribaviti sertifikat (DNS mora već da pokazuje na server!).

## 6. Provera i održavanje

```bash
docker compose logs -f            # logovi uzivo (Ctrl+C za izlaz)
docker compose ps                 # stanje kontejnera

# nova verzija koda:
cd ~/mafija && git pull && cd deploy && docker compose up -d --build

# potpuno gasenje:
docker compose down
```

## Ako nešto ne radi

- `https` ne prolazi → proveri da DNS pokazuje na pravu IP (`ping tvoj-domen`)
  i da su portovi 80 i 443 otvoreni u Hetzner firewall-u.
- Stranica se otvara, ali igra "ne vidi" server → `docker compose logs server`;
  najčešće je socket i dalje na staroj adresi (korak 1 nije primenjen).
- Posle svega: test sa prijateljima na različitim mrežama — to je ujedno
  materijal za poglavlje o testiranju.

## Napomena za fazu 4 (LiveKit)

LiveKit se dodaje kao treći servis u ovaj isti `docker-compose.yml`, uz
otvaranje njegovih UDP portova u firewall-u i još jedan poddomen ili putanju
u Caddyfile-u. Postavka koju sada praviš je temelj — ništa se ne baca.
