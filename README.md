# Hotărâri — căutare

Chatbot personal (Next.js) pentru căutare în colecția de hotărâri din vector store-ul OpenAI.

## Instalare (Windows)

1. Instalează Node.js LTS: `winget install OpenJS.NodeJS.LTS` (apoi redeschide terminalul).
2. Pune folderul în `D:\Users\User\Desktop\qqQ\chatbot`.
3. În folder, rulează:
   ```
   npm install
   npm run dev
   ```
4. Deschide http://localhost:3000

## Configurare

Copiază `.env.example` ca `.env.local` și completează:

| Variabilă | Implicit |
|---|---|
| `OPENAI_API_KEY` | dacă lipsește, se citește `OPENAI_KEY` din `..\script.env` |
| `VECTOR_STORE_ID` | `vs_6af4275e8db48191aa5098c97dbcd2e0` |
| `OPENAI_MODEL` | `gpt-6-luna` |
| `REASONING_EFFORT` | `high` |
| `FILE_SEARCH_MAX_RESULTS` | `30` |
| `OPENAI_BASE_URL` | opțional |

Conversația se salvează doar în browser (localStorage); „Conversație nouă" o șterge.

## Netlify (acces de pe telefon)

1. (Opțional, pentru titluri frumoase la surse) generează metadatele documentelor pe calculatorul tău:
   ```
   node scripts\build-doc-meta.mjs --state ..\index-state.json --docs ..\documente_cn4000-main --out data\doc-meta.json
   ```
   (Fără acest pas, sursele apar cu numele fișierului.)
2. Rulează `DEPLOY-NETLIFY.bat` din folderul `qqQ` (lângă `chatbot\` și `script.env`). Te autentifici în Netlify, creezi site-ul, scrii o parolă de acces, iar scriptul setează cheia OpenAI și face deploy.
3. Deschide adresa afișată de pe telefon și intră cu parola aleasă.

Variabile pe Netlify: `OPENAI_API_KEY`, `APP_PASSWORD` (obligatorie în producție), `AUTH_SECRET`, `MAX_STREAM_SECONDS` (implicit 20; scade la 8 dacă funcțiile sunt oprite devreme). Răspunsurile rulează în fundal la OpenAI, iar pagina se reconectează automat; dacă reîncarci pagina în timpul unui răspuns, acesta continuă.
