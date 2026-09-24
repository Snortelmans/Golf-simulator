# Simulators aansluiten

De app kent drie bronnen van slagen. Je kiest ze in het spel onder 'Bron'.

## 1. Verzonnen slagen

Standaard. Knoppen per club, geen apparatuur nodig.

## 2. GSPro Open Connect (thuis, met een eigen launch monitor)

Open Connect is het open protocol waarmee de meeste launch monitors met GSPro
praten: Garmin R10, FlightScope Mevo+, Rapsodo MLM2PRO, Bushnell Launch Pro,
SkyTrak+ en meer. Bron: gsprogolf.com/GSProConnectV1.html.

Een browser kan geen netwerkpoort openen, dus er draait een klein hulpprogramma
op de pc dat zich voordoet als GSPro:

```
node tools/openconnect-bridge.mjs
```

Daarna in de app van je launch monitor 'GSPro' kiezen als doel. In Eigen Baan:
Bron = GSPro Open Connect, adres `ws://localhost:8921`, Verbind.

Zonder launch monitor kun je de brug testen: `node tools/openconnect-bridge.mjs --test`
stuurt zelf elke acht seconden een slag. Op Mac en Linux heeft poort 921 soms
beheerdersrechten nodig; gebruik dan `--port 9210` en stel die poort in bij je
launch monitor.

## 3. Trackman Range (op de club)

Trackman Range heeft een cloud-API: docs.trackmanrange.com. De metingen van een
bay komen binnen over een WebSocket. Twee berichten per slag:

| SubType       | Wanneer            | Velden die wij gebruiken                                  |
|---------------|--------------------|-----------------------------------------------------------|
| `LaunchData`  | direct na de slag  | `BallSpeed` (m/s), `LaunchAngle`, `LaunchDirection` (graden) |
| `Measurement` | als de bal geland is | bovendien `Carry`, `CarrySide`, `MaxHeight` (meters)      |

Trackman Range meet geen spin. De app schat de spin uit balsnelheid en
lanceerhoek, en laat de bal landen waar Trackman zegt: de vlucht wordt zo
bijgestuurd dat carry en zijwaartse afwijking kloppen.

Toegang tot de API loopt via Trackman, samen met de club. Wat nog niet uit
de openbare documentatie blijkt, en dus bij echte toegang gecontroleerd moet
worden:

- hoe je een toegangstoken krijgt (de docs noemen alleen `Authorization: Bearer`);
- het teken van `LaunchDirection` en `CarrySide` (wij nemen aan: + is rechts);
- of de browser rechtstreeks mag verbinden of dat er een tussenstap nodig is.

Zolang er geen toegang is: de nagebouwde Trackman stuurt dezelfde berichten.

```
node tools/mock-trackman.mjs
```

In de app: Bron = Trackman Range, adres `ws://localhost:8922`, Verbind. Druk op
Enter in het venster van de nagebouwde Trackman voor een slag.

## Let op bij de online demo

De demo op claude.ai draait in een beveiligde omgeving die geen verbinding met
`localhost` toestaat. De bronnen 2 en 3 werken alleen als je de app zelf draait
(zie README) of straks op het eigen webadres.
