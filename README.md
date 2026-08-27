# Regnskabsanalyse

En webapp, der tager tre årsregnskaber, stiller dem op i analyseform, beregner 28 nøgletal
inden for fem analyseområder, tegner en graf til hvert nøgletal og lægger det hele i Word og Excel.

Selve vurderingen af tallene skriver du selv. Word-dokumentet har derfor et tomt kommentarfelt
under hvert nøgletal.

## De fem analyseområder

| Område | Nøgletal |
| --- | --- |
| Rentabilitetsanalyse | 1–6 |
| Indtjeningsevne | 7–12 |
| Kapitaltilpasning og pengestrømme | 13–19 |
| Soliditet og likviditet | 20–24 |
| Børsrelaterede nøgletal | 25–28 |

Formlerne følger Bilag 2 "Nøgletalsdefinitioner" og ligger samlet i `src/lib/nogletal.js`.
Skal en definition ændres, er det den ene fil, der skal rettes — grafer, Word og Excel følger med.

## Kom i gang lokalt

```bash
npm install
npm run dev            # http://localhost:5173
```

iXBRL-adresser hentes gennem en serverfunktion. Den kræver Netlifys CLI:

```bash
npm install -g netlify-cli
netlify dev            # http://localhost:8888 – både app og funktion
```

Uden `netlify dev` virker alt undtagen "Hent regnskab" fra en adresse; PDF-indlæsning
og manuel indtastning kører helt i browseren.

## Udgivelse på Netlify via GitHub

1. Læg mappen i et nyt GitHub-repo:

   ```bash
   git init
   git add .
   git commit -m "Regnskabsanalyse"
   git branch -M main
   git remote add origin git@github.com:BRUGERNAVN/regnskabsanalyse.git
   git push -u origin main
   ```

2. På app.netlify.com: **Add new site → Import an existing project → GitHub** og vælg repoet.
3. Netlify læser `netlify.toml`, så byggeindstillingerne er udfyldt på forhånd
   (`npm run build`, publiceringsmappe `dist`, funktioner i `netlify/functions`).
4. Tryk **Deploy**. Hvert push til `main` udløser en ny udgivelse.

### Miljøvariabler

| Navn | Virkning |
| --- | --- |
| `TILLAD_ALLE_VAERTER` | Sæt til `true`, hvis proxyen skal kunne hente iXBRL fra andre værter end de danske regnskabsservere. Lad den være slået fra på en offentlig side. |
| `VIRK_BRUGER`, `VIRK_KODE` | Kun nødvendige, hvis Erhvervsstyrelsens distributionsindeks kræver legitimation. Rekvireres hos Erhvervsstyrelsen på 35 29 10 00. |

### Fejlsøgning: 403 fra Virk

Virks WAF afviser kald uden browserlignende headere, og proxyen sender dem derfor.
Kommer der stadig 403, peger adressen sandsynligvis på en visningsside frem for selve
dokumentet. Test adressen direkte:

```
https://DIT-SITE.netlify.app/.netlify/functions/ixbrl?url=ADRESSE&debug=1
```

Med `debug=1` returneres status, indholdstype og de første 800 tegn, så det er til at se,
hvad Virk faktisk sender tilbage.

## Sådan læses regnskaberne ind

**PDF.** Teksten trækkes ud med pdf.js, og posterne genkendes på deres danske betegnelser
(`src/lib/pdfImport.js`). Årstallene i kolonneoverskrifterne bruges til at stille årene op
automatisk; en enkelt kolonne kan altid flyttes manuelt, hvis genkendelsen rammer skævt.

Genkendelsen rammer ikke altid. Årsrapporter sættes op vidt forskelligt, og tal i noter kan
forveksles med tal i hovedopgørelsen. Derfor er trin 2 et almindeligt regneark: alt kan rettes,
og balancen kontrolleres undervejs. Betragt PDF-indlæsningen som et udkast, ikke som facit.

**CVR-opslag.** Skriv virksomhedens CVR-nummer, og appen slår de offentliggjorte årsrapporter
op i Erhvervsstyrelsens distributionsindeks, viser dem med regnskabsperiode og henter de tre
nyeste XBRL-dokumenter med ét klik. Det er den pålidelige vej ind.

**iXBRL.** Her er tallene mærket op med begreber fra den danske årsrapporttaksonomi, så
indlæsningen er pålidelig. Mapningen står i `src/lib/ixbrlImport.js`. Kun kontekster uden
dimensioner bruges, så segmentoplysninger ikke forstyrrer hovedtallene.

## Fire balancedatoer, tre analyseår

Et årsregnskab indeholder to år. Tre regnskaber giver derfor fire balancedatoer, og
appen fordeler dem selv:

| Balancedato | Rolle |
| --- | --- |
| Ældste sammenligningsår | Primobalance — indgår kun i gennemsnitstal |
| De tre nyeste år | Analyseår 1, 2 og 3 |

Dermed kan nøgletal 1, 3, 4, 5 og 6 beregnes på rigtige gennemsnit af primo og ultimo
i alle tre analyseår, og nøgletal 18 får det lager primo, varekøbet kræver.

Hvor to regnskaber dækker samme år, bruges tallet fra det regnskab, hvor året er hovedår —
sammenligningskolonnen er ofte forkortet. Afviger de to kilder mere end en halv procent
fra hinanden, vises det som en konflikt, før tallene lægges i skemaet. Det fanger både
tilpassede sammenligningstal og fejllæste PDF-linjer.

Mangler primobalancen — fx fordi der kun er indlæst ét regnskab — regnes der på ultimotal,
og de berørte nøgletal markeres som skøn.

## Klasse B-regnskaber

Små selskaber offentliggør ofte kun bruttofortjeneste, ikke omsætning. Uden omsætning kan
nøgletal 2, 3, 7 og 11–19 ikke beregnes. Appen siger til i stedet for at gætte.

## Filer

```
src/lib/model.js        Regnskabet i analyseform, afledte poster, kontrol af balancen
src/lib/nogletal.js     De 28 nøgletal: formler, beregning, forklaringer
src/lib/pdfImport.js    Tekstudtræk og genkendelse af poster i PDF
src/lib/fordeling.js    Fordeling af fire balancedatoer på tre år plus primo
src/lib/ixbrlImport.js  Mapping fra fsa-taksonomien til analyseformen
src/lib/exportExcel.js  Fire ark: analyseform, nøgletal, beregningsgrundlag, definitioner
src/lib/exportWord.js   Rapport med tabeller, grafer og kommentarfelter
netlify/functions/ixbrl.js       Proxy, der henter iXBRL-dokumenter
netlify/functions/regnskaber.js  Opslag af årsrapporter på CVR-nummer
```

## Licens

Til fri brug i undervisning.
