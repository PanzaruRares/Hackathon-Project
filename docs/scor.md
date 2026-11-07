# Cum alegem cea mai bună adresă

Câștigă adresa cu **cel mai mic cost pe impresie reală**: câți bani dai pentru fiecare șofer care chiar vede și apucă să citească panoul.

## Formule

```
secunde_necesare      = cuvinte_text × SECUNDE_PE_CUVANT
factor_vizibilitate   = (1 − procent_acoperit / 100) × min(1, secunde_vizibile / secunde_necesare)
impresii_reale_luna   = masini_pe_zi × 30 × factor_vizibilitate
cost_impresie_reala   = pret_lunar_eur / impresii_reale_luna
```

`SECUNDE_PE_CUVANT` e un parametru de pornire (de exemplu 0,3 s), de calibrat. Rămâne configurabil în `scoring/`.

## De unde vine fiecare cifră

| Valoare | Sursă |
|---|---|
| Mașini pe zi (densitatea traficului) | Estimare după tipul drumului și numărul de benzi din OpenStreetMap, ajustată cu aglomerarea de la TomTom. O prezentăm deschis ca estimare. |
| Viteza | TomTom Traffic Flow; dacă lipsește, `maxspeed` din OSM sau 50 km/h |
| Secunde vizibile, procent acoperit | Simularea din Unity: raze de la ochii șoferului spre o grilă de puncte de pe panou |
| Cuvinte citibile | Câte cuvinte apucă șoferul să citească în secundele vizibile |
| Preț, dimensiune | Le introduce clientul |

**Procent acoperit** = cât din panou e ascuns de clădiri, copaci, stâlpi, văzut de șoferul care se apropie. Media pe tot drumul de apropiere.

Claude nu calculează nimic: primește cifrele de mai sus și scrie verdictul și sugestiile.

Rezultatele se prezintă ca **comparații între adrese**, nu ca valori absolute.
