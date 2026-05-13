# _Pasii de operare a submarinului_

**Pasul 1.** Deschideti un terminal (Command prompt pe Windows, Terminal pe Mac/Linux).
**Pasul 2.** Stabiliti o conexiune cu submarinul prin a crea o retea hotspot pe calculator cu numele _HOTSPOT_, parola _12345678_.
**Pasul 3.** Odata ce se conecteaza, verifica ip-ul alocat submarinului in retea, sub numele de _aquadex_.
**Pasul 4.** Conectati-va prin ssh cu robotul folosind comanda:

```batch
ssh aquadex@<ip-ul_identificat>
```

**Pasul 5.** Acum, puteti introduce orice comanda valabila pentru un Raspberry Pi 4 Model B, cu Raspberry Pi OS. Spre exemplu:

- Pentru a rula un program pe submarin, fie de test, fie de autonomie, puteti scrie:

```batch
python3 <program_ales>
```

- Pentru a verifica ce programe sunt disponibile, puteti scrie:

```batch
find / -type f -name '*.py'
```
