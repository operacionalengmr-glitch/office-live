# Office Live (M&R)

Escritório em pixel art no navegador que mostra quem está trabalhando, em pausa ou fora, puxando os dados do timesheet.

**No ar:** https://operacionalengmr-glitch.github.io/office-live/ (GitHub Pages, publicado a cada push na `main`)

## Rodar

Dê dois cliques em `run.bat`, ou rode:

```
python -m http.server 8080
```

Depois abra http://localhost:8080. O jogo usa ES modules, então abrir o `index.html` direto do disco não funciona.

## Estrutura

| Arquivo | O que faz |
|---|---|
| `src/data.js` | equipe: nome, cargo, mesa, status inicial e o que aparece no monitor |
| `src/world.js` | planta do escritório, mesas, cadeiras, colisão, pathfinding |
| `src/art.js` | arte procedural do escritório (piso, paredes, móveis, telas, luzes) |
| `src/sprites.js` | carrega os sprites e gera os quadros de idle, caminhada e sentado |
| `src/actors.js` | movimento e IA (status → ir pra mesa / café / sair) |
| `src/main.js` | loop do jogo, câmera, input, iluminação dia/noite, API |
| `tools/extract_sprites.py` | recorta os personagens das fichas em `source folder/` |

## Adicionar ou atualizar um personagem

1. Coloque a ficha (com as poses frente / lado / costas) em `source folder/v2/`. Não salve em `assets/sprites/`: essa pasta é gerada pelo script e é sobrescrita.
2. Em `tools/extract_sprites.py`, adicione uma entrada em `CHARS` com as caixas `(x, y, w, h)` de cada pose.
3. Rode `python tools/extract_sprites.py --sheet preview.png` e confira o `preview.png`.
4. Adicione a pessoa em `src/data.js` com uma mesa livre (`r1a`, `r3a`, `r3c`, ...).
5. No Supabase, adicione uma linha em `office_characters` com o e-mail dela e o mesmo `id`.

## Status ao vivo (Supabase "ponto")

Clique em **🔌 Conectar ao ponto** e entre com o e-mail/senha do app de ponto. O jogo chama `public.office_presence()` a cada 20 s:
timer rodando = Trabalhando, parou há menos de 90 min hoje = Pausa, resto = Fora. Para quem está trabalhando, mostra também o projeto e a task
(descrição) do timer rodando. Cada conta é ligada ao personagem na tabela privada `office_characters` do Supabase (email → `id` do `src/data.js`),
para os e-mails não ficarem no código público. Só contas `@engmr.com.br` confirmadas recebem dados.
Sem login, o jogo roda em modo demo.

## TV do escritório (YouTube)

A TV ao lado dos arquivos toca vídeos do YouTube para todo mundo que está com o jogo aberto, no mesmo ponto do vídeo.
Clique na TV (ou em **📺 TV**) para abrir o controle: tocar/pausar, pular, fila, limpar fila e volume (o volume é só do seu computador).
Qualquer pessoa vê a TV; só quem entrou com o e-mail do ponto (`@engmr.com.br`) coloca vídeos e controla.

O estado fica no Supabase (`supabase/office_tv.sql`): a fila, o vídeo atual e quando ele começou pelo relógio do servidor.
O jogo escuta mudanças por Realtime e ajusta o player (`src/tv.js`). O navegador só deixa tocar com som depois de um clique na página;
antes disso a TV toca sem som e liga o som no primeiro clique. Vídeos que o dono bloqueou para incorporação são pulados.

## Sair pra rua (multiplayer)

Quem não está trabalhando (ponto em pausa ou fora) pode clicar na porta do escritório e sair para a Av. João Câncio da Silva.
Lá fora anda com setas/WASD ou clique, Shift corre, e volta pela porta do Excelsior ou pelo botão **🏢 Voltar ao escritório**.
Quando o timer volta a rodar, a pessoa é mandada de volta para dentro.

Logado, cada um vê os colegas que estão na rua, andando em tempo real: as posições vão por um canal privado do Realtime
do Supabase (`office-street`, `supabase/office_street.sql`), que só aceita contas `@engmr.com.br` confirmadas e não grava nada.
Quem está na rua some do escritório para os outros enquanto isso. Em modo demo a rua é só da sua tela.

## Integração com o timesheet

```js
OfficeLive.setStatus('raffael', 'working');   // 'working' | 'break' | 'offline'
OfficeLive.team();                            // [{ id, name, status, since }]
OfficeLive.on('status', ({ id, status }) => {});
```
