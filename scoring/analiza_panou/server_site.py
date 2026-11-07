"""Serverul site-ului, cu analiza reclamei inclusă.

Extinde serverul existent din scoring/server.py (fără să-l modifice):
- GET  /...               -> fișierele din web/ (ca în scoring/server.py)
- POST /score             -> clasamentul locațiilor (ca în scoring/server.py)
- POST /analiza-reclama   -> {"image": "data:image/jpeg;base64,..."} -> rezultatul analizei locale (JSON)

Rulare (din rădăcina repo-ului):  python scoring/analiza_panou/server_site.py   apoi http://localhost:8000
Analiza rulează local (EasyOCR + OpenCV), fără API-uri; o cerere durează ~10–30 s.
"""

from __future__ import annotations

import base64
import binascii
import json
import sys
import tempfile
import threading
import traceback
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path

SCORING = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCORING))

import server as server_baza  # noqa: E402  scoring/server.py, nemodificat
from analiza_panou.analiza import analizeaza  # noqa: E402

MAX_OCTETI = 25 * 1024 * 1024
_blocare_ocr = threading.Lock()   # modelul OCR e încărcat o singură dată și nu e sigur pe mai multe fire


class Handler(server_baza.Handler):
    def do_POST(self) -> None:  # noqa: N802
        if self.path.rstrip("/") != "/analiza-reclama":
            super().do_POST()
            return
        try:
            lungime = int(self.headers.get("Content-Length", 0))
            if lungime > MAX_OCTETI:
                self._send_json(413, {"error": "imaginea e prea mare (maximum 25 MB)"})
                return
            date = json.loads(self.rfile.read(lungime) or b"{}")
            antet, _, continut = str(date["image"]).partition(",")
            if not antet.startswith("data:image/") or ";base64" not in antet:
                raise ValueError("imaginea trebuie trimisă ca data URL base64")
            octeti = base64.b64decode(continut, validate=True)
            with tempfile.TemporaryDirectory() as folder:
                cale = Path(folder) / ("reclama.png" if "png" in antet else "reclama.jpg")
                cale.write_bytes(octeti)
                with _blocare_ocr:
                    rezultat = analizeaza(cale)
            self._send_json(200, rezultat.to_dict())
        except (BrokenPipeError, ConnectionResetError):
            print("  (pagina a fost închisă înainte de rezultatul analizei)")
        except (ValueError, KeyError, binascii.Error) as e:
            self._send_json(400, {"error": f"date invalide: {e}"})
        except OSError as e:  # Pillow nu recunoaște fișierul
            self._send_json(400, {"error": f"imaginea nu poate fi citită: {e}"})
        except Exception as e:
            traceback.print_exc()
            self._send_json(500, {"error": f"analiza a eșuat: {e}"})


def _incarca_ocr() -> None:
    """Încarcă modelul OCR la pornire, ca prima analiză să nu aștepte și după el."""
    try:
        import numpy as np
        from analiza_panou.ocr import _citeste, alege_backend
        with _blocare_ocr:
            _citeste(np.full((64, 64, 3), 255, dtype=np.uint8), alege_backend())
        print("  OCR local pregătit.")
    except Exception as e:  # analiza va încerca din nou la prima cerere
        print(f"  OCR-ul nu a putut fi pregătit la pornire: {e}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    handler = partial(Handler, directory=str(server_baza.WEB_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", server_baza.PORT), handler)
    print(f"SightLine (cu analiza reclamei) pe http://localhost:{server_baza.PORT}  (Ctrl+C pentru oprire)")
    threading.Thread(target=_incarca_ocr, daemon=True).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
