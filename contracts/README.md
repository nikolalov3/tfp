# RunClub — rejestr członków klubu biegowego (on-chain)

Lista biegaczy trzymana jako grupa [Semaphore v4](https://semaphore.pse.dev) na Base.
Do klubu wchodzi się wyłącznie z polecenia obecnego członka. Polecenie to anonimowy
dowód członkostwa, którego wiadomością jest identyfikator nowego biegacza. Każdy członek
ma 2 polecenia na sezon (30 dni), wymuszone przez nullifiery Semaphore. Kontrakt nie wie,
kto poleca. Wie, że poleca członek.

## Jak to działa

1. Kapitan dodaje skład założycielski (`addFoundingRunners`) i zrzeka się roli (`renounceCaptain`).
2. Nowy biegacz generuje u siebie tożsamość Semaphore i podaje polecającemu swój identyfikator (commitment).
3. Polecający generuje w przeglądarce dowód: grupa = aktualna lista członków, message = identyfikator
   nowego biegacza, scope = `inviteScope(currentSeason(), slot)`.
4. Ktokolwiek (relayer) wysyła `inviteRunner(slot, proof)`. Kontrakt weryfikuje dowód w Semaphore
   i dodaje nowego biegacza. Ten sam członek nie użyje tego samego slotu dwa razy w sezonie.

## Komendy

```bash
npm install
npm test                      # 11 testów z prawdziwymi dowodami ZK (lokalny Semaphore)
cp .env.example .env          # uzupełnij DEPLOYER_KEY
npm run deploy:baseSepolia    # testnet
npm run deploy:base           # mainnet
```

Na Base i Base Sepolia skrypt używa oficjalnego Semaphore v4
(`0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D`, ten sam adres na wszystkich sieciach).
Wynik wdrożenia wypisuje adres kontraktu, `groupId` i blok wdrożenia — to potrzebuje klient
do odczytu listy członków z eventów.

## Scope polecenia (klient musi liczyć identycznie)

```js
BigInt(ethers.solidityPackedKeccak256(["string","uint256","uint256"], ["runclub:invite:", season, slot]))
```
