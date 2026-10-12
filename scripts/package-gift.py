"""Package the standalone game as a gift or a static website, using only stdlib."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
standalone = root / "dist" / "Giuly.html"
if not standalone.is_file():
    raise SystemExit("Prima esegui npm run build.")

instructions = """GIULY · FUORI DAL MONDO

PER GIOCARE DA COMPUTER
1. Estrai tutti i file dello ZIP.
2. Apri index.html con Chrome, Edge, Firefox o Safari aggiornato.
3. Premi «Entriamo in questo sogno».

Il gioco funziona senza installazioni e senza connessione Internet.
Prima di iniziare puoi scrivere la tua dedica in «Una dedica, a modo tuo».

COMANDI
WASD o frecce: cammina. Mouse: guarda. E: interagisci.
Spazio: salta. Shift: corri. Esc: pausa. M: musica.

PER GIOCARE SU TELEFONO O CONDIVIDERE UN LINK
Le anteprime degli allegati possono non eseguire i giochi HTML.
Puoi pubblicare questa cartella con un servizio di hosting statico:
ad esempio https://app.netlify.com/drop . Carica la cartella che contiene
index.html e usa il collegamento web fornito dal servizio.
La pubblicazione rende il gioco accessibile a chi ha il collegamento.
Dal sito: joystick a sinistra, trascina a destra per guardare.

Nome, dedica e progressi vengono salvati soltanto nel browser.
Il gioco non invia dati a server e non richiede account.
"""
archive = root / "dist" / "Giuly.zip"
with ZipFile(archive, "w", compression=ZIP_DEFLATED, compresslevel=9) as gift:
    gift.write(standalone, "Giuly/index.html")
    gift.writestr("Giuly/LEGGIMI.txt", instructions.encode("utf-8"))
with ZipFile(archive) as gift:
    if gift.testzip() is not None:
        raise SystemExit("Controllo dell'archivio fallito.")
    if gift.read("Giuly/index.html") != standalone.read_bytes():
        raise SystemExit("Il gioco nell'archivio non corrisponde alla build.")
print(f"Regalo ZIP pronto e verificato: {archive} ({archive.stat().st_size} byte)")
