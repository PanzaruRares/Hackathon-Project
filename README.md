# SightLine

Primești o reclamă și o listă de adrese de panouri cu preț; afli care adresă aduce cele mai multe impresii reale pe euro, cu panorame 360° din Unity în care vezi ce vede șoferul.

## Pornire rapidă

1. `git clone` acest repo.
2. Copiază `.env.example` în `.env` și pune cheile (nu se urcă pe GitHub). Pentru sugestiile AI bazate pe scorul general, scorurile criteriilor și recomandările locale (fără trimiterea imaginii), completează `GEMINI_API_KEY` cu o cheie din [Google AI Studio](https://aistudio.google.com/); serverul o citește din `.env` sau din mediul procesului. Folosim `gemini-3.1-flash-lite`, varianta Flash-Lite cu nivel gratuit și cost redus, potrivită pentru această cerere text-only; cota gratuită este limitată și se verifică în AI Studio.
3. Intră în folderul tău (`unity/`, `backend/`, `scoring/` sau `web/`) și pornește Claude Code acolo.

Context complet pentru oameni și agenți: [`CLAUDE.md`](CLAUDE.md). Produsul: [`docs/produs.md`](docs/produs.md). Formule: [`docs/scor.md`](docs/scor.md). Formate JSON: [`contracts/README.md`](contracts/README.md).
