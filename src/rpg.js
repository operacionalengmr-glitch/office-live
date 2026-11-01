// Progression in the Resenha. Classes ("profissões") follow the job system of Yakuza: Like a Dragon — each with
// its own weapon, stat leanings and skills unlocked by job rank — but every name, skill and description here is
// our own. Anyone can wear any class (no split by sex) and for now classes don't change the clothes; the
// wardrobe in the Resenha switches them. Level, money, HP/MP and each class's rank are saved per character in
// this browser.
//
// Skill fields: mp, rank (job rank that unlocks it), target 'one' | 'around' (target and whoever is near it) |
// 'all' | 'line' (everyone along the path to the target) | 'self'; power per hit, hits, el (damage type:
// blunt, blade, fire, ice, elec, bullet, magic — fire/ice/elec/magic use MAG, the rest ATK; bullet and the
// elements are ranged), status [id, chance] on hit, heal (fraction of max HP), buff {stat: mult | true} for 3
// turns, cleanse, crit (extra crit chance), lowHp (stronger the lower your HP), bonus [status, mult],
// rand [min, max] power, charge (lands on your next turn), randomStatus, randomBuff, roulette.
const W = (name, kind, atk = 0, mag = 0) => ({ name, kind, atk, mag });
const M = (hp = 1, mp = 1, atk = 1, def = 1, agi = 1, mag = 1) => ({ hp, mp, atk, def, agi, mag });

const ALL_CLASSES = [
  { id: 'heroi', name: 'Herói', weapon: W('Bastão', 'bat', 6, 0), mods: M(1.1, 1, 1, 1.1, 1, 0.9), color: '#e0b25a', fx: 'stars',
    desc: 'Briguento de bom coração. Aguenta pancada, cura a si mesmo e bate mais forte quando está nas últimas.',
    skills: [
      { id: 'rebatida', name: 'Rebatida Brava', mp: 6, rank: 1, target: 'one', power: 1.8, el: 'blunt', desc: 'Tacada forte com o bastão.' },
      { id: 'animo', name: 'Grito de Ânimo', mp: 8, rank: 2, target: 'self', heal: 0.35, desc: 'Recupera 35% da vida.' },
      { id: 'giro', name: 'Giro do Bastão', mp: 12, rank: 3, target: 'around', power: 1.3, el: 'blunt', lowHp: true, desc: 'Gira o bastão no alvo e em quem estiver perto. Mais forte com pouca vida.' },
      { id: 'coracao', name: 'Coração Quente', mp: 14, rank: 5, target: 'self', buff: { atk: 1.3 }, desc: 'Ataque +30% por 3 turnos.' },
      { id: 'chance', name: 'Segunda Chance', mp: 13, rank: 7, target: 'self', heal: 0.15, buff: { guardian: true }, desc: 'Cura um pouco e aguenta um golpe que seria fatal.' },
      { id: 'homerun', name: 'Home Run', mp: 30, rank: 10, target: 'one', power: 3.6, el: 'blunt', desc: 'A tacada da vida.' },
    ] },
  { id: 'freelancer', name: 'Freelancer', weapon: W('Punhos', 'fists', 5, 0), mods: M(0.95, 0.85, 1.15, 0.95, 1.1, 0.8), color: '#c9a26e',
    desc: 'Sem patrão e sem frescura: punhos rápidos, cabeçadas e muita marra.', fx: 'punch',
    skills: [
      { id: 'teimoso', name: 'Soco Teimoso', mp: 8, rank: 1, target: 'one', power: 1.7, el: 'blunt', status: ['stun', 0.25], desc: 'Soco carregado. Pode atordoar.' },
      { id: 'pedra', name: 'Arremesso de Pedra', mp: 10, rank: 2, target: 'one', power: 1.9, el: 'blunt', desc: 'Agarra e arremessa o inimigo.' },
      { id: 'cabecadas', name: 'Cabeçadas', mp: 13, rank: 4, target: 'one', power: 0.7, hits: 4, el: 'blunt', desc: 'Quatro cabeçadas seguidas.' },
      { id: 'marra', name: 'Pose de Marra', mp: 10, rank: 5, target: 'self', buff: { atk: 1.25, eva: true }, desc: 'Ataque e esquiva sobem por 3 turnos.' },
      { id: 'furia', name: 'Fúria Sem Patrão', mp: 24, rank: 8, target: 'one', power: 3, el: 'blunt', lowHp: true, desc: 'Golpe enorme, mais forte com pouca vida.' },
    ] },
  { id: 'andarilho', name: 'Andarilho', weapon: W('Bengala', 'cane', 2, 6), mods: M(0.95, 1.3, 0.85, 0.95, 0.95, 1.25), color: '#8a7a5a',
    desc: 'Conhece cada canto da rua. Fogo improvisado, amigos pombos e uma sopa que cura tudo.',
    skills: [
      { id: 'bafo', name: 'Bafo Flamejante', mp: 8, rank: 1, target: 'around', power: 1.3, el: 'fire', status: ['burn', 0.35], desc: 'Cospe fogo no alvo e arredores. Pode queimar.' },
      { id: 'pombos', name: 'Pombos Amigos', mp: 10, rank: 2, target: 'one', power: 0.5, hits: 4, el: 'magic', desc: 'Uma revoada bica o inimigo.' },
      { id: 'sopa', name: 'Sopa Quente', mp: 12, rank: 3, target: 'self', heal: 0.4, cleanse: true, desc: 'Cura 40% e remove males.' },
      { id: 'fogueira', name: 'Fogueira de Rua', mp: 18, rank: 5, target: 'all', power: 1.2, el: 'fire', status: ['burn', 0.25], desc: 'Fogo em todos os inimigos.' },
      { id: 'achado', name: 'Achado no Lixo', mp: 6, rank: 7, target: 'self', rand: [0.1, 0.6], heal: 0, desc: 'Acha algo útil… cura uma quantia aleatória.' },
    ] },
  { id: 'investigador', name: 'Investigador', weapon: W('Cassetete', 'baton', 5, 0), mods: M(1.2, 0.9, 1, 1.25, 0.9, 0.8), color: '#5d7ab0',
    desc: 'Faro de detetive e couro grosso. Desmonta a defesa do suspeito e algema quem tenta fugir.',
    skills: [
      { id: 'interrogatorio', name: 'Interrogatório', mp: 6, rank: 1, target: 'one', power: 1.5, el: 'blunt', status: ['defDown', 0.5], desc: 'Pode baixar a defesa do alvo.' },
      { id: 'algemas', name: 'Algemas', mp: 10, rank: 2, target: 'one', power: 1, el: 'blunt', status: ['stun', 0.45], desc: 'Prende o alvo. Boa chance de atordoar.' },
      { id: 'mandado', name: 'Mandado', mp: 12, rank: 4, target: 'self', buff: { def: 1.5 }, desc: 'Defesa +50% por 3 turnos.' },
      { id: 'batida', name: 'Batida Policial', mp: 20, rank: 6, target: 'around', power: 1.5, el: 'blunt', desc: 'Acerta o alvo e quem estiver perto.' },
      { id: 'flagrante', name: 'Flagrante', mp: 22, rank: 9, target: 'one', power: 2.6, el: 'blunt', bonus: ['stun', 1.5], desc: 'Golpe pesado, 50% mais forte em atordoados.' },
    ] },
  { id: 'bartender', name: 'Bartender', weapon: W('Coqueteleira', 'shaker', 2, 7), mods: M(0.9, 1.25, 0.9, 0.9, 1.05, 1.2), color: '#4fe0d0',
    desc: 'Mestre do balcão. Drinques que pegam fogo, gelo que trava e uma saideira que deixa qualquer um tonto.',
    skills: [
      { id: 'dose', name: 'Dose Flamejante', mp: 8, rank: 1, target: 'one', power: 1.5, el: 'fire', status: ['burn', 0.4], desc: 'Pode queimar.' },
      { id: 'gelo', name: 'Gelo no Copo', mp: 9, rank: 2, target: 'one', power: 1.4, el: 'ice', status: ['cold', 0.4], desc: 'Pode deixar o alvo resfriado (lento).' },
      { id: 'casa', name: 'Drinque da Casa', mp: 12, rank: 3, target: 'self', heal: 0.35, buff: { regen: true }, desc: 'Cura 35% e regenera por 3 turnos.' },
      { id: 'molotov', name: 'Coquetel Molotov', mp: 20, rank: 5, target: 'around', power: 1.6, el: 'fire', status: ['burn', 0.35], desc: 'Explode no alvo e arredores.' },
      { id: 'saideira', name: 'Saideira', mp: 16, rank: 8, target: 'one', power: 1, el: 'magic', status: ['confused', 0.6], desc: 'Deixa o alvo tonto.' },
    ] },
  { id: 'atirador', name: 'Atirador', weapon: W('Pistola', 'pistol', 6, 0), mods: M(0.9, 1, 1.05, 0.85, 1.3, 0.9), color: '#9aa1ac',
    desc: 'Frio e preciso. Ataca de longe, crava críticos e some na sombra.',
    skills: [
      { id: 'preciso', name: 'Disparo Preciso', mp: 7, rank: 1, target: 'one', power: 1.5, el: 'bullet', crit: 0.4, desc: 'Tiro de longe, alta chance de crítico.' },
      { id: 'rajada', name: 'Rajada', mp: 12, rank: 2, target: 'one', power: 0.55, hits: 4, el: 'bullet', desc: 'Quatro tiros seguidos.' },
      { id: 'karambit', name: 'Corte de Karambit', mp: 9, rank: 3, target: 'one', power: 1.4, el: 'blade', status: ['bleed', 0.5], desc: 'Pode causar sangramento.' },
      { id: 'sombra', name: 'Sombra', mp: 10, rank: 5, target: 'self', buff: { eva: true, agi: 1.3 }, desc: 'Esquiva e agilidade sobem por 3 turnos.' },
      { id: 'execucao', name: 'Execução', mp: 28, rank: 9, target: 'one', power: 3.2, el: 'bullet', crit: 0.3, desc: 'Um tiro que decide a briga.' },
    ] },
  { id: 'gangster', name: 'Gângster', weapon: W('Espada', 'sword', 7, 2), mods: M(1, 1.1, 1.15, 0.95, 1, 1), color: '#c9483b',
    desc: 'Elegante e perigoso. Lâmina afiada, fogo na espada e um olhar que dá medo.',
    skills: [
      { id: 'corte', name: 'Corte Seco', mp: 7, rank: 1, target: 'one', power: 1.6, el: 'blade', status: ['bleed', 0.3], desc: 'Pode causar sangramento.' },
      { id: 'chamas', name: 'Lâmina em Chamas', mp: 12, rank: 2, target: 'one', power: 1.8, el: 'fire', status: ['burn', 0.4], desc: 'Pode queimar.' },
      { id: 'intimidar', name: 'Intimidação', mp: 9, rank: 3, target: 'all', status: ['fear', 0.55], desc: 'Pode amedrontar todos (ataque deles cai).' },
      { id: 'danca', name: 'Dança das Lâminas', mp: 18, rank: 5, target: 'around', power: 1.2, hits: 2, el: 'blade', status: ['bleed', 0.3], desc: 'Dois cortes no alvo e arredores.' },
      { id: 'tigre', name: 'Golpe do Tigre', mp: 30, rank: 9, target: 'one', power: 3, el: 'fire', desc: 'Corte flamejante devastador.' },
    ] },
  { id: 'estagiario', name: 'Estagiário', weapon: W('Grampeador', 'stapler', 4, 3), mods: M(0.95, 1.1, 1, 0.95, 1.1, 1), color: '#8ab4ff',
    desc: 'Material de escritório na mão e cafeína no sangue. Ninguém aguenta uma reunião dessas.',
    skills: [
      { id: 'grampeada', name: 'Grampeada', mp: 6, rank: 1, target: 'one', power: 0.55, hits: 3, el: 'blade', desc: 'Três grampos certeiros.' },
      { id: 'papel', name: 'Pilha de Papel', mp: 10, rank: 2, target: 'around', power: 1.3, el: 'blunt', desc: 'Derruba a papelada no alvo e arredores.' },
      { id: 'cafe', name: 'Café Forte', mp: 10, rank: 3, target: 'self', buff: { atk: 1.25, agi: 1.3 }, desc: 'Ataque e agilidade sobem por 3 turnos.' },
      { id: 'reuniao', name: 'Reunião Interminável', mp: 14, rank: 5, target: 'all', status: ['sleep', 0.45], desc: 'Pode fazer todos dormirem.' },
      { id: 'horaextra', name: 'Hora Extra', mp: 22, rank: 8, target: 'one', power: 2.8, el: 'blunt', lowHp: true, desc: 'Mais forte com pouca vida.' },
    ] },
  { id: 'seguranca', name: 'Segurança', weapon: W('Katana', 'katana', 7, 2), mods: M(1, 0.9, 1.2, 1, 1.05, 0.85), color: '#3a3d45',
    desc: 'Guarda-costas de terno. Corta rápido, eletrocuta e devolve qualquer golpe.',
    skills: [
      { id: 'rapido', name: 'Corte Rápido', mp: 7, rank: 1, target: 'one', power: 1.6, el: 'blade', desc: 'Corte veloz.' },
      { id: 'taser', name: 'Taser', mp: 10, rank: 2, target: 'one', power: 1.2, el: 'elec', status: ['shock', 0.5], desc: 'Pode eletrocutar (paralisa às vezes).' },
      { id: 'duplo', name: 'Corte Duplo', mp: 14, rank: 4, target: 'one', power: 0.95, hits: 2, el: 'blade', status: ['bleed', 0.3], desc: 'Dois cortes. Pode sangrar.' },
      { id: 'contra', name: 'Contra-ataque', mp: 10, rank: 5, target: 'self', buff: { counter: true }, desc: 'Revida o próximo golpe e leva metade do dano.' },
      { id: 'eletrica', name: 'Lâmina Elétrica', mp: 24, rank: 8, target: 'around', power: 1.6, el: 'elec', status: ['shock', 0.3], desc: 'Choque no alvo e arredores.' },
    ] },
  { id: 'dancarino', name: 'Dançarino', weapon: W('Tênis', 'none', 4, 0), mods: M(0.9, 1, 1.1, 0.9, 1.3, 0.9), color: '#ff6fa3',
    desc: 'Break na rua. Giros, mortais e uma batalha de dança que ninguém esquece.',
    skills: [
      { id: 'moinho', name: 'Moinho', mp: 8, rank: 1, target: 'around', power: 1.2, el: 'blunt', desc: 'Giro no chão no alvo e arredores.' },
      { id: 'piao', name: 'Pião de Cabeça', mp: 10, rank: 2, target: 'one', power: 0.6, hits: 3, el: 'blunt', desc: 'Três chutes girando.' },
      { id: 'passinho', name: 'Passinho', mp: 8, rank: 3, target: 'self', buff: { eva: true, agi: 1.3 }, desc: 'Esquiva e agilidade sobem por 3 turnos.' },
      { id: 'mortal', name: 'Mortal Duplo', mp: 14, rank: 5, target: 'one', power: 2, el: 'blunt', status: ['stun', 0.25], desc: 'Pode atordoar.' },
      { id: 'batalha', name: 'Batalha de Rua', mp: 26, rank: 8, target: 'all', power: 1.6, el: 'blunt', desc: 'Acerta todos.' },
    ] },
  { id: 'vidente', name: 'Vidente', weapon: W('Bola de Cristal', 'orb', 1, 8), mods: M(0.85, 1.4, 0.75, 0.9, 1, 1.35), color: '#b48cff',
    desc: 'Lê o destino nas estrelas. Raios místicos, profecias que confundem e bênçãos.',
    skills: [
      { id: 'raio', name: 'Raio Cristalino', mp: 9, rank: 1, target: 'one', power: 1.6, el: 'magic', status: ['confused', 0.25], desc: 'Pode confundir.' },
      { id: 'purificar', name: 'Purificar', mp: 8, rank: 1, target: 'self', heal: 0.15, cleanse: true, desc: 'Remove males e cura um pouco.' },
      { id: 'profecia', name: 'Profecia Sombria', mp: 10, rank: 3, target: 'one', randomStatus: [['fear', 0.7], ['confused', 0.7], ['silence', 0.7]], desc: 'Medo, confusão ou silêncio no alvo.' },
      { id: 'bencao', name: 'Bênção Astral', mp: 14, rank: 5, target: 'self', buff: { atk: 1.25, mag: 1.3 }, desc: 'Ataque e magia sobem por 3 turnos.' },
      { id: 'tempestade', name: 'Tempestade Cósmica', mp: 30, rank: 8, target: 'all', power: 1.5, el: 'elec', status: ['shock', 0.3], desc: 'Raios em todos.' },
    ] },
  { id: 'choque', name: 'Tropa de Choque', weapon: W('Escudo', 'shield', 4, 0), mods: M(1.35, 0.9, 0.95, 1.4, 0.8, 0.85), color: '#2d4f95',
    desc: 'Uma parede com pernas. Absorve tudo, provoca e espalha gás e choque.',
    skills: [
      { id: 'escudada', name: 'Escudada', mp: 7, rank: 1, target: 'one', power: 1.4, el: 'blunt', status: ['rage', 0.3], desc: 'Pode enfurecer (bate mais, defende menos).' },
      { id: 'muralha', name: 'Muralha', mp: 8, rank: 1, target: 'self', buff: { def: 1.6 }, desc: 'Defesa +60% por 3 turnos.' },
      { id: 'impacto', name: 'Onda de Impacto', mp: 14, rank: 3, target: 'around', power: 1.3, el: 'blunt', desc: 'Acerta o alvo e arredores.' },
      { id: 'bastaoel', name: 'Bastão Elétrico', mp: 14, rank: 5, target: 'one', power: 1.6, el: 'elec', status: ['shock', 0.4], desc: 'Pode eletrocutar.' },
      { id: 'gas', name: 'Gás Sonífero', mp: 16, rank: 7, target: 'around', status: ['sleep', 0.45], desc: 'Pode fazer dormir o alvo e arredores.' },
      { id: 'investida', name: 'Investida Total', mp: 30, rank: 10, target: 'all', power: 1.8, el: 'blunt', bonus: ['rage', 1.5], desc: 'Acerta todos; mais forte em enfurecidos.' },
    ] },
  { id: 'musico', name: 'Músico', weapon: W('Violão', 'guitar', 4, 4), mods: M(0.95, 1.2, 1, 0.95, 1.1, 1.1), color: '#c8873a',
    desc: 'Toca na praça e na briga. Acordes cortantes, baladas que curam e microfonia que cala.',
    skills: [
      { id: 'solo', name: 'Solo Rasgado', mp: 8, rank: 1, target: 'one', power: 1.5, el: 'blunt', desc: 'Violada no alvo.' },
      { id: 'acorde', name: 'Acorde Cortante', mp: 10, rank: 2, target: 'line', power: 1.4, el: 'blade', status: ['bleed', 0.3], desc: 'Acerta todos em linha até o alvo.' },
      { id: 'balada', name: 'Balada Calmante', mp: 12, rank: 3, target: 'self', heal: 0.3, buff: { regen: true }, desc: 'Cura 30% e regenera por 3 turnos.' },
      { id: 'microfonia', name: 'Microfonia', mp: 16, rank: 5, target: 'all', power: 1.1, el: 'magic', status: ['silence', 0.4], desc: 'Pode silenciar (sem golpe especial).' },
      { id: 'lotado', name: 'Show Lotado', mp: 26, rank: 8, target: 'around', power: 2, el: 'blunt', desc: 'Acerta o alvo e arredores.' },
    ] },
  { id: 'obras', name: 'Mestre de Obras', weapon: W('Marreta', 'hammer', 8, 0), mods: M(1.25, 1.1, 1.1, 1.05, 0.85, 0.9), color: '#f2c14e',
    desc: 'A profissão da casa. Marretadas carregadas, EPI completo e demolição em massa.',
    skills: [
      { id: 'carregada', name: 'Marretada Carregada', mp: 10, rank: 1, target: 'one', power: 3.2, el: 'blunt', charge: true, desc: 'Carrega agora e acerta no seu próximo turno.' },
      { id: 'epi', name: 'EPI Completo', mp: 9, rank: 1, target: 'self', buff: { def: 1.4, resist: true }, desc: 'Defesa +40% e imune a males por 3 turnos.' },
      { id: 'demolicao', name: 'Demolição', mp: 14, rank: 3, target: 'around', power: 1.4, el: 'blunt', desc: 'Acerta o alvo e arredores.' },
      { id: 'dinamite', name: 'Dinamite', mp: 18, rank: 5, target: 'around', power: 1.5, el: 'fire', status: ['burn', 0.3], desc: 'Explosão. Pode queimar.' },
      { id: 'bateestaca', name: 'Bate-Estaca', mp: 26, rank: 9, target: 'one', power: 4.6, el: 'blunt', charge: true, desc: 'Carga enorme que cai no próximo turno.' },
      { id: 'bola', name: 'Bola de Demolição', mp: 34, rank: 12, target: 'all', power: 2, el: 'blunt', desc: 'Derruba todos.' },
    ] },
  { id: 'cozinheiro', name: 'Cozinheiro', weapon: W('Frigideira', 'pan', 5, 3), mods: M(1, 1.05, 1, 1, 1.1, 1.1), color: '#e9e4da',
    desc: 'Cozinha de batalha: frigideira, maçarico, pratos voando e uma panela de pressão perigosa.',
    skills: [
      { id: 'frigideirada', name: 'Frigideirada', mp: 6, rank: 1, target: 'one', power: 1.4, el: 'blunt', bonus: ['stun', 1.6], desc: 'Mais forte em atordoados.' },
      { id: 'macarico', name: 'Maçarico', mp: 12, rank: 1, target: 'around', power: 1.3, el: 'fire', status: ['burn', 0.35], desc: 'Fogo no alvo e arredores.' },
      { id: 'prato', name: 'Prato Voador', mp: 10, rank: 2, target: 'line', power: 1.5, el: 'blunt', desc: 'Acerta todos em linha até o alvo.' },
      { id: 'picadinho', name: 'Picadinho', mp: 14, rank: 4, target: 'one', power: 0.5, hits: 4, el: 'blade', status: ['bleed', 0.35], desc: 'Quatro facadas. Pode sangrar.' },
      { id: 'pressao', name: 'Panela de Pressão', mp: 22, rank: 7, target: 'around', power: 1.6, el: 'blunt', status: ['stun', 0.3], desc: 'Pode atordoar o alvo e arredores.' },
    ] },
  { id: 'metaleiro', name: 'Metaleiro', weapon: W('Guitarra-Serra', 'axe', 7, 4), mods: M(1.05, 1, 1.15, 0.95, 1, 1.1), color: '#7a3ad0',
    desc: 'Rock pesado de verdade. Riffs em chamas, serra elétrica e um grito que gela a alma.',
    skills: [
      { id: 'riff', name: 'Riff Infernal', mp: 10, rank: 1, target: 'one', power: 1.6, el: 'fire', status: ['burn', 0.3], desc: 'Pode queimar.' },
      { id: 'serra', name: 'Serra Elétrica', mp: 14, rank: 2, target: 'one', power: 0.5, hits: 5, el: 'blade', status: ['bleed', 0.4], desc: 'Cinco cortes. Pode sangrar.' },
      { id: 'mosh', name: 'Mosh', mp: 16, rank: 4, target: 'around', power: 1.5, el: 'blunt', desc: 'Roda punk no alvo e arredores.' },
      { id: 'gutural', name: 'Grito Gutural', mp: 12, rank: 5, target: 'all', status: ['fear', 0.5], desc: 'Pode amedrontar todos.' },
      { id: 'apocalipse', name: 'Apocalipse do Rock', mp: 34, rank: 9, target: 'all', power: 2, el: 'fire', desc: 'Fogo em todos.' },
    ] },
  { id: 'idolo', name: 'Ídolo', weapon: W('Microfone', 'mic', 3, 5), mods: M(1, 1.25, 0.9, 1.15, 1.05, 1.1), color: '#ffd27a',
    desc: 'Estrela do palco. Distrai, cala, enfraquece a defesa de todos e se recupera com o bis.',
    skills: [
      { id: 'hit', name: 'Hit do Momento', mp: 8, rank: 1, target: 'one', power: 0.5, hits: 3, el: 'blunt', status: ['confused', 0.25], desc: 'Pode deixar o alvo distraído.' },
      { id: 'coreografia', name: 'Coreografia', mp: 10, rank: 1, target: 'one', power: 1.5, el: 'blunt', status: ['silence', 0.3], desc: 'Pode silenciar.' },
      { id: 'bis', name: 'Bis!', mp: 12, rank: 3, target: 'self', heal: 0.4, desc: 'Cura 40%.' },
      { id: 'faclube', name: 'Fã-clube', mp: 14, rank: 5, target: 'all', status: ['defDown', 0.8], desc: 'Baixa a defesa de todos.' },
      { id: 'agua', name: "Pistola d'Água", mp: 10, rank: 6, target: 'one', power: 1.5, el: 'ice', status: ['cold', 0.45], desc: 'Pode resfriar.' },
      { id: 'estadio', name: 'Show de Estádio', mp: 30, rank: 10, target: 'self', heal: 1, buff: { regen: true }, desc: 'Vida cheia e regeneração.' },
    ] },
  { id: 'crupie', name: 'Crupiê', weapon: W('Cartas e Dados', 'cards', 5, 3), mods: M(0.95, 1.05, 1.05, 0.95, 1.25, 1), color: '#4fd18b',
    desc: 'A casa sempre ganha… quase sempre. Tudo é sorte: cartas, fichas, dardos e a roleta.',
    skills: [
      { id: 'carta', name: 'Carta Marcada', mp: 8, rank: 1, target: 'one', rand: [0.5, 2.6], el: 'blunt', desc: 'Dano depende da carta tirada.' },
      { id: 'ficha', name: 'Ficha Certeira', mp: 10, rank: 2, target: 'one', power: 1.4, el: 'blunt', crit: 0.6, desc: 'Altíssima chance de crítico.' },
      { id: 'dardos', name: 'Três Dardos', mp: 14, rank: 4, target: 'around', power: 1.2, el: 'blade', desc: 'Acerta o alvo e arredores.' },
      { id: 'coringa', name: 'Coringa', mp: 12, rank: 5, target: 'self', randomBuff: true, desc: 'Um atributo aleatório sobe muito.' },
      { id: 'viciada', name: 'Mão Viciada', mp: 14, rank: 7, target: 'one', randomStatus: [['burn', 0.75], ['poison', 0.75], ['cold', 0.75]], desc: 'Queima, envenena ou resfria.' },
      { id: 'roleta', name: 'Roleta', mp: 20, rank: 10, target: 'self', roulette: true, desc: 'Gira a roleta. Pode dar muito certo… ou não.' },
    ] },
  { id: 'mandachuva', name: 'Mandachuva', weapon: W('Lança', 'spear', 7, 2), mods: M(1.05, 1.05, 1.05, 1.05, 1.05, 1.05), color: '#a0a8b8',
    desc: 'Quem manda no pedaço. Equilibrado em tudo: lança longa, varredura e uma metralhadora.',
    skills: [
      { id: 'lanca', name: 'Golpe de Lança', mp: 8, rank: 1, target: 'line', power: 1.5, el: 'blade', desc: 'Acerta todos em linha até o alvo.' },
      { id: 'varredura', name: 'Varredura', mp: 12, rank: 2, target: 'around', power: 1.3, el: 'blade', status: ['bleed', 0.25], desc: 'Varre o alvo e arredores.' },
      { id: 'metralha', name: 'Metralhadora', mp: 18, rank: 4, target: 'all', power: 0.45, hits: 3, el: 'bullet', desc: 'Rajadas em todos.' },
      { id: 'ordem', name: 'Ordem Firme', mp: 12, rank: 5, target: 'self', buff: { atk: 1.25, def: 1.3 }, desc: 'Ataque e defesa sobem por 3 turnos.' },
      { id: 'familia', name: 'Fúria da Família', mp: 32, rank: 9, target: 'all', power: 1.9, el: 'blade', desc: 'Acerta todos com força.' },
    ] },
  { id: 'civil', name: 'Engenheiro Civil', weapon: W('Vergalhão', 'rebar', 7, 2), mods: M(1.25, 1, 1.1, 1.2, 0.85, 0.9), color: '#f2c14e', fx: 'concrete',
    desc: 'Capacete na cabeça e vergalhão na mão. Concreta o inimigo no lugar, calcula onde a estrutura cede e derruba laje em cima de todo mundo.',
    skills: [
      { id: 'vergalhada', name: 'Vergalhada', mp: 6, rank: 1, target: 'one', power: 1.7, el: 'blunt', desc: 'Golpe seco com o vergalhão.' },
      { id: 'concretagem', name: 'Concretagem', mp: 10, rank: 1, target: 'one', power: 1.1, el: 'blunt', status: ['stun', 0.5], desc: 'Joga concreto fresco: boa chance de travar o alvo.' },
      { id: 'calculo', name: 'Cálculo Estrutural', mp: 9, rank: 2, target: 'all', status: ['defDown', 0.75], desc: 'Acha o ponto fraco: baixa a defesa de todos.' },
      { id: 'fundacao', name: 'Fundação Profunda', mp: 12, rank: 3, target: 'self', buff: { def: 1.5, resist: true }, desc: 'Defesa +50% e imune a males por 3 turnos.' },
      { id: 'laje', name: 'Laje Desabando', mp: 18, rank: 5, target: 'around', power: 1.6, el: 'blunt', status: ['stun', 0.25], desc: 'Uma laje cai no alvo e em quem estiver perto.' },
      { id: 'implosao', name: 'Implosão Controlada', mp: 30, rank: 8, target: 'all', power: 2.1, el: 'blunt', charge: true, desc: 'Arma as cargas agora; tudo vem abaixo no seu próximo turno.' },
    ] },
  { id: 'mecanico', name: 'Engenheiro Mecânico', weapon: W('Chave Inglesa', 'wrench', 6, 4), mods: M(1.05, 1.1, 1.1, 1, 1.1, 1.05), color: '#e8743a', fx: 'sparks',
    desc: 'Graxa até o cotovelo. Aperta parafuso na cabeça do inimigo, solda, joga engrenagem e dá curto-circuito em quem chegar perto.',
    skills: [
      { id: 'aperto', name: 'Aperto de Parafuso', mp: 6, rank: 1, target: 'one', power: 1.6, el: 'blunt', status: ['stun', 0.2], desc: 'Chave inglesa na cabeça. Pode atordoar.' },
      { id: 'solda', name: 'Faísca de Solda', mp: 9, rank: 1, target: 'one', power: 1.5, el: 'fire', status: ['burn', 0.45], desc: 'Arco de solda: pode queimar.' },
      { id: 'engrenagem', name: 'Engrenagem Voadora', mp: 11, rank: 2, target: 'line', power: 0.8, hits: 2, el: 'blade', status: ['bleed', 0.35], desc: 'Arremessa uma engrenagem que corta todos em linha.' },
      { id: 'lubrifica', name: 'Lubrificação', mp: 10, rank: 3, target: 'self', buff: { agi: 1.4, eva: true }, desc: 'Agilidade e esquiva sobem por 3 turnos.' },
      { id: 'curto', name: 'Curto-Circuito', mp: 16, rank: 5, target: 'around', power: 1.5, el: 'elec', status: ['shock', 0.4], desc: 'Choque no alvo e arredores. Pode paralisar.' },
      { id: 'turbo', name: 'Motor Turbo', mp: 26, rank: 8, target: 'one', power: 0.6, hits: 6, el: 'blunt', desc: 'Seis pancadas em sequência, no giro máximo.' },
    ] },
  { id: 'arquiteto', name: 'Arquiteto', weapon: W('Régua T', 'tsquare', 3, 8), mods: M(0.9, 1.35, 0.85, 0.9, 1.1, 1.35), color: '#6fb6ff', fx: 'blueprint',
    desc: 'Enxerga a briga em planta baixa. Traços precisos, projeções que confundem e um render final que ilumina tudo.',
    skills: [
      { id: 'traco', name: 'Traço Preciso', mp: 7, rank: 1, target: 'one', power: 1.4, el: 'blade', crit: 0.45, desc: 'Corte com a régua. Alta chance de crítico.' },
      { id: 'projecao', name: 'Projeção 3D', mp: 9, rank: 1, target: 'one', power: 1.4, el: 'magic', status: ['confused', 0.4], desc: 'Um holograma deixa o alvo tonto.' },
      { id: 'planta', name: 'Planta Baixa', mp: 12, rank: 2, target: 'all', power: 0.9, el: 'magic', status: ['defDown', 0.5], desc: 'Desenha a planta de todos: dano e defesa baixa.' },
      { id: 'luz', name: 'Iluminação Natural', mp: 12, rank: 3, target: 'self', heal: 0.35, buff: { regen: true }, desc: 'Cura 35% e regenera por 3 turnos.' },
      { id: 'maquete', name: 'Maquete Desabando', mp: 18, rank: 5, target: 'around', power: 1.5, el: 'magic', status: ['stun', 0.3], desc: 'Uma maquete gigante cai no alvo e arredores.' },
      { id: 'render', name: 'Render Final', mp: 30, rank: 8, target: 'all', power: 1.9, el: 'magic', desc: 'Luz em todos os inimigos.' },
    ] },
];
// debug: only these classes show up for now (the others stay in the data, hidden)
const VISIBLE = ['heroi', 'freelancer', 'civil', 'mecanico', 'arquiteto'];
export const CLASSES = VISIBLE.map(id => ALL_CLASSES.find(c => c.id === id));
export const classById = id => CLASSES.find(c => c.id === id) || CLASSES[0];
export const MAGIC_EL = new Set(['fire', 'ice', 'elec', 'magic']);
export const RANGED_EL = new Set(['fire', 'ice', 'elec', 'magic', 'bullet']);
export const EL_NAME = { blunt: 'Impacto', blade: 'Corte', fire: 'Fogo', ice: 'Gelo', elec: 'Elétrico', bullet: 'Bala', magic: 'Místico' };

// ailments: how long they last and how they read in the HUD
export const STATUS = {
  burn: { name: 'Queimado', turns: 3, color: '#ff8a3a' }, bleed: { name: 'Sangrando', turns: 3, color: '#e03a3a' },
  poison: { name: 'Envenenado', turns: 4, color: '#7ad04a' }, stun: { name: 'Atordoado', turns: 1, color: '#ffd23a' },
  sleep: { name: 'Dormindo', turns: 3, color: '#9fd3ff' }, shock: { name: 'Eletrocutado', turns: 2, color: '#f5f06a' },
  confused: { name: 'Tonto', turns: 2, color: '#ff9cf0' }, fear: { name: 'Com medo', turns: 3, color: '#b48cff' },
  silence: { name: 'Silenciado', turns: 3, color: '#cfd3da' }, cold: { name: 'Resfriado', turns: 3, color: '#7fd8ff' },
  rage: { name: 'Enfurecido', turns: 3, color: '#ff5a3a' }, defDown: { name: 'Defesa ↓', turns: 3, color: '#ffb36b' },
  atkDown: { name: 'Ataque ↓', turns: 3, color: '#ffb36b' },
};
export const BUFF_NAME = { atk: 'ATQ↑', def: 'DEF↑', agi: 'AGI↑', mag: 'MAG↑', eva: 'ESQ↑', regen: 'Regen', resist: 'Imune', counter: 'Revide', guardian: 'Aguenta' };

const BASE = { hp: 120, mp: 30, atk: 12, def: 6, agi: 8, mag: 10 };
const GROW = { hp: 14, mp: 4, atk: 3, def: 2, agi: 1, mag: 3 };

// XP to the next character level / job rank
export const xpToNext = level => 20 + level * level * 12;
export const rankToNext = rank => 12 + rank * rank * 6;
export const debug = {
  get unlockAll() { try { return localStorage.getItem('resenha.debug.unlock') !== '0'; } catch { return true; } },
  set unlockAll(v) { try { localStorage.setItem('resenha.debug.unlock', v ? '1' : '0'); } catch { } },
};

export function loadHero(id) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('resenha.hero.' + id) || '{}'); } catch { }
  const stat = (h, k) => Math.round((BASE[k] + GROW[k] * (h.level - 1)) * h.cls.mods[k]);
  const h = {
    id, level: saved.level || 1, xp: saved.xp || 0, money: saved.money || 0, clsId: classById(saved.cls).id, jobs: saved.jobs || {},
    get cls() { return classById(this.clsId); },
    get job() { return this.jobs[this.clsId] || (this.jobs[this.clsId] = { rank: 1, xp: 0 }); },
    get maxHp() { return stat(this, 'hp'); },
    get maxMp() { return stat(this, 'mp'); },
    get atk() { return stat(this, 'atk') + this.cls.weapon.atk; },
    get mag() { return stat(this, 'mag') + this.cls.weapon.mag; },
    get def() { return stat(this, 'def'); },
    get agi() { return stat(this, 'agi'); },
    // skills usable now: unlocked by job rank (all of them while the debug switch is on)
    skills() { return this.cls.skills.filter(s => debug.unlockAll || s.rank <= this.job.rank); },
    setClass(cid) { this.clsId = classById(cid).id; this.rest(); },
    // returns { ups, rankUps }; a level up refills HP and MP
    gainXp(n) {
      this.xp += n; let ups = 0, rankUps = 0;
      while (this.xp >= xpToNext(this.level)) { this.xp -= xpToNext(this.level); this.level++; ups++; }
      const j = this.job; j.xp += n;
      while (j.xp >= rankToNext(j.rank)) { j.xp -= rankToNext(j.rank); j.rank++; rankUps++; }
      if (ups) { this.hp = this.maxHp; this.mp = this.maxMp; }
      this.save(); return { ups, rankUps };
    },
    rest() { this.hp = this.maxHp; this.mp = this.maxMp; this.save(); },
    save() { try { localStorage.setItem('resenha.hero.' + id, JSON.stringify({ level: this.level, xp: this.xp, hp: this.hp, mp: this.mp, money: this.money, cls: this.clsId, jobs: this.jobs })); } catch { } },
  };
  h.hp = Math.min(saved.hp ?? h.maxHp, h.maxHp);
  h.mp = Math.min(saved.mp ?? h.maxMp, h.maxMp);
  return h;
}

// The first enemy: a street thug (drawn from the Resenha host, in a red shirt).
// weak: damage multipliers by type (shown as "FRACO!" in battle).
export const ENEMIES = {
  delinquente: { name: 'Capanga', sprite: 'capanga', hp: 55, atk: 11, def: 3, agi: 7, xp: 18, money: 80, weak: { elec: 1.3, blunt: 1.1 }, special: { name: 'Chute Baixo', power: 1.5, every: 3, status: ['stun', 0.2] } },
};
