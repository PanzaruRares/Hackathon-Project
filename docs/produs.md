# Produsul: intrare și ieșire

Un singur formular, sus pe pagină. Dedesubt apare clasamentul, cu cea mai bună adresă primă.

## Ce introduce clientul

| Câmp | Format | Observații |
|---|---|---|
| Reclama | PNG sau JPG | Se pune pe panou în scena Unity |
| Textul reclamei | text | Pentru numărul de cuvinte; nu citim textul din imagine |
| Adresele panourilor | câte una pe rând | După geocodare, fiecare adresă apare ca pin pe hartă, ca să fie verificată |
| Prețul lunar | EUR, pentru fiecare adresă | Fără el nu există cost pe impresie |
| Dimensiunea panoului | 4×3 m sau 12×4 m | Implicit 12×4 m |

## Ce primește clientul

| Rezultat | Ce conține |
|---|---|
| Cea mai bună adresă | Adresa câștigătoare și un verdict de 2–3 propoziții scris de Claude din cifre |
| Clasamentul | Pentru fiecare adresă: trafic estimat, secunde vizibile, procent acoperit, cuvinte citibile, cost pe impresie reală |
| Panorame 360° din Unity | Din punctul șoferului, la 150 m, 80 m și 30 m de panou. Clientul stă pe loc și se rotește cu mouse-ul; butoane pentru a sări între distanțe. Lângă fiecare: procent vizibil și dacă textul se citește de acolo |
| Sugestii pentru reclamă | 2–3 propuneri, de exemplu text mai scurt dacă timpul de vizibilitate nu ajunge |

Mesajul pentru juriu: „Locația B îți dă de X ori mai multe impresii reale pentru același buget.” Cifra vine din calcul, nu e inventată.

## Ce NU facem

Login, conturi, plăți, istoric, export PDF.
