# Giuly · Fuori dal mondo

Un piccolo gioco 3D romantico e assurdo, in italiano: un’isola al tramonto, una luna enorme e tre incontri impossibili. La grafica usa materiali con illuminazione fisica, ombre, superfici procedurali e un oceano animato. La musica e gli effetti sono generati nel browser.

## Per giocare o regalarlo

Il pacchetto **dist/Giuly.zip** contiene il gioco e le istruzioni: estrailo e apri `Giuly/index.html` nel browser. I percorsi `/workspace/...` sono interni all'ambiente cloud e non sono collegamenti web pubblici; la chat può non visualizzarne l'anteprima. Per un collegamento apribile e condivisibile su telefono occorre pubblicare il gioco su un servizio di hosting statico. La cartella nello ZIP è già pronta per questo uso.

Apri **dist/Giuly.html** con Chrome, Edge, Firefox o Safari aggiornato. È un singolo file autonomo: puoi copiarlo e inviarlo a Giuly, senza installazioni né connessione a Internet. Su telefoni che aprono gli allegati in un’anteprima, aprilo nel browser oppure pubblica la cartella `dist` su un servizio di hosting statico.

Prima di iniziare puoi aprire **Una dedica, a modo tuo** e scrivere il tuo messaggio. Puoi cambiarlo anche dal menu di pausa. Il nome, la dedica e i progressi vengono salvati soltanto sul dispositivo; non vengono inviati a nessun server. Se il browser limita il salvataggio dei file locali, il gioco funziona comunque, ma la partita non sopravvive alla chiusura.

## L’avventura

Raccogli tre ricordi: conquista il gatto con un complimento, aziona la lavatrice delle galassie tre volte mentre l’indicatore è nella zona rosa e ripeti le quattro luci del telefono lunare. Puoi completare gli incontri in qualsiasi ordine. I piccoli suggerimenti mostrano la direzione e la distanza dell’obiettivo scelto.

Quando hai tutti e tre i ricordi, entra nell’arco per scoprire la dedica. Le cinque stelle nascoste sono una ricerca extra, facoltativa. Gli errori nelle sfide non fanno perdere la partita.

Su computer: **WASD** o frecce per muoversi, **mouse** per guardarsi intorno, **E** per interagire, **Spazio** per saltare, **Shift** per correre, **Esc** per la pausa, **M** per attivare o spegnere la musica. Clicca nel mondo per catturare il mouse; quando la cattura non è disponibile puoi trascinare il mouse. Su telefono: joystick a sinistra, trascina a destra per guardare, pulsanti per saltare e interagire.

## Sviluppo

Serve Node.js 22.12 o superiore (verificato con Node.js 24). Usa il checkout esistente: ogni task cloud è già isolato; non occorre un worktree.

```bash
cd /workspace/giuly
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm run dev -- --port 5173
```

```bash
npm test
npm run build
npm run gift
npm run preview -- --port 4173
```

La build produce sia il sito statico in `dist` sia la versione autonoma `dist/Giuly.html`. Le risorse usano percorsi relativi, adatti anche a un sito pubblicato in una sottocartella. Nessuna chiave API, servizio esterno o account è richiesto. Non servono download di modelli, font, texture o audio durante il gioco.

Il comando facoltativo `npm run gift` richiede anche Python 3 (già presente nell'ambiente cloud) e crea `dist/Giuly.zip`, verificandone l'integrità. La cartella `Giuly` estratta dallo ZIP può essere caricata direttamente su un hosting statico: il suo `index.html` incorpora tutte le risorse.

## Pubblicazione su GitHub Pages

Esegui `npm run pages` per generare `docs/index.html` autonomo e `docs/.nojekyll`. Dopo aver caricato i file nel repository, configura GitHub Pages con il ramo `main` e la cartella `/docs`. Prima della pubblicazione esterna occorre il consenso del proprietario; preparare questi file non pubblica il sito. Per aggiornare il gioco online, rigenera `docs` con lo stesso comando e includi i file aggiornati nel commit. Non occorrono workflow, segreti aggiuntivi o servizi a pagamento per un repository pubblico.

`src/world.js` contiene il mondo e gli oggetti, `src/main.js` i controlli e le tre sfide, `src/style.css` l’interfaccia, `src/audio.js` il paesaggio sonoro e `src/progress.js` i salvataggi. I test verificano sblocco del finale, salvataggi, stelle duplicate e dati corrotti.

Per modificare il nome e la dedica predefiniti nel codice, usa `src/progress.js` e i valori iniziali di `index.html`. La versione autonoma viene rigenerata a ogni build.
