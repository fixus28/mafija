# Naratorovi snimci

Ovde idu snimljene fraze naratora (umesto robotskog TTS-a). Ime igrača se
NIKAD ne izgovara u snimku — to se uvek prikazuje tekstom u naratorovom
logu. Snimak pokriva samo fiksni deo rečenice.

Format: bilo koji koji browser ume da pusti (mp3, m4a, wav, ogg...) —
samo sačuvaj sa TAČNO ovim imenom fajla (ekstenziju možeš promeniti u
`packages/client/src/narratorAudio.ts` ako ne bude mp3).

| Fajl                     | Šta izgovoriti                                            |
|--------------------------|-------------------------------------------------------------|
| `night-victim.mp3`       | "Nova žrtva noći:" (ime se prikazuje posle, tekstom)         |
| `night-saved.mp3`        | "Ove noći je bio pokušaj ubistva. Meta je spašena."          |
| `night-calm.mp3`         | "Ova noć je prošla mirno."                                   |
| `vote-eliminated.mp3`    | "Grad je presudio:" (ime + "napušta selo" ide tekstom posle) |
| `vote-skipped.mp3`       | "Grad je odlučio. Danas niko ne napušta selo."                |
| `vote-tie.mp3`           | "Nerešeno je." (imena i ostatak idu tekstom posle)            |
| `town-wins.mp3`          | "Grad je pobedio! Mafija je poražena."                        |
| `mafia-wins.mp3`         | "Mafija je pobedila! Grad je pao."                            |

Dok fajl ne postoji, aplikacija automatski pada na TTS za tu poruku —
možeš ih dodavati jedan po jedan, ne moraju svi odjednom.
